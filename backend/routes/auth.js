const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');
const { pool }  = require('../db');

// ── POST /api/auth/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const totpSecret = speakeasy.generateSecret({
      name:   `CryptoVault (${email})`,
      issuer: 'CryptoVault',
      length: 32,
    });

    await pool.query(
      'INSERT INTO users (email, password_hash, totp_secret) VALUES ($1, $2, $3)',
      [email.toLowerCase().trim(), passwordHash, totpSecret.base32]
    );

    const qrCodeDataUrl = await QRCode.toDataURL(totpSecret.otpauth_url, {
      width:  300,
      margin: 2,
      color:  { dark: '#000000', light: '#ffffff' },
    });

    res.status(201).json({
      message:    'Conta criada! Configure o 2FA agora.',
      qrCode:     qrCodeDataUrl,
      backupCode: totpSecret.base32,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password, totpCode } = req.body;

  if (!email || !password || !totpCode) {
    return res.status(400).json({ error: 'Email, senha e código 2FA são obrigatórios' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    // Mesmo erro para email errado ou senha errada (evita enumeration attack)
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const totpValid = speakeasy.totp.verify({
      secret:   user.totp_secret,
      encoding: 'base32',
      token:    totpCode.replace(/\s/g, ''),
      window:   1, // permite 30s de drift de relógio
    });

    if (!totpValid) {
      return res.status(401).json({ error: 'Código 2FA inválido ou expirado' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro ao fazer login. Tente novamente.' });
  }
});

module.exports = router;

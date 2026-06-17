const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');
const { pool }  = require('../db');
const { encryptAtRest, decryptAtRest, decoySalt } = require('../utils/serverCrypto');

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX64_RE  = /^[0-9a-f]{64}$/i; // authKeys derivadas (256 bits em hex)

const norm = (e) => String(e || '').toLowerCase().trim();

// Hash-isca válido para igualar o tempo de resposta quando o email não existe
const DECOY_HASH = bcrypt.hashSync('cryptovault-decoy', 12);

// ── POST /register ───────────────────────────────────────────
// Recebe APENAS material derivado/embrulhado no cliente. O servidor
// nunca vê a senha, a DEK em claro, nem o código de recuperação.
router.post('/register', async (req, res) => {
  const { email, authKey, recAuthKey, kdfSalt, kdfSaltRc, wrappedDekPw, wrappedDekRc } = req.body || {};

  if (!email || !authKey || !recAuthKey || !kdfSalt || !kdfSaltRc || !wrappedDekPw || !wrappedDekRc) {
    return res.status(400).json({ error: 'Dados de cadastro incompletos' });
  }
  if (!EMAIL_RE.test(email))      return res.status(400).json({ error: 'Email inválido' });
  if (!HEX64_RE.test(authKey) || !HEX64_RE.test(recAuthKey)) {
    return res.status(400).json({ error: 'Material de autenticação inválido' });
  }

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [norm(email)]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }

    const authHash    = await bcrypt.hash(authKey, 12);
    const recAuthHash = await bcrypt.hash(recAuthKey, 12);

    const totp = speakeasy.generateSecret({ name: `CryptoVault (${norm(email)})`, issuer: 'CryptoVault', length: 32 });
    const totpEnc = encryptAtRest(totp.base32);

    await pool.query(
      `INSERT INTO users
        (email, auth_hash, rec_auth_hash, kdf_salt, kdf_salt_rc, wrapped_dek_pw, wrapped_dek_rc, totp_secret_enc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [norm(email), authHash, recAuthHash, kdfSalt, kdfSaltRc, wrappedDekPw, wrappedDekRc, totpEnc]
    );

    const qrCode = await QRCode.toDataURL(totp.otpauth_url, { width: 300, margin: 2 });

    // totpSecret é a MESMA informação contida no QR — devolvida ao próprio
    // dono para entrada manual caso não consiga escanear.
    res.status(201).json({ message: 'Conta criada. Configure o 2FA.', qrCode, totpSecret: totp.base32 });
  } catch (err) {
    console.error('register:', err);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

// ── GET /params?email= ───────────────────────────────────────
// Devolve o salt para o cliente derivar a chave da senha.
// Para email inexistente devolve um salt-isca determinístico (anti-enumeração).
router.get('/params', async (req, res) => {
  const email = norm(req.query.email);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email inválido' });
  try {
    const r = await pool.query('SELECT kdf_salt FROM users WHERE email = $1', [email]);
    const kdfSalt = r.rows.length ? r.rows[0].kdf_salt : decoySalt('pw', email);
    res.json({ kdfSalt });
  } catch (err) {
    console.error('params:', err);
    res.status(500).json({ error: 'Erro ao obter parâmetros' });
  }
});

// ── POST /login ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, authKey, totpCode } = req.body || {};
  if (!email || !authKey || !totpCode) {
    return res.status(400).json({ error: 'Email, autenticação e código 2FA são obrigatórios' });
  }
  try {
    const r = await pool.query('SELECT * FROM users WHERE email = $1', [norm(email)]);
    // Erro genérico para qualquer falha (anti-enumeração)
    const fail = () => res.status(401).json({ error: 'Credenciais inválidas' });

    if (r.rows.length === 0) { await bcrypt.compare(authKey, DECOY_HASH); return fail(); }
    const user = r.rows[0];

    if (!(await bcrypt.compare(authKey, user.auth_hash))) return fail();

    const totpOk = speakeasy.totp.verify({
      secret: decryptAtRest(user.totp_secret_enc),
      encoding: 'base32',
      token: String(totpCode).replace(/\s/g, ''),
      window: 1,
    });
    if (!totpOk) return fail();

    const token = jwt.sign({ userId: user.id, email: user.email, purpose: 'access' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, email: user.email, wrappedDekPw: user.wrapped_dek_pw });
  } catch (err) {
    console.error('login:', err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// ── GET /recovery-params?email= ──────────────────────────────
router.get('/recovery-params', async (req, res) => {
  const email = norm(req.query.email);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email inválido' });
  try {
    const r = await pool.query('SELECT kdf_salt_rc FROM users WHERE email = $1', [email]);
    const kdfSaltRc = r.rows.length ? r.rows[0].kdf_salt_rc : decoySalt('rc', email);
    res.json({ kdfSaltRc });
  } catch (err) {
    console.error('recovery-params:', err);
    res.status(500).json({ error: 'Erro ao obter parâmetros' });
  }
});

// ── POST /recover/verify ─────────────────────────────────────
// Verifica o código de recuperação e libera a cópia embrulhada (rc) da DEK.
router.post('/recover/verify', async (req, res) => {
  const { email, recAuthKey } = req.body || {};
  if (!email || !recAuthKey) return res.status(400).json({ error: 'Dados incompletos' });
  try {
    const r = await pool.query('SELECT * FROM users WHERE email = $1', [norm(email)]);
    const fail = () => res.status(401).json({ error: 'Código de recuperação inválido' });
    if (r.rows.length === 0) { await bcrypt.compare(recAuthKey, DECOY_HASH); return fail(); }
    const user = r.rows[0];
    if (!(await bcrypt.compare(recAuthKey, user.rec_auth_hash))) return fail();

    const recoveryToken = jwt.sign({ userId: user.id, purpose: 'recover' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    res.json({ recoveryToken, wrappedDekRc: user.wrapped_dek_rc });
  } catch (err) {
    console.error('recover/verify:', err);
    res.status(500).json({ error: 'Erro na recuperação' });
  }
});

// ── POST /recover/commit ─────────────────────────────────────
// Cliente re-embrulhou a DEK com a nova senha; aqui só persistimos.
router.post('/recover/commit', async (req, res) => {
  const { recoveryToken, newAuthKey, newKdfSalt, newWrappedDekPw } = req.body || {};
  if (!recoveryToken || !newAuthKey || !newKdfSalt || !newWrappedDekPw) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }
  if (!HEX64_RE.test(newAuthKey)) return res.status(400).json({ error: 'Material de autenticação inválido' });
  try {
    let payload;
    try { payload = jwt.verify(recoveryToken, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Sessão de recuperação expirada' }); }
    if (payload.purpose !== 'recover') return res.status(401).json({ error: 'Token inválido' });

    const newAuthHash = await bcrypt.hash(newAuthKey, 12);
    await pool.query(
      'UPDATE users SET auth_hash = $1, kdf_salt = $2, wrapped_dek_pw = $3 WHERE id = $4',
      [newAuthHash, newKdfSalt, newWrappedDekPw, payload.userId]
    );
    res.json({ message: 'Senha redefinida. Faça login com a nova senha.' });
  } catch (err) {
    console.error('recover/commit:', err);
    res.status(500).json({ error: 'Erro ao redefinir senha' });
  }
});

module.exports = router;

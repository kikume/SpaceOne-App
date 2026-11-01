require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const fs        = require('fs');
const { initDB } = require('./db');

const authRoutes    = require('./routes/auth');
const seedsRoutes   = require('./routes/seeds');
const paymentRoutes = require('./routes/payment');

const app = express();

const isProd = process.env.NODE_ENV === 'production';

// Validação de ambiente: falhar no boot é melhor que falhar com usuário dentro.
if (isProd) {
  const missing = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) missing.push('JWT_SECRET (mínimo 32 chars)');
  if (!/^[0-9a-f]{64}$/i.test(process.env.TOTP_ENC_KEY || ''))       missing.push('TOTP_ENC_KEY (32 bytes em hex = 64 chars)');
  if (!process.env.PARAMS_PEPPER)                                    missing.push('PARAMS_PEPPER');
  if (!process.env.DATABASE_URL)                                     missing.push('DATABASE_URL');
  if (missing.length) {
    console.error('❌ Variáveis de ambiente ausentes/inválidas:\n  - ' + missing.join('\n  - '));
    process.exit(1);
  }
  // Atrás do proxy do Render/Netlify: necessário para o rate-limit ver o IP real
  app.set('trust proxy', 1);
}

app.use(helmet());
// Origens permitidas: web (dev) + apps nativos Capacitor (Android/iOS)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost', 'https://localhost', 'capacitor://localhost',
];
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
}));
app.use(express.json({ limit: '64kb' }));

// Generoso em desenvolvimento (para não atrapalhar testes); estrito em produção.
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: isProd ? 60  : 5000, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde 15 minutos.' } });
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: isProd ? 300 : 5000, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas requisições. Aguarde um momento.' } });

app.use('/api/auth',    authLimiter,    authRoutes);
app.use('/api/seeds',   generalLimiter, seedsRoutes);
app.use('/api/payment', generalLimiter, paymentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'CryptoVault API', model: 'zero-knowledge', timestamp: new Date().toISOString() });
});

// API 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// Serve o frontend React (gerado por npm run build)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    maxAge: '1y',
    immutable: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  // SPA fallback — qualquer rota desconhecida devolve index.html
  app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3001;

initDB()
  .then(() => app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   🔐  CryptoVault API (zero-knowledge)   ║
╠══════════════════════════════════════════╣
║  Porta:     ${String(PORT).padEnd(29)}║
║  Ambiente:  ${(process.env.NODE_ENV || 'development').padEnd(29)}║
║  Cripto:    no navegador (servidor cego)  ║
╚══════════════════════════════════════════╝
    `);
  }))
  .catch(err => { console.error('❌ Falha ao inicializar:', err.message); process.exit(1); });

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./db');

const authRoutes    = require('./routes/auth');
const seedsRoutes   = require('./routes/seeds');
const paymentRoutes = require('./routes/payment');

const app = express();

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
const isProd = process.env.NODE_ENV === 'production';
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: isProd ? 60  : 5000, message: { error: 'Muitas tentativas. Aguarde 15 minutos.' } });
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: isProd ? 300 : 5000, message: { error: 'Muitas requisições. Aguarde um momento.' } });

app.use('/api/auth',    authLimiter,    authRoutes);
app.use('/api/seeds',   generalLimiter, seedsRoutes);
app.use('/api/payment', generalLimiter, paymentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'CryptoVault API', model: 'zero-knowledge', timestamp: new Date().toISOString() });
});

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
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

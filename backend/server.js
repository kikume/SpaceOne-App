require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./db');

const authRoutes  = require('./routes/auth');
const seedsRoutes = require('./routes/seeds');

const app = express();

// ── Segurança ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

// Rate limiting mais restrito para autenticação (20 req / 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { error: 'Muitas tentativas. Aguarde 15 minutos.' },
});

// Rate limiting geral (100 req / 15 min)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { error: 'Muitas requisições. Aguarde um momento.' },
});

app.use('/api/auth',  authLimiter);
app.use('/api/seeds', generalLimiter);

// ── Rotas ────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/seeds', seedsRoutes);

app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'CryptoVault API',
    timestamp: new Date().toISOString(),
    contract:  process.env.CONTRACT_ADDRESS,
  });
});

// ── Erro 404 ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ── Erro global ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ── Inicialização ────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════╗
║       🔐  CryptoVault API Online         ║
╠══════════════════════════════════════════╣
║  Porta:     ${String(PORT).padEnd(29)}║
║  Ambiente:  ${(process.env.NODE_ENV || 'development').padEnd(29)}║
║  Contrato:  ${(process.env.CONTRACT_ADDRESS || 'não configurado').padEnd(29)}║
╚══════════════════════════════════════════╝
      `);
    });
  })
  .catch(err => {
    console.error('❌ Falha ao inicializar banco de dados:', err.message);
    process.exit(1);
  });

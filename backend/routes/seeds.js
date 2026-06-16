const router          = require('express').Router();
const requireAuth     = require('../middleware/auth');
const { pool }        = require('../db');
const { deriveKey, getEmailHash, encrypt, decrypt } = require('../utils/crypto');
const { storeItemOnChain, getItemsFromChain }       = require('../lib/blockchain');

// Todas as rotas de seeds exigem autenticação
router.use(requireAuth);

// ── POST /api/seeds ──────────────────────────────────────────
// Salva uma nova seed criptografada na blockchain
router.post('/', async (req, res) => {
  const { title, seedPhrase } = req.body;

  if (!title || !seedPhrase) {
    return res.status(400).json({ error: 'Título e seed phrase são obrigatórios' });
  }
  if (title.includes('::')) {
    return res.status(400).json({ error: 'O título não pode conter "::"' });
  }
  if (title.trim().length > 100) {
    return res.status(400).json({ error: 'Título muito longo (máx 100 caracteres)' });
  }

  try {
    const { email, userId } = req.user;

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const { password_hash } = result.rows[0];

    // Deriva a chave de criptografia do hash da senha + email
    const encryptionKey = deriveKey(password_hash, email);

    // Criptografa a seed phrase
    const encryptedSeed = encrypt(seedPhrase.trim(), encryptionKey);

    // Prefixo no título para identificar o dono sem expor o email
    const emailHash      = getEmailHash(email);
    const blockchainTitle = `${emailHash}::${title.trim()}`;

    // Salva na blockchain
    const { txHash, blockNumber } = await storeItemOnChain(blockchainTitle, encryptedSeed);

    res.json({
      message:     'Seed salva com segurança na blockchain!',
      txHash,
      blockNumber,
    });
  } catch (err) {
    console.error('Save seed error:', err);

    if (err.message && err.message.includes('insufficient funds')) {
      return res.status(503).json({
        error: 'Carteira mestre sem saldo AVAX. Recarregue em https://faucet.avax.network',
      });
    }

    res.status(500).json({ error: 'Erro ao salvar seed. Tente novamente.' });
  }
});

// ── GET /api/seeds ───────────────────────────────────────────
// Lista e descriptografa todas as seeds do usuário autenticado
router.get('/', async (req, res) => {
  try {
    const { email, userId } = req.user;

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const { password_hash } = result.rows[0];
    const encryptionKey    = deriveKey(password_hash, email);
    const emailHash        = getEmailHash(email);
    const prefix           = `${emailHash}::`;

    // Busca todos os itens da carteira mestre na blockchain
    const allItems = await getItemsFromChain();

    // Filtra os itens do usuário e descriptografa
    const seeds = [];
    for (const item of allItems) {
      if (!item.title.startsWith(prefix)) continue;

      try {
        const actualTitle   = item.title.slice(prefix.length);
        const decryptedSeed = decrypt(item.encryptedData, encryptionKey);
        seeds.push({
          title:       actualTitle,
          seedPhrase:  decryptedSeed,
          timestamp:   item.timestamp,
        });
      } catch (decryptErr) {
        // Item corrompido ou de outro usuário com hash colidente — ignora silenciosamente
        console.error('Falha ao descriptografar:', item.title, decryptErr.message);
      }
    }

    // Mais recente primeiro
    seeds.sort((a, b) => b.timestamp - a.timestamp);

    res.json({ seeds });
  } catch (err) {
    console.error('Get seeds error:', err);
    res.status(500).json({ error: 'Erro ao buscar seeds. Tente novamente.' });
  }
});

module.exports = router;

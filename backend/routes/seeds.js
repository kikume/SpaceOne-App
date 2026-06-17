const router      = require('express').Router();
const requireAuth = require('../middleware/auth');
const { pool }    = require('../db');

router.use(requireAuth);

// ── GET /seeds ───────────────────────────────────────────────
// Devolve os blobs CIFRADOS. A descriptografia acontece no navegador.
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, blob, (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS timestamp
         FROM seeds WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ seeds: r.rows.map(x => ({ id: x.id, blob: x.blob, timestamp: Number(x.timestamp) })) });
  } catch (err) {
    console.error('seeds.get:', err);
    res.status(500).json({ error: 'Erro ao buscar seeds' });
  }
});

// ── POST /seeds ──────────────────────────────────────────────
// Recebe APENAS o blob cifrado. O servidor não sabe o que tem dentro.
router.post('/', async (req, res) => {
  const { blob } = req.body || {};
  if (!blob || typeof blob !== 'string') return res.status(400).json({ error: 'Blob ausente' });
  if (blob.length > 8192)               return res.status(400).json({ error: 'Blob muito grande' });
  try {
    const u = await pool.query('SELECT paid FROM users WHERE id = $1', [req.user.userId]);
    if (!u.rows[0] || !u.rows[0].paid) {
      return res.status(402).json({ error: 'Pagamento necessário para salvar seeds', code: 'PAYMENT_REQUIRED' });
    }
    const r = await pool.query(
      `INSERT INTO seeds (user_id, blob) VALUES ($1, $2)
       RETURNING id, (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS timestamp`,
      [req.user.userId, blob]
    );
    res.status(201).json({ id: r.rows[0].id, timestamp: Number(r.rows[0].timestamp) });
  } catch (err) {
    console.error('seeds.post:', err);
    res.status(500).json({ error: 'Erro ao salvar seed' });
  }
});

// ── DELETE /seeds/:id ────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const r = await pool.query('DELETE FROM seeds WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Seed não encontrada' });
    res.json({ message: 'Seed removida' });
  } catch (err) {
    console.error('seeds.delete:', err);
    res.status(500).json({ error: 'Erro ao remover seed' });
  }
});

module.exports = router;

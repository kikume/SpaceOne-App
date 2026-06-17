const router      = require('express').Router();
const requireAuth = require('../middleware/auth');
const { pool }    = require('../db');

// Endereço que RECEBE os pagamentos (público — pode ficar no código/env)
const PAY_ADDRESS = process.env.SOLANA_PAY_ADDRESS || 'EPsQUSysoDn9FGyUvCDvypn2hSkCPERzszYeUyHyqaAs';
const RPC         = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const USDC_MINT   = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC na Solana mainnet
const PRICE_USD   = Number(process.env.PRICE_USD || 2);
const MIN_USD     = PRICE_USD - 0.05; // tolerância p/ flutuação de cotação / taxas

router.use(requireAuth);

// ── GET /status ──────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const r = await pool.query('SELECT paid FROM users WHERE id = $1', [req.user.userId]);
    res.json({
      paid: !!(r.rows[0] && r.rows[0].paid),
      address: PAY_ADDRESS,
      priceUsd: PRICE_USD,
      coins: ['USDC', 'SOL'],
      network: 'solana',
    });
  } catch (e) {
    console.error('payment.status:', e);
    res.status(500).json({ error: 'Erro ao consultar status' });
  }
});

// ── Helpers de verificação on-chain ──────────────────────────
async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  const j = await res.json();
  if (j.error) throw new Error('RPC: ' + (j.error.message || 'erro'));
  return j.result;
}

async function solPriceUsd() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return Number(j && j.solana && j.solana.usd) || null;
  } catch { return null; }
}

/** Confere se a transação `signature` pagou >= $2 (USDC ou SOL) ao PAY_ADDRESS. */
async function verifyOnChain(signature) {
  const tx = await rpc('getTransaction', [signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }]);
  if (!tx)            return { ok: false, reason: 'Transação não encontrada ou ainda não finalizada (aguarde alguns segundos e tente de novo)' };
  if (tx.meta && tx.meta.err) return { ok: false, reason: 'A transação falhou na rede Solana' };

  const meta = tx.meta || {};
  const keys = (tx.transaction.message.accountKeys || []).map(k => (typeof k === 'string' ? k : k.pubkey));

  // 1) USDC (SPL token) recebido pelo PAY_ADDRESS
  for (const p of (meta.postTokenBalances || [])) {
    if (p.mint !== USDC_MINT || p.owner !== PAY_ADDRESS) continue;
    const pre = (meta.preTokenBalances || []).find(b => b.accountIndex === p.accountIndex);
    const delta = Number(p.uiTokenAmount.uiAmount || 0) - Number(pre ? (pre.uiTokenAmount.uiAmount || 0) : 0);
    if (delta >= MIN_USD) return { ok: true, coin: 'USDC', amountUsd: delta };
  }

  // 2) SOL nativo recebido pelo PAY_ADDRESS
  const idx = keys.indexOf(PAY_ADDRESS);
  if (idx >= 0 && Array.isArray(meta.preBalances) && Array.isArray(meta.postBalances)) {
    const deltaSol = (meta.postBalances[idx] - meta.preBalances[idx]) / 1e9;
    if (deltaSol > 0) {
      const price = await solPriceUsd();
      if (!price) return { ok: false, reason: 'Não consegui cotar o SOL agora — tente pagar em USDC' };
      const usd = deltaSol * price;
      if (usd >= MIN_USD) return { ok: true, coin: 'SOL', amountUsd: usd };
      return { ok: false, reason: `Recebido só ~$${usd.toFixed(2)} em SOL (mínimo $${PRICE_USD})` };
    }
  }

  return { ok: false, reason: `Não encontrei um pagamento de $${PRICE_USD} (USDC ou SOL) para o endereço nessa transação` };
}

// ── POST /verify { signature } ───────────────────────────────
router.post('/verify', async (req, res) => {
  const { signature } = req.body || {};
  if (!signature || typeof signature !== 'string' || signature.length < 64 || signature.length > 120) {
    return res.status(400).json({ error: 'Assinatura da transação inválida' });
  }
  try {
    const u = await pool.query('SELECT paid FROM users WHERE id = $1', [req.user.userId]);
    if (u.rows[0] && u.rows[0].paid) return res.json({ paid: true, message: 'Acesso já estava liberado' });

    const v = await verifyOnChain(signature.trim());
    if (!v.ok) return res.status(402).json({ error: v.reason });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // UNIQUE(signature) impede que a mesma tx libere várias contas
      await client.query('INSERT INTO payments (user_id, signature, coin, amount_usd) VALUES ($1,$2,$3,$4)',
        [req.user.userId, signature.trim(), v.coin, v.amountUsd.toFixed(2)]);
      await client.query('UPDATE users SET paid = TRUE WHERE id = $1', [req.user.userId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      if (e.code === '23505') return res.status(409).json({ error: 'Esta transação já foi usada para liberar uma conta' });
      throw e;
    } finally {
      client.release();
    }
    res.json({ paid: true, coin: v.coin, message: 'Pagamento confirmado — acesso liberado! 🎉' });
  } catch (e) {
    console.error('payment.verify:', e);
    res.status(500).json({ error: 'Erro ao verificar o pagamento. Tente novamente em instantes.' });
  }
});

module.exports = router;

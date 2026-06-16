/**
 * CryptoVault — Testes de Integração
 * Execute com: npm test (backend deve estar rodando em localhost:3001)
 * Requerimentos: Node.js 18+ (fetch nativo), speakeasy instalado
 */

require('dotenv').config({ path: '../.env' });
const speakeasy = require('speakeasy');

const BASE_URL   = process.env.TEST_API_URL || 'http://localhost:3001';
const TEST_EMAIL = `teste_${Date.now()}@cryptovault.test`;
const TEST_PASS  = 'SenhaSegura123!';

let authToken  = null;
let totpSecret = null;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log('✅ PASSOU');
    passed++;
  } catch (err) {
    console.log(`❌ FALHOU: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data     = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     🧪  CryptoVault — Testes            ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  API: ${BASE_URL.padEnd(35)}║`);
  console.log(`║  Email de teste: ${TEST_EMAIL.substring(0, 24).padEnd(24)}║`);
  console.log('╚══════════════════════════════════════════╝\n');

  // ── 1. Health check ──────────────────────────────────────
  await test('Health check da API', async () => {
    const { status, data } = await api('/health');
    assert(status === 200, `Esperava 200, recebeu ${status}`);
    assert(data.status === 'ok', 'Status deveria ser "ok"');
  });

  // ── 2. Cadastro ──────────────────────────────────────────
  await test('Cadastro com email e senha válidos', async () => {
    const { status, data } = await api('/api/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
    });
    assert(status === 201, `Esperava 201, recebeu ${status}: ${data.error}`);
    assert(data.qrCode,     'Resposta deve conter qrCode');
    assert(data.backupCode, 'Resposta deve conter backupCode');
    totpSecret = data.backupCode;
    console.log(`\n     Secret TOTP: ${totpSecret.substring(0, 20)}...`);
  });

  // ── 3. Cadastro duplicado ────────────────────────────────
  await test('Cadastro com email já existente deve falhar (409)', async () => {
    const { status, data } = await api('/api/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
    });
    assert(status === 409, `Esperava 409, recebeu ${status}`);
    assert(data.error, 'Resposta deve conter mensagem de erro');
  });

  // ── 4. Login com senha errada ────────────────────────────
  await test('Login com senha incorreta deve falhar (401)', async () => {
    const totpCode = speakeasy.totp({ secret: totpSecret, encoding: 'base32' });
    const { status, data } = await api('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email: TEST_EMAIL, password: 'senhaErrada!', totpCode }),
    });
    assert(status === 401, `Esperava 401, recebeu ${status}`);
    assert(data.error, 'Resposta deve conter mensagem de erro');
  });

  // ── 5. Login com código 2FA errado ───────────────────────
  await test('Login com código 2FA incorreto deve falhar (401)', async () => {
    const { status, data } = await api('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS, totpCode: '000000' }),
    });
    assert(status === 401, `Esperava 401, recebeu ${status}`);
    assert(data.error, 'Resposta deve conter mensagem de erro');
  });

  // ── 6. Login correto ─────────────────────────────────────
  await test('Login com credenciais corretas deve funcionar (200)', async () => {
    const totpCode = speakeasy.totp({ secret: totpSecret, encoding: 'base32' });
    const { status, data } = await api('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS, totpCode }),
    });
    assert(status === 200, `Esperava 200, recebeu ${status}: ${data.error}`);
    assert(data.token, 'Resposta deve conter JWT token');
    authToken = data.token;
    console.log('\n     Token JWT obtido com sucesso.');
  });

  // ── 7. Acesso sem token ──────────────────────────────────
  await test('Acesso a /seeds sem token deve falhar (401)', async () => {
    const savedToken = authToken;
    authToken = null;
    const { status } = await api('/api/seeds');
    authToken = savedToken;
    assert(status === 401, `Esperava 401, recebeu ${status}`);
  });

  // ── 8. Salvar seed ───────────────────────────────────────
  console.log('\n  ⏳ Testando blockchain (pode demorar ~15s)...');
  await test('Salvar seed criptografada na blockchain', async () => {
    const { status, data } = await api('/api/seeds', {
      method: 'POST',
      body:   JSON.stringify({
        title:      'Carteira Teste Bitcoin',
        seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      }),
    });
    assert(status === 200, `Esperava 200, recebeu ${status}: ${data.error}`);
    assert(data.txHash,     'Resposta deve conter txHash');
    assert(data.blockNumber, 'Resposta deve conter blockNumber');
    console.log(`\n     TX Hash: ${data.txHash}`);
    console.log(`     Bloco: ${data.blockNumber}`);
  });

  // Aguarda a blockchain processar
  console.log('\n  ⏳ Aguardando confirmação na blockchain...');
  await new Promise(r => setTimeout(r, 5000));

  // ── 9. Listar seeds ──────────────────────────────────────
  await test('Listar seeds do usuário da blockchain', async () => {
    const { status, data } = await api('/api/seeds');
    assert(status === 200, `Esperava 200, recebeu ${status}: ${data.error}`);
    assert(Array.isArray(data.seeds), 'seeds deve ser um array');
    assert(data.seeds.length >= 1, `Deveria ter pelo menos 1 seed, tem ${data.seeds.length}`);
    console.log(`\n     Encontradas: ${data.seeds.length} seed(s)`);
  });

  // ── 10. Verificar descriptografia ────────────────────────
  await test('Seed descriptografada deve ser igual à original', async () => {
    const { status, data } = await api('/api/seeds');
    assert(status === 200, `Esperava 200, recebeu ${status}`);
    const found = data.seeds.find(s => s.title === 'Carteira Teste Bitcoin');
    assert(found, 'Seed "Carteira Teste Bitcoin" não encontrada');
    assert(
      found.seedPhrase === 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      `Seed descriptografada incorreta: "${found.seedPhrase}"`
    );
  });

  // ── Resultado ────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  ✅ Passaram: ${String(passed).padEnd(28)}║`);
  console.log(`║  ❌ Falharam: ${String(failed).padEnd(28)}║`);
  console.log('╚══════════════════════════════════════════╝\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('\n❌ Erro fatal nos testes:', err.message);
  process.exit(1);
});

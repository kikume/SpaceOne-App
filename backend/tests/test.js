/* CryptoVault — Teste de integração ponta-a-ponta (modelo zero-knowledge).
 * Simula EXATAMENTE o que o navegador faria, usando o mesmo módulo de cripto.
 * Backend deve estar rodando em localhost:3001.  Uso: npm test */

if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;
const speakeasy = require('speakeasy');
const Vault     = require('../../frontend/src/crypto.js');

const BASE     = process.env.TEST_API_URL || 'http://localhost:3001';
const email    = `t_${Date.now()}@cryptovault.test`;
const password = 'SenhaForte123!';
const SEED     = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

let pass = 0, fail = 0;
async function test(name, fn) {
  try { await fn(); console.log('  ✅', name); pass++; }
  catch (e) { console.log('  ❌', name, '→', e.message); fail++; }
}
const assert  = (c, m) => { if (!c) throw new Error(m || 'falhou'); };
const eqBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
const saltOf = async () => (await api(`/api/auth/params?email=${encodeURIComponent(email)}`)).data.kdfSalt;
const totp   = (s) => speakeasy.totp({ secret: s, encoding: 'base32' });

(async () => {
  console.log(`\n🧪 CryptoVault E2E — ${email}\n`);
  let reg, totpSecret, token, dek, seedId;

  await test('health', async () => {
    const { status, data } = await api('/health');
    assert(status === 200 && data.status === 'ok');
  });

  await test('cadastro envia só material cifrado (sem senha/seed)', async () => {
    reg = await Vault.buildRegistration(email, password);
    assert(!JSON.stringify(reg.payload).includes(password), 'payload vazou a senha!');
    const { status, data } = await api('/api/auth/register', { method: 'POST', body: reg.payload });
    assert(status === 201, `status ${status} ${data.error || ''}`);
    assert(data.qrCode && data.totpSecret, 'faltou qrCode/totpSecret');
    totpSecret = data.totpSecret;
  });

  await test('cadastro duplicado do mesmo email → 409', async () => {
    const { status } = await api('/api/auth/register', { method: 'POST', body: reg.payload });
    assert(status === 409, `veio ${status}`);
  });

  await test('login de email inexistente → 401 (não 500)', async () => {
    const d = await Vault.deriveLogin('qualquer', 'AAAAAAAAAAAAAAAAAAAAAA==');
    const { status } = await api('/api/auth/login', { method: 'POST', body: { email: `naoexiste_${Date.now()}@x.com`, authKey: d.authKey, totpCode: '123456' } });
    assert(status === 401, `veio ${status}`);
  });

  await test('login com SENHA errada → 401', async () => {
    const d = await Vault.deriveLogin('senhaErrada!', await saltOf());
    const { status } = await api('/api/auth/login', { method: 'POST', body: { email, authKey: d.authKey, totpCode: totp(totpSecret) } });
    assert(status === 401, `veio ${status}`);
  });

  await test('login com 2FA errado → 401', async () => {
    const d = await Vault.deriveLogin(password, await saltOf());
    const { status } = await api('/api/auth/login', { method: 'POST', body: { email, authKey: d.authKey, totpCode: '000000' } });
    assert(status === 401, `veio ${status}`);
  });

  await test('login correto → token + desembrulha a DEK', async () => {
    const d = await Vault.deriveLogin(password, await saltOf());
    const { status, data } = await api('/api/auth/login', { method: 'POST', body: { email, authKey: d.authKey, totpCode: totp(totpSecret) } });
    assert(status === 200, `status ${status} ${data.error || ''}`);
    assert(data.token, 'sem token'); token = data.token;
    dek = await Vault.unwrapDek(d.kek, data.wrappedDekPw);
    assert(eqBytes(dek, reg.dek), 'DEK não bateu');
  });

  await test('GET /seeds sem token → 401', async () => {
    const { status } = await api('/api/seeds');
    assert(status === 401, `veio ${status}`);
  });

  await test('salvar seed (cifrada no cliente, blob não vaza)', async () => {
    const blob = await Vault.encryptSeed(dek, 'Carteira BTC', SEED);
    assert(!blob.includes('abandon'), 'blob vazou a seed!');
    const { status, data } = await api('/api/seeds', { method: 'POST', body: { blob }, token });
    assert(status === 201, `status ${status} ${data.error || ''}`); seedId = data.id;
  });

  await test('listar e DECIFRAR a seed', async () => {
    const { status, data } = await api('/api/seeds', { token });
    assert(status === 200 && data.seeds.length === 1, `qtd ${data.seeds?.length}`);
    const out = await Vault.decryptSeed(dek, data.seeds[0].blob);
    assert(out.title === 'Carteira BTC', `título ${out.title}`);
    assert(out.seedPhrase === SEED, 'seed não bateu');
  });

  await test('deletar a seed', async () => {
    const { status } = await api(`/api/seeds/${seedId}`, { method: 'DELETE', token });
    assert(status === 200, `veio ${status}`);
    const { data } = await api('/api/seeds', { token });
    assert(data.seeds.length === 0, 'deveria estar vazio');
  });

  await test('RECUPERAÇÃO pelo código → redefine senha → login novo', async () => {
    const { data: rp } = await api(`/api/auth/recovery-params?email=${encodeURIComponent(email)}`);
    const r = await Vault.deriveRecovery(reg.recoveryCode, rp.kdfSaltRc);
    const { status: vs, data: vd } = await api('/api/auth/recover/verify', { method: 'POST', body: { email, recAuthKey: r.recAuthKey } });
    assert(vs === 200 && vd.recoveryToken, `verify ${vs}`);
    const dekRec = await Vault.unwrapDek(r.kek, vd.wrappedDekRc);
    assert(eqBytes(dekRec, reg.dek), 'DEK recuperada não bateu');

    const reset = await Vault.buildPasswordReset('NovaSenha456!', dekRec);
    const { status: cs } = await api('/api/auth/recover/commit', { method: 'POST', body: { recoveryToken: vd.recoveryToken, newAuthKey: reset.authKey, newKdfSalt: reset.kdfSalt, newWrappedDekPw: reset.wrappedDekPw } });
    assert(cs === 200, `commit ${cs}`);

    const d2 = await Vault.deriveLogin('NovaSenha456!', await saltOf());
    const { status: ls, data: ld } = await api('/api/auth/login', { method: 'POST', body: { email, authKey: d2.authKey, totpCode: totp(totpSecret) } });
    assert(ls === 200, `login nova senha ${ls}`);
    const dek2 = await Vault.unwrapDek(d2.kek, ld.wrappedDekPw);
    assert(eqBytes(dek2, reg.dek), 'DEK após reset não bateu');
  });

  console.log(`\n${'='.repeat(40)}\n  ✅ Passaram: ${pass}    ❌ Falharam: ${fail}\n${'='.repeat(40)}\n`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });

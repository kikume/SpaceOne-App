/* Verificação da cripto do desbloqueio rápido (parte testável em Node).
 * Shim de localStorage; WebCrypto é nativo no Node 18+. Uso: node verify-devicelock.js */

if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;
const _mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (_mem.has(k) ? _mem.get(k) : null),
  setItem: (k, v) => _mem.set(k, String(v)),
  removeItem: (k) => _mem.delete(k),
};

const DL = require('./frontend/src/deviceLock.js');

let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); console.log('  ✅', name); pass++; } catch (e) { console.log('  ❌', name, '→', e.message); fail++; } }
const assert = (c, m) => { if (!c) throw new Error(m || 'falhou'); };
const eqBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

(async () => {
  console.log('\n🧪 deviceLock — cripto do PIN\n');
  const email = 'user@example.com';
  const dek = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const refresh = 'rt_' + 'a'.repeat(40);
  const PIN = '135790';

  await test('antes de ativar: isEnabled() == false', async () => {
    assert(DL.isEnabled() === false);
  });

  await test('enrollPin ativa o desbloqueio', async () => {
    await DL.enrollPin({ email, pin: PIN, dek, refreshToken: refresh });
    assert(DL.isEnabled() === true, 'deveria estar ativo');
    assert(DL.enabledEmail() === email, 'email errado');
  });

  await test('unlockPin com PIN certo devolve DEK + refresh idênticos', async () => {
    const r = await DL.unlockPin(PIN);
    assert(eqBytes(r.dek, dek), 'DEK não bateu');
    assert(r.refreshToken === refresh, 'refresh não bateu');
    assert(r.email === email, 'email não bateu');
  });

  await test('verifyPin (trava por seed) passa com PIN certo + DEK certa', async () => {
    assert(await DL.verifyPin(PIN, dek) === true);
  });

  await test('verifyPin falha (lança) com PIN errado', async () => {
    let threw = false;
    try { await DL.verifyPin('000000', dek); } catch { threw = true; }
    assert(threw, 'deveria lançar');
    // limpa o contador acertando de novo
    await DL.verifyPin(PIN, dek);
  });

  await test('unlockPin com PIN errado lança e conta tentativa', async () => {
    let msg = '';
    try { await DL.unlockPin('999999'); } catch (e) { msg = e.message; }
    assert(/restante/.test(msg), 'esperava aviso de tentativas restantes, veio: ' + msg);
    assert(DL.isEnabled() === true, 'ainda deve estar ativo após 1 erro');
    await DL.unlockPin(PIN); // reseta o contador
  });

  await test('5 erros seguidos AUTO-APAGAM o desbloqueio (anti-brute-force)', async () => {
    let wiped = false;
    for (let i = 0; i < DL.MAX_PIN_FAILS; i++) {
      try { await DL.unlockPin('000001'); } catch (e) { if (/Limite excedido/.test(e.message)) wiped = true; }
    }
    assert(wiped, 'deveria ter avisado limite excedido');
    assert(DL.isEnabled() === false, 'registro deveria ter sido apagado');
  });

  await test('após auto-apagar, unlockPin não funciona mais', async () => {
    let threw = false;
    try { await DL.unlockPin(PIN); } catch { threw = true; }
    assert(threw, 'deveria lançar (não está mais ativo)');
  });

  console.log(`\n${'='.repeat(40)}\n  ✅ Passaram: ${pass}    ❌ Falharam: ${fail}\n${'='.repeat(40)}\n`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });

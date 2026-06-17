/* Verificação da criptografia E2E — roda no Node, simulando o navegador.
 * Uso: node verify-crypto.js
 * Prova: cadastro -> login -> cifrar/decifrar seed -> recuperação -> senha errada. */

if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;

const Vault = require('./frontend/src/crypto.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { console.log('  ✅', name); pass++; }
  else      { console.log('  ❌', name); fail++; }
}
const eqBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

(async () => {
  const email = 'user@example.com';
  const password = 'SenhaForte123!';
  const SEED = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  console.log('\n=== 1. CADASTRO ===');
  const reg = await Vault.buildRegistration(email, password);
  const server = { ...reg.payload }; // o que o "servidor" guardaria
  check('payload tem authKey', !!server.authKey);
  check('payload tem 2 cópias embrulhadas da DEK', !!server.wrappedDekPw && !!server.wrappedDekRc);
  check('código de recuperação no formato XXXX-XXXX-...', /^([A-Z0-9]{4}-){4}[A-Z0-9]{4}$/.test(reg.recoveryCode));
  console.log('     recoveryCode (mostrado 1x):', reg.recoveryCode);

  console.log('\n=== 2. LOGIN (senha certa) ===');
  const login = await Vault.deriveLogin(password, server.kdfSalt);
  check('authKey do login == authKey guardado', login.authKey === server.authKey);
  const dekLogin = await Vault.unwrapDek(login.kek, server.wrappedDekPw);
  check('DEK desembrulhada == DEK original', eqBytes(dekLogin, reg.dek));

  console.log('\n=== 3. CIFRAR / DECIFRAR SEED ===');
  const blob = await Vault.encryptSeed(dekLogin, 'Carteira Bitcoin', SEED);
  check('blob é string base64 não-vazia', typeof blob === 'string' && blob.length > 0);
  check('blob NÃO contém a seed em texto', !blob.includes('abandon'));
  const dataOther = await Vault.decryptSeed(reg.dek, blob);
  check('decifra título corretamente', dataOther.title === 'Carteira Bitcoin');
  check('decifra seed corretamente', dataOther.seedPhrase === SEED);

  console.log('\n=== 4. RECUPERAÇÃO (esqueceu a senha) ===');
  const rec = await Vault.deriveRecovery(reg.recoveryCode, server.kdfSaltRc);
  check('recAuthKey == guardado', rec.recAuthKey === server.recAuthKey);
  const dekRec = await Vault.unwrapDek(rec.kek, server.wrappedDekRc);
  check('DEK recuperada == DEK original', eqBytes(dekRec, reg.dek));

  // re-embrulha para uma nova senha
  const reset = await Vault.buildPasswordReset('NovaSenha456!', dekRec);
  const login2 = await Vault.deriveLogin('NovaSenha456!', reset.kdfSalt);
  check('login com a NOVA senha == novo authKey', login2.authKey === reset.authKey);
  const dekNew = await Vault.unwrapDek(login2.kek, reset.wrappedDekPw);
  check('DEK após reset == DEK original', eqBytes(dekNew, reg.dek));
  // a seed antiga continua decifrável com a mesma DEK
  const stillOk = await Vault.decryptSeed(dekNew, blob);
  check('seed antiga ainda decifra após troca de senha', stillOk.seedPhrase === SEED);

  console.log('\n=== 5. SENHA ERRADA NÃO DECIFRA ===');
  const wrong = await Vault.deriveLogin('senhaErrada!!', server.kdfSalt);
  check('authKey errado != guardado (servidor rejeita no login)', wrong.authKey !== server.authKey);
  let threw = false;
  try { await Vault.unwrapDek(wrong.kek, server.wrappedDekPw); } catch { threw = true; }
  check('desembrulhar a DEK com senha errada LANÇA erro (AES-GCM)', threw);

  console.log(`\n${'='.repeat(44)}`);
  console.log(`  ✅ Passaram: ${pass}    ❌ Falharam: ${fail}`);
  console.log('='.repeat(44) + '\n');
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });

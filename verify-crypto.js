/* Verificação da criptografia E2E v2 (Argon2id + Chave-Secreta). Roda no Node.
 * Uso: node verify-crypto.js */

if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;
const Vault = require('./frontend/src/crypto.js');

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { console.log('  ✅', name); pass++; } else { console.log('  ❌', name); fail++; } }
const eqBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

(async () => {
  const email = 'user@example.com';
  const password = 'SenhaForte123!';
  const SEED = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  console.log('\n=== 1. CADASTRO (gera Chave-Secreta) ===');
  const reg = await Vault.buildRegistration(email, password);
  const server = { ...reg.payload };
  check('payload tem authKey + 2 DEKs embrulhadas', !!server.authKey && !!server.wrappedDekPw && !!server.wrappedDekRc);
  check('código de recuperação no formato certo', /^([A-Z0-9]{4}-){4}[A-Z0-9]{4}$/.test(reg.recoveryCode));
  check('Chave-Secreta no formato CV1-XXXXX-...', /^CV1-([A-Z0-9]{5}-){4}[A-Z0-9]{5}$/.test(reg.secretKey));
  console.log('     secretKey:', reg.secretKey);

  console.log('\n=== 2. LOGIN (senha + Chave-Secreta corretas) ===');
  const login = await Vault.deriveLogin(password, server.kdfSalt, reg.secretKey);
  check('authKey == guardado', login.authKey === server.authKey);
  const dekLogin = await Vault.unwrapDek(login.kek, server.wrappedDekPw);
  check('DEK desembrulhada == original', eqBytes(dekLogin, reg.dek));

  console.log('\n=== 3. CHAVE-SECRETA é obrigatória ===');
  const semSK = await Vault.deriveLogin(password, server.kdfSalt, '');           // sem chave-secreta
  check('senha certa SEM Chave-Secreta -> authKey DIFERENTE (servidor rejeita)', semSK.authKey !== server.authKey);
  let semSKFalha = false;
  try { await Vault.unwrapDek(semSK.kek, server.wrappedDekPw); } catch { semSKFalha = true; }
  check('sem Chave-Secreta NÃO desembrulha a DEK', semSKFalha);
  const skErrada = await Vault.deriveLogin(password, server.kdfSalt, 'CV1-AAAAA-AAAAA-AAAAA-AAAAA');
  check('Chave-Secreta ERRADA -> authKey diferente', skErrada.authKey !== server.authKey);

  console.log('\n=== 4. CIFRAR / DECIFRAR SEED ===');
  const blob = await Vault.encryptSeed(dekLogin, 'Carteira Bitcoin', SEED);
  check('blob não contém a seed em texto', !blob.includes('abandon'));
  const out = await Vault.decryptSeed(reg.dek, blob);
  check('decifra título e seed corretamente', out.title === 'Carteira Bitcoin' && out.seedPhrase === SEED);

  console.log('\n=== 5. RECUPERAÇÃO (código, sem Chave-Secreta) ===');
  const rec = await Vault.deriveRecovery(reg.recoveryCode, server.kdfSaltRc);
  check('recAuthKey == guardado', rec.recAuthKey === server.recAuthKey);
  const dekRec = await Vault.unwrapDek(rec.kek, server.wrappedDekRc);
  check('DEK recuperada == original', eqBytes(dekRec, reg.dek));
  // reset de senha precisa da Chave-Secreta
  const reset = await Vault.buildPasswordReset('NovaSenha456!', dekRec, reg.secretKey);
  const login2 = await Vault.deriveLogin('NovaSenha456!', reset.kdfSalt, reg.secretKey);
  check('login pós-reset (nova senha + Chave-Secreta) == novo authKey', login2.authKey === reset.authKey);
  const dekNew = await Vault.unwrapDek(login2.kek, reset.wrappedDekPw);
  check('DEK após reset == original', eqBytes(dekNew, reg.dek));

  console.log('\n=== 6. SENHA ERRADA não decifra ===');
  const wrong = await Vault.deriveLogin('senhaErrada!!', server.kdfSalt, reg.secretKey);
  check('senha errada -> authKey diferente', wrong.authKey !== server.authKey);
  let wrongFalha = false;
  try { await Vault.unwrapDek(wrong.kek, server.wrappedDekPw); } catch { wrongFalha = true; }
  check('senha errada NÃO desembrulha (AES-GCM)', wrongFalha);

  console.log(`\n${'='.repeat(44)}\n  ✅ Passaram: ${pass}    ❌ Falharam: ${fail}\n${'='.repeat(44)}\n`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });

/* ============================================================
 * CryptoVault — Criptografia de ponta-a-ponta (lado do cliente)
 *
 * Módulo ISOMÓRFICO: usa a Web Crypto API (globalThis.crypto.subtle),
 * que existe tanto no navegador quanto no Node 18+. Por isso o mesmo
 * arquivo é importado pelo React E testado no Node.
 *
 * MODELO (envelope encryption):
 *   - DEK  = chave aleatória de 256 bits que cifra de fato as seeds.
 *   - A senha do usuário deriva (PBKDF2 + HKDF):
 *        authKey  -> enviado ao servidor (que guarda só o bcrypt dele)
 *        KEK_pw   -> "embrulha" (cifra) a DEK. Nunca sai do navegador.
 *   - O código de recuperação deriva, do mesmo jeito, KEK_rc, que
 *     embrulha uma SEGUNDA cópia da DEK.
 *   - O servidor guarda: authKey-bcrypt, salts (não-secretos) e as duas
 *     cópias EMBRULHADAS da DEK. Sozinho, ele não descriptografa nada.
 * ============================================================ */

const SUBTLE = () => globalThis.crypto.subtle;
const RAND   = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// OWASP 2023 recomenda >= 600k iterações para PBKDF2-HMAC-SHA256
const PBKDF2_ITERS = 600_000;
const textEnc = new TextEncoder();
const textDec = new TextDecoder();

// ── Helpers base64 / hex (funcionam em browser e Node) ──────
function b64enc(bytes) {
  // btoa/atob existem no navegador e no Node 18+
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64dec(str) {
  const s = atob(str);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}
function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Primitivas ──────────────────────────────────────────────
async function pbkdf2Bits(secret, saltBytes) {
  const base = await SUBTLE().importKey('raw', textEnc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await SUBTLE().deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base, 256
  );
  return new Uint8Array(bits);
}

async function hkdf(ikm, info, length = 32) {
  const key = await SUBTLE().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await SUBTLE().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: textEnc.encode(info) },
    key, length * 8
  );
  return new Uint8Array(bits);
}

async function aesEncrypt(keyBytes, plaintextBytes) {
  const key = await SUBTLE().importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv  = RAND(12);
  const ct  = new Uint8Array(await SUBTLE().encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return b64enc(out);
}

async function aesDecrypt(keyBytes, b64) {
  const data = b64dec(b64);
  const iv   = data.slice(0, 12);
  const ct   = data.slice(12);
  const key  = await SUBTLE().importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const pt   = await SUBTLE().decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new Uint8Array(pt);
}

/** De um segredo (senha ou código de recuperação) + salt, deriva o
 *  authKey (vai ao servidor) e a KEK (embrulha a DEK, fica no cliente). */
async function deriveFromSecret(secret, saltBytes) {
  const ikm     = await pbkdf2Bits(secret, saltBytes);
  const authKey = await hkdf(ikm, 'cryptovault-auth-v1', 32);
  const kek     = await hkdf(ikm, 'cryptovault-wrap-v1', 32);
  return { authKeyHex: toHex(authKey), kek };
}

/** Código de recuperação legível: 20 bytes em base32 (Crockford), grupos de 4. */
function generateRecoveryCode() {
  const ALPH = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';
  const bytes = RAND(20);
  let s = '';
  for (const b of bytes) s += ALPH[b % 32];
  return s.match(/.{1,4}/g).join('-');
}

// ════════════════════════════════════════════════════════════
//  FLUXOS DE ALTO NÍVEL (usados pelo React)
// ════════════════════════════════════════════════════════════

/** CADASTRO: gera DEK + código de recuperação, embrulha a DEK 2x.
 *  Retorna { payload (p/ servidor), recoveryCode (mostrar 1x), dek }. */
async function buildRegistration(email, password) {
  const salt   = RAND(16);
  const saltRc = RAND(16);
  const dek    = RAND(32);
  const recoveryCode = generateRecoveryCode();

  const pw = await deriveFromSecret(password, salt);
  const rc = await deriveFromSecret(recoveryCode.replace(/-/g, ''), saltRc);

  return {
    payload: {
      email,
      authKey:       pw.authKeyHex,
      recAuthKey:    rc.authKeyHex,
      kdfSalt:       b64enc(salt),
      kdfSaltRc:     b64enc(saltRc),
      wrappedDekPw:  await aesEncrypt(pw.kek, dek),
      wrappedDekRc:  await aesEncrypt(rc.kek, dek),
    },
    recoveryCode,
    dek,
  };
}

/** LOGIN passo 1: deriva authKey + KEK a partir da senha e do salt (do servidor). */
async function deriveLogin(password, kdfSaltB64) {
  const { authKeyHex, kek } = await deriveFromSecret(password, b64dec(kdfSaltB64));
  return { authKey: authKeyHex, kek };
}

/** LOGIN passo 2: desembrulha a DEK usando a KEX + a cópia embrulhada do servidor. */
async function unwrapDek(kek, wrappedDekB64) {
  return aesDecrypt(kek, wrappedDekB64); // lança se a senha estiver errada (GCM falha)
}

/** RECUPERAÇÃO: deriva a partir do código de recuperação + saltRc. */
async function deriveRecovery(recoveryCode, kdfSaltRcB64) {
  const { authKeyHex, kek } = await deriveFromSecret(recoveryCode.replace(/-/g, ''), b64dec(kdfSaltRcB64));
  return { recAuthKey: authKeyHex, kek };
}

/** Reset de senha: com a DEK em mãos, re-embrulha para a nova senha. */
async function buildPasswordReset(newPassword, dek) {
  const salt = RAND(16);
  const { authKeyHex, kek } = await deriveFromSecret(newPassword, salt);
  return {
    authKey:      authKeyHex,
    kdfSalt:      b64enc(salt),
    wrappedDekPw: await aesEncrypt(kek, dek),
  };
}

/** Cifra uma seed (título + frase juntos) com a DEK. Retorna blob base64. */
async function encryptSeed(dek, title, seedPhrase) {
  const plaintext = textEnc.encode(JSON.stringify({ title, seedPhrase }));
  return aesEncrypt(dek, plaintext);
}

/** Decifra um blob com a DEK. Retorna { title, seedPhrase }. */
async function decryptSeed(dek, blobB64) {
  const pt = await aesDecrypt(dek, blobB64);
  return JSON.parse(textDec.decode(pt));
}

const Vault = {
  buildRegistration,
  deriveLogin,
  unwrapDek,
  deriveRecovery,
  buildPasswordReset,
  encryptSeed,
  decryptSeed,
  generateRecoveryCode,
};

module.exports = Vault;

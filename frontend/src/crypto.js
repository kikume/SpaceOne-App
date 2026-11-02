/* ============================================================
 * SpaceOne — Criptografia de ponta-a-ponta (lado do cliente) — v2
 *
 * Módulo ISOMÓRFICO (Web Crypto API). Reforços da v2:
 *   - ARGON2id (memory-hard) no lugar do PBKDF2 — muito mais resistente a
 *     força bruta com GPU. (@noble/hashes, JS puro auditado.)
 *   - CHAVE-SECRETA (estilo 1Password): uma chave de alta entropia, gerada no
 *     cadastro e guardada só pelo usuário. Ela é misturada (como salt do HKDF)
 *     na derivação a partir da senha. Resultado: mesmo que a SENHA vaze, sem a
 *     Chave-Secreta ninguém deriva a chave do cofre.
 *
 * MODELO (envelope): uma DEK aleatória cifra as seeds. A DEK é embrulhada por:
 *   - KEK derivada de (senha + Chave-Secreta)  -> wrappedDekPw
 *   - KEK derivada do código de recuperação     -> wrappedDekRc (escape hatch)
 * O servidor é cego: guarda só verificadores, salts e blobs cifrados.
 * ============================================================ */
/* global globalThis */
const { argon2id } = require('@noble/hashes/argon2.js');

const SUBTLE = () => globalThis.crypto.subtle;
const RAND   = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// Argon2id: OWASP — m=19 MiB, t=2, p=1 (equilíbrio bom inclusive em celular)
const ARGON  = { t: 2, m: 19456, p: 1, dkLen: 32 };
const textEnc = new TextEncoder();
const textDec = new TextDecoder();

// ── base64 / hex ─────────────────────────────────────────────
function b64enc(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function b64dec(str)   { const s = atob(str); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function toHex(bytes)  { return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''); }

// ── Primitivas ───────────────────────────────────────────────
function argon2Bits(secret, saltBytes) {
  return argon2id(textEnc.encode(secret), saltBytes, ARGON); // Uint8Array(32)
}

async function hkdf(ikm, info, length = 32, saltBytes = new Uint8Array(0)) {
  const key  = await SUBTLE().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await SUBTLE().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: textEnc.encode(info) },
    key, length * 8
  );
  return new Uint8Array(bits);
}

async function aesEncrypt(keyBytes, plaintextBytes) {
  const key = await SUBTLE().importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv  = RAND(12);
  const ct  = new Uint8Array(await SUBTLE().encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv, 0); out.set(ct, iv.length);
  return b64enc(out);
}
async function aesDecrypt(keyBytes, b64) {
  const data = b64dec(b64); const iv = data.slice(0, 12); const ct = data.slice(12);
  const key  = await SUBTLE().importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  return new Uint8Array(await SUBTLE().decrypt({ name: 'AES-GCM', iv }, key, ct));
}

const normalizeSecretKey = (sk) => String(sk || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Deriva authKey (vai ao servidor) + KEK (embrulha a DEK, fica no cliente).
 *  Se `secretKey` for informado, ele é misturado como salt do HKDF — então a
 *  derivação SÓ reproduz com a Chave-Secreta correta. */
async function deriveFromSecret(secret, saltBytes, secretKey) {
  const pwBits = argon2Bits(secret, saltBytes);
  const mixSalt = secretKey ? textEnc.encode(normalizeSecretKey(secretKey)) : new Uint8Array(0);
  const master  = await hkdf(pwBits, 'cryptovault-master-v2', 32, mixSalt);
  const authKey = await hkdf(master, 'cryptovault-auth-v2', 32);
  const kek     = await hkdf(master, 'cryptovault-wrap-v2', 32);
  return { authKeyHex: toHex(authKey), kek };
}

/** Código legível em base32 (Crockford), grupos de `g`. */
function randomCode(bytesLen, groups, groupSize) {
  const ALPH = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';
  const bytes = RAND(bytesLen);
  let s = '';
  for (const b of bytes) s += ALPH[b % 32];
  return s.slice(0, groups * groupSize).match(new RegExp(`.{1,${groupSize}}`, 'g')).join('-');
}
const generateRecoveryCode = () => randomCode(20, 5, 4);                 // XXXX-XXXX-XXXX-XXXX-XXXX
const generateSecretKey    = () => 'CV1-' + randomCode(25, 5, 5);        // CV1-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX (125 bits)

// ════════════════════════════════════════════════════════════
//  FLUXOS DE ALTO NÍVEL
// ════════════════════════════════════════════════════════════

/** CADASTRO: gera DEK + código de recuperação + CHAVE-SECRETA. */
async function buildRegistration(email, password) {
  const salt   = RAND(16);
  const saltRc = RAND(16);
  const dek    = RAND(32);
  const recoveryCode = generateRecoveryCode();
  const secretKey    = generateSecretKey();

  const pw = await deriveFromSecret(password, salt, secretKey);  // senha + chave-secreta
  const rc = await deriveFromSecret(recoveryCode, saltRc);       // recuperação: sem chave-secreta

  return {
    payload: {
      email,
      authKey:      pw.authKeyHex,
      recAuthKey:   rc.authKeyHex,
      kdfSalt:      b64enc(salt),
      kdfSaltRc:    b64enc(saltRc),
      wrappedDekPw: await aesEncrypt(pw.kek, dek),
      wrappedDekRc: await aesEncrypt(rc.kek, dek),
    },
    recoveryCode,
    secretKey,
    dek,
  };
}

/** LOGIN passo 1: deriva authKey + KEK a partir de senha + Chave-Secreta + salt. */
async function deriveLogin(password, kdfSaltB64, secretKey) {
  const { authKeyHex, kek } = await deriveFromSecret(password, b64dec(kdfSaltB64), secretKey);
  return { authKey: authKeyHex, kek };
}

/** LOGIN passo 2: desembrulha a DEK. */
async function unwrapDek(kek, wrappedDekB64) {
  return aesDecrypt(kek, wrappedDekB64);
}

/** RECUPERAÇÃO: deriva do código de recuperação (sem Chave-Secreta). */
async function deriveRecovery(recoveryCode, kdfSaltRcB64) {
  const { authKeyHex, kek } = await deriveFromSecret(recoveryCode, b64dec(kdfSaltRcB64));
  return { recAuthKey: authKeyHex, kek };
}

/** Reset de senha: re-embrulha a DEK para a nova senha + a Chave-Secreta. */
async function buildPasswordReset(newPassword, dek, secretKey) {
  const salt = RAND(16);
  const { authKeyHex, kek } = await deriveFromSecret(newPassword, salt, secretKey);
  return { authKey: authKeyHex, kdfSalt: b64enc(salt), wrappedDekPw: await aesEncrypt(kek, dek) };
}

/** Cifra uma seed (título + frase) com a DEK. */
async function encryptSeed(dek, title, seedPhrase) {
  return aesEncrypt(dek, textEnc.encode(JSON.stringify({ title, seedPhrase })));
}
/** Decifra um blob com a DEK. */
async function decryptSeed(dek, blobB64) {
  return JSON.parse(textDec.decode(await aesDecrypt(dek, blobB64)));
}

const Vault = {
  buildRegistration, deriveLogin, unwrapDek, deriveRecovery, buildPasswordReset,
  encryptSeed, decryptSeed, generateRecoveryCode, generateSecretKey,
};

module.exports = Vault;

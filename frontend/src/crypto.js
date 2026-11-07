/* ============================================================
 * SpaceOne — Local, client-side cryptography
 *
 * MODEL (envelope encryption):
 *   password → Argon2id (memory-hard) → HKDF → KEK
 *   The KEK wraps the DEK (a random 32-byte key), and the DEK
 *   encrypts the seeds with AES-256-GCM. The password is never
 *   stored: a wrong password derives a different KEK, and GCM
 *   authentication simply fails — there is no "access denied",
 *   only noise.
 *
 * Argon2id parameters: OWASP — m=19 MiB, t=2, p=1
 * (a good balance of GPU resistance and mobile performance).
 * ============================================================ */
/* global globalThis */
const { argon2id } = require('@noble/hashes/argon2.js');

const SUBTLE = () => globalThis.crypto.subtle;
const RAND   = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

const ARGON  = { t: 2, m: 19456, p: 1, dkLen: 32 };
const textEnc = new TextEncoder();
const textDec = new TextDecoder();

// ── base64 ───────────────────────────────────────────────────
function b64enc(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function b64dec(str)   { const s = atob(str); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

// ── Primitives ───────────────────────────────────────────────
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

/** Derives the KEK from a secret (the password) + salt.
 *  The HKDF info labels are FROZEN for compatibility: changing
 *  them would make every existing vault and backup unreadable. */
async function deriveFromSecret(secret, saltBytes) {
  const pwBits  = argon2Bits(secret, saltBytes);
  const master  = await hkdf(pwBits, 'cryptovault-master-v2', 32, new Uint8Array(0));
  const kek     = await hkdf(master, 'cryptovault-wrap-v2', 32);
  return { kek };
}

// ════════════════════════════════════════════════════════════
//  PUBLIC API
// ════════════════════════════════════════════════════════════

/** Creates the lock: derives a KEK from the password and wraps the DEK (new or existing). */
async function createPasswordLock(password, existingDek) {
  const salt = RAND(16);
  const dek  = existingDek || RAND(32);
  const { kek } = await deriveFromSecret(password, salt);
  return { kdfSalt: b64enc(salt), wrappedDek: await aesEncrypt(kek, dek), dek };
}

/** Opens the lock: the correct password returns the DEK; a wrong one throws. */
async function openPasswordLock(password, kdfSaltB64, wrappedDekB64) {
  const { kek } = await deriveFromSecret(password, b64dec(kdfSaltB64));
  return aesDecrypt(kek, wrappedDekB64);
}

/** Encrypts a seed (title + phrase) with the DEK. */
async function encryptSeed(dek, title, seedPhrase) {
  return aesEncrypt(dek, textEnc.encode(JSON.stringify({ title, seedPhrase })));
}

/** Decrypts a blob with the DEK. */
async function decryptSeed(dek, blobB64) {
  return JSON.parse(textDec.decode(await aesDecrypt(dek, blobB64)));
}

/** Encrypts any JSON-serializable value with the DEK (e.g. the vault registry). */
async function encryptData(dek, value) {
  return aesEncrypt(dek, textEnc.encode(JSON.stringify(value)));
}

/** Decrypts a blob produced by encryptData. */
async function decryptData(dek, blobB64) {
  return JSON.parse(textDec.decode(await aesDecrypt(dek, blobB64)));
}

const Vault = { createPasswordLock, openPasswordLock, encryptSeed, decryptSeed, encryptData, decryptData };

module.exports = Vault;

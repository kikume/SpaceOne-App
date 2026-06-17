/* ============================================================
 * deviceLock.js — Desbloqueio rápido por PIN / biometria (POR DISPOSITIVO)
 *
 * Depois do 1º login completo (senha + 2FA), o usuário pode "lembrar" este
 * aparelho: a DEK e um REFRESH TOKEN (emitido pelo servidor) são cifrados e
 * guardados localmente, protegidos por:
 *    - uma chave derivada do PIN (PBKDF2), e/ou
 *    - uma chave derivada de uma passkey via WebAuthn PRF (onde houver suporte).
 *
 * Reabrir o cofre = desbloquear localmente (PIN/biometria) → obtém DEK +
 * refresh token → troca o refresh por um access token novo no servidor.
 *
 * TRADE-OFF (honesto): isto guarda uma cópia CIFRADA da chave no aparelho.
 * É conveniência; a proteção passa a depender também da segurança do device
 * e da entropia do PIN. Por isso: PIN longo + auto-apagar após N erros.
 * A proteção canônica continua sendo senha + 2FA.
 * ============================================================ */
/* global globalThis */

const SUBTLE   = () => globalThis.crypto.subtle;
const RAND     = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const store    = () => globalThis.localStorage;
const textEnc  = new TextEncoder();
const textDec  = new TextDecoder();

const PIN_ITERS      = 600_000;
const MAX_PIN_FAILS  = 5;
const STORAGE_KEY    = 'cv_quickunlock_v1';

// ── base64 ───────────────────────────────────────────────────
function b64enc(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function b64dec(str)   { const s = atob(str); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
const eqBytes = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };

// ── AES-GCM wrap/unwrap ──────────────────────────────────────
async function aesWrap(keyBytes, dataBytes) {
  const key = await SUBTLE().importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv  = RAND(12);
  const ct  = new Uint8Array(await SUBTLE().encrypt({ name: 'AES-GCM', iv }, key, dataBytes));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv, 0); out.set(ct, iv.length);
  return b64enc(out);
}
async function aesUnwrap(keyBytes, b64) {
  const data = b64dec(b64); const iv = data.slice(0, 12); const ct = data.slice(12);
  const key  = await SUBTLE().importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  return new Uint8Array(await SUBTLE().decrypt({ name: 'AES-GCM', iv }, key, ct));
}
async function pinToKey(pin, saltBytes) {
  const base = await SUBTLE().importKey('raw', textEnc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await SUBTLE().deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: PIN_ITERS, hash: 'SHA-256' }, base, 256);
  return new Uint8Array(bits);
}

// ── Registro local (localStorage) ────────────────────────────
function getRecord()    { try { return JSON.parse(store().getItem(STORAGE_KEY) || 'null'); } catch { return null; } }
function setRecord(rec) { store().setItem(STORAGE_KEY, JSON.stringify(rec)); }
function clearRecord()  { store().removeItem(STORAGE_KEY); }

function isEnabled()    { return !!getRecord(); }
function enabledEmail() { const r = getRecord(); return r ? r.email : null; }
function hasBiometric() { const r = getRecord(); return !!(r && r.bio); }
function pinFailsLeft() { const r = getRecord(); return r ? MAX_PIN_FAILS - (r.fails || 0) : 0; }
function forget()       { clearRecord(); }

// ── Ativar desbloqueio por PIN ───────────────────────────────
async function enrollPin({ email, pin, dek, refreshToken }) {
  const salt = RAND(16);
  const k    = await pinToKey(pin, salt);
  const rec  = {
    email,
    pinSalt:         b64enc(salt),
    wrappedDekPin:   await aesWrap(k, dek),
    wrappedRefPin:   await aesWrap(k, textEnc.encode(refreshToken)),
    fails:           0,
    bio:             null,
  };
  setRecord(rec);
  return true;
}

// ── Desbloquear por PIN → { email, dek, refreshToken } ───────
async function unlockPin(pin) {
  const rec = getRecord();
  if (!rec) throw new Error('Desbloqueio rápido não está ativo neste aparelho');
  const k = await pinToKey(pin, b64dec(rec.pinSalt));
  try {
    const dek          = await aesUnwrap(k, rec.wrappedDekPin);
    const refreshToken = textDec.decode(await aesUnwrap(k, rec.wrappedRefPin));
    if (rec.fails) { rec.fails = 0; setRecord(rec); }
    return { email: rec.email, dek, refreshToken };
  } catch {
    rec.fails = (rec.fails || 0) + 1;
    if (rec.fails >= MAX_PIN_FAILS) {
      clearRecord();
      throw new Error('PIN incorreto. Limite excedido — desbloqueio rápido desativado. Faça login completo.');
    }
    setRecord(rec);
    throw new Error(`PIN incorreto. ${MAX_PIN_FAILS - rec.fails} tentativa(s) restante(s).`);
  }
}

// ── Verificar PIN p/ revelar uma seed (trava por seed) ───────
// Usa a DEK já em memória como "fonte da verdade": o PIN só passa se
// desembrulhar exatamente a mesma DEK. Conta erros / auto-apaga igual.
async function verifyPin(pin, currentDek) {
  const rec = getRecord();
  if (!rec) throw new Error('Desbloqueio rápido não está ativo');
  const k = await pinToKey(pin, b64dec(rec.pinSalt));
  let ok = false;
  try { ok = eqBytes(await aesUnwrap(k, rec.wrappedDekPin), currentDek); } catch { ok = false; }
  if (ok) { if (rec.fails) { rec.fails = 0; setRecord(rec); } return true; }
  rec.fails = (rec.fails || 0) + 1;
  if (rec.fails >= MAX_PIN_FAILS) { clearRecord(); throw new Error('PIN incorreto. Limite excedido — desbloqueio rápido desativado.'); }
  setRecord(rec);
  throw new Error(`PIN incorreto. ${MAX_PIN_FAILS - rec.fails} tentativa(s) restante(s).`);
}

// ════════════════════════════════════════════════════════════
//  BIOMETRIA via WebAuthn + extensão PRF (best-effort)
//  Requer contexto seguro (HTTPS ou localhost). Em celular real: HTTPS.
// ════════════════════════════════════════════════════════════
async function biometricAvailable() {
  try {
    if (!globalThis.PublicKeyCredential) return false;
    return await globalThis.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

const PRF_SALT = textEnc.encode('cryptovault-prf-v1');

async function prfSecretFromAssertion(credentialIdB64) {
  const assertion = await globalThis.navigator.credentials.get({
    publicKey: {
      challenge: RAND(32),
      allowCredentials: credentialIdB64 ? [{ id: b64dec(credentialIdB64), type: 'public-key' }] : [],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: PRF_SALT } } },
    },
  });
  const ext = assertion.getClientExtensionResults();
  if (!ext.prf || !ext.prf.results || !ext.prf.results.first) {
    throw new Error('Este dispositivo/navegador não suporta biometria com chave (PRF)');
  }
  return { secret: new Uint8Array(ext.prf.results.first), credentialId: b64enc(new Uint8Array(assertion.rawId)) };
}

async function enrollBiometric({ email, dek, refreshToken }) {
  const cred = await globalThis.navigator.credentials.create({
    publicKey: {
      challenge: RAND(32),
      rp: { name: 'CryptoVault' },
      user: { id: textEnc.encode(email).slice(0, 64), name: email, displayName: email },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      extensions: { prf: {} },
    },
  });
  const credentialId = b64enc(new Uint8Array(cred.rawId));
  // Obtém o segredo PRF (precisa de um get() após o create na maioria das plataformas)
  const { secret } = await prfSecretFromAssertion(credentialId);
  const rec = getRecord() || { email, fails: 0 };
  rec.email = email;
  rec.bio = {
    credentialId,
    wrappedDekBio: await aesWrap(secret, dek),
    wrappedRefBio: await aesWrap(secret, textEnc.encode(refreshToken)),
  };
  setRecord(rec);
  return true;
}

async function unlockBiometric() {
  const rec = getRecord();
  if (!rec || !rec.bio) throw new Error('Biometria não configurada neste aparelho');
  const { secret } = await prfSecretFromAssertion(rec.bio.credentialId);
  const dek          = await aesUnwrap(secret, rec.bio.wrappedDekBio);
  const refreshToken = textDec.decode(await aesUnwrap(secret, rec.bio.wrappedRefBio));
  return { email: rec.email, dek, refreshToken };
}

async function verifyBiometric(currentDek) {
  const { dek } = await unlockBiometric();
  return eqBytes(dek, currentDek);
}

const DeviceLock = {
  isEnabled, enabledEmail, hasBiometric, pinFailsLeft, forget,
  enrollPin, unlockPin, verifyPin,
  biometricAvailable, enrollBiometric, unlockBiometric, verifyBiometric,
  MAX_PIN_FAILS,
};

module.exports = DeviceLock;

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
//  A chave fica no Keystore nativo (Android/iOS) via biometricNative.js,
//  liberada apenas após a biometria. Aqui só embrulhamos/desembrulhamos.
// ════════════════════════════════════════════════════════════

// Gera uma bioKey aleatória, embrulha a DEK + refresh com ela, e DEVOLVE a
// bioKey (base64) para o chamador guardar no Keystore protegido por biometria.
async function enrollBiometric({ dek, refreshToken }) {
  const rec = getRecord();
  if (!rec) throw new Error('Ative o PIN antes da biometria');
  const bioKey = RAND(32);
  rec.bio = {
    wrappedDekBio: await aesWrap(bioKey, dek),
    wrappedRefBio: await aesWrap(bioKey, textEnc.encode(refreshToken)),
  };
  setRecord(rec);
  return b64enc(bioKey);
}

// Recebe a bioKey (base64, vinda do Keystore após a biometria) e desembrulha.
async function unlockBiometric(bioKeyB64) {
  const rec = getRecord();
  if (!rec || !rec.bio) throw new Error('Biometria não configurada neste aparelho');
  const bioKey       = b64dec(bioKeyB64);
  const dek          = await aesUnwrap(bioKey, rec.bio.wrappedDekBio);
  const refreshToken = textDec.decode(await aesUnwrap(bioKey, rec.bio.wrappedRefBio));
  return { email: rec.email, dek, refreshToken };
}

async function verifyBiometric(bioKeyB64, currentDek) {
  const rec = getRecord();
  if (!rec || !rec.bio) return false;
  try { return eqBytes(await aesUnwrap(b64dec(bioKeyB64), rec.bio.wrappedDekBio), currentDek); }
  catch { return false; }
}

const DeviceLock = {
  isEnabled, enabledEmail, hasBiometric, pinFailsLeft, forget,
  enrollPin, unlockPin, verifyPin,
  enrollBiometric, unlockBiometric, verifyBiometric,
  MAX_PIN_FAILS,
};

module.exports = DeviceLock;

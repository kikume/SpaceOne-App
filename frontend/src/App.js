/* ============================================================
 * SpaceOne — Local seed phrase vault (Phantom-style)
 *
 * 100% local: no account, no server. On first use you create a
 * password; afterwards the app only opens with it. The password
 * is NEVER stored: a key is derived from it (Argon2id + HKDF)
 * which wraps the vault key (AES-256-GCM). A wrong password
 * simply fails to decrypt.
 * ============================================================ */
import React, { useState, useEffect } from 'react';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import Vault from './crypto';
import './App.css';

// ── Inline icons (no external dependency) ────────────────────
const Icon = {
  Lock:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Key:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3"/></svg>,
  Eye:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Plus:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Copy:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  Trash:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Shield:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Check:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Download:() => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Upload:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  LogOut:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Gear:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Dice:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/></svg>,
  Pencil:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
};

function Spinner() {
  return <span className="cv-spinner" aria-label="Loading" />;
}

// ── Local storage ────────────────────────────────────────────
const STORE_KEY   = 'spaceone_vault_v1';  // encrypted seeds
const AUTH_KEY    = 'spaceone_auth_v2';   // { kdfSalt, wrappedDek } — the password itself is never stored
const LEGACY_DEK  = 'spaceone_dek_v1';    // old passwordless version — migrated during setup

function b64dec(str) { const s = atob(str); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

function loadAuth()  { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; } }
function saveAuth(a) { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }
function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; } }
function saveStore(items) { localStorage.setItem(STORE_KEY, JSON.stringify(items)); }

function formatDate(ts) {
  try { return new Date(ts).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; }
}

export default function App() {
  // setup (first run) | unlock (asks for password) | vault (open)
  const [view, setView]       = useState(() => (loadAuth() ? 'unlock' : 'setup'));
  const [dek, setDek]         = useState(null);    // vault key — memory ONLY
  const [seeds, setSeeds]     = useState([]);      // decrypted — memory only
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal]     = useState(null);    // {type:'add'|'view'|'changepass'|'backup'|'importpass'}
  const [seedF, setSeedF]     = useState({ title: '', seedPhrase: '' });
  const [passF, setPassF]     = useState({ password: '', confirm: '' });
  const [unlockPass, setUnlockPass] = useState('');
  const [changeF, setChangeF] = useState({ current: '', password: '', confirm: '' });
  const [importPass, setImportPass] = useState('');
  const [revealPass, setRevealPass] = useState('');
  const [renameF, setRenameF] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [copied, setCopied]   = useState(false);

  function clearMsgs() { setError(''); setSuccess(''); }
  function showSuccess(msg, ms = 4000) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), ms);
  }

  // ── With the vault open, decrypt the stored seeds ──────────
  useEffect(() => {
    if (view !== 'vault' || !dek) return;
    (async () => {
      setLoading(true);
      const out = [];
      for (const item of loadStore()) {
        try {
          const data = await Vault.decryptSeed(dek, item.blob);
          out.push({ id: item.id, title: data.title, seedPhrase: data.seedPhrase, timestamp: item.createdAt });
        } catch {
          out.push({ id: item.id, title: '(could not decrypt)', seedPhrase: '', timestamp: item.createdAt, broken: true });
        }
      }
      setSeeds(out);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [view, dek]);

  // ── Auto-lock: lock the vault after inactivity (default 5 min) ──
  useEffect(() => {
    if (view !== 'vault' || !dek) return;
    let timer;
    let minutes = 5;
    try {
      const v = parseFloat(localStorage.getItem('spaceone_autolock_min'));
      if (v > 0) minutes = v;
    } catch {}
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => handleLock(), minutes * 60000); };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, arm, { passive: true }));
    arm();
    return () => { clearTimeout(timer); events.forEach(ev => window.removeEventListener(ev, arm)); };
    // eslint-disable-next-line
  }, [view, dek]);

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // Privacy: clear the clipboard after 30s so the seed is not
      // left behind (best effort).
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === text) await navigator.clipboard.writeText('');
        } catch {}
      }, 30000);
    } catch {
      setError('Could not copy automatically. Please copy manually.');
    }
  }

  // ── Generate 12 or 24 words (BIP39, the wallet standard) ───
  function handleGenerateSeed(strength) {
    clearMsgs();
    setSeedF(p => ({ ...p, seedPhrase: generateMnemonic(wordlist, strength) }));
    setShowSeed(true); // show them so the user can write them down
  }

  // ── First run: create the vault password ───────────────────
  async function handleSetup(e) {
    e.preventDefault();
    clearMsgs();
    if (passF.password.length < 8) { setError('The password must be at least 8 characters long.'); return; }
    if (passF.password !== passF.confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      // Migration: if the old passwordless vault exists, reuse its
      // key so previously saved seeds keep opening.
      let legacyDek = null;
      try {
        const b64 = localStorage.getItem(LEGACY_DEK);
        if (b64) legacyDek = b64dec(b64);
      } catch {}
      const lock = await Vault.createPasswordLock(passF.password, legacyDek);
      saveAuth({ kdfSalt: lock.kdfSalt, wrappedDek: lock.wrappedDek, createdAt: new Date().toISOString() });
      try { localStorage.removeItem(LEGACY_DEK); } catch {} // drop the unprotected key
      setDek(lock.dek);
      setPassF({ password: '', confirm: '' });
      setView('vault');
      showSuccess('🔒 Vault created. Keep your password safe — there is no recovery without it.');
    } catch (err) {
      setError('Failed to create the vault: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }

  // ── Unlock with the password ────────────────────────────────
  async function handleUnlock(e) {
    e.preventDefault();
    clearMsgs();
    const auth = loadAuth();
    if (!auth) { setView('setup'); return; }
    setLoading(true);
    try {
      const opened = await Vault.openPasswordLock(unlockPass, auth.kdfSalt, auth.wrappedDek);
      setDek(opened);
      setUnlockPass('');
      setView('vault');
    } catch {
      setError('Incorrect password.');
    } finally {
      setLoading(false);
    }
  }

  // ── Lock (wipe everything from memory) ──────────────────────
  function handleLock() {
    setDek(null);
    setSeeds([]);
    setModal(null);
    setSeedF({ title: '', seedPhrase: '' });
    setShowSeed(false);
    clearMsgs();
    setView('unlock');
  }

  // ── Change the password ─────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    clearMsgs();
    const auth = loadAuth();
    if (changeF.password.length < 8) { setError('The new password must be at least 8 characters long.'); return; }
    if (changeF.password !== changeF.confirm) { setError('New passwords do not match.'); return; }
    setLoading(true);
    try {
      // confirm the current password before changing
      await Vault.openPasswordLock(changeF.current, auth.kdfSalt, auth.wrappedDek);
      const lock = await Vault.createPasswordLock(changeF.password, dek);
      saveAuth({ ...auth, kdfSalt: lock.kdfSalt, wrappedDek: lock.wrappedDek });
      setChangeF({ current: '', password: '', confirm: '' });
      setModal(null);
      showSuccess('Password changed successfully.');
    } catch {
      setError('Current password is incorrect.');
    } finally {
      setLoading(false);
    }
  }

  // ── Reveal a seed: requires the vault password ──────────────
  async function handleRevealSeed(e) {
    e.preventDefault();
    clearMsgs();
    const auth = loadAuth();
    setLoading(true);
    try {
      await Vault.openPasswordLock(revealPass, auth.kdfSalt, auth.wrappedDek);
      setRevealPass('');
      setShowSeed(true);
    } catch {
      setError('Incorrect password.');
    } finally {
      setLoading(false);
    }
  }

  // ── Save a new seed ─────────────────────────────────────────
  async function handleSaveSeed(e) {
    e.preventDefault();
    clearMsgs();
    const title = seedF.title.trim();
    const phrase = seedF.seedPhrase.trim().replace(/\s+/g, ' ');
    if (!title || !phrase) return;
    if (phrase.split(' ').length < 3) { setError('That seed phrase looks too short. Double-check the words.'); return; }
    setLoading(true);
    try {
      const blob = await Vault.encryptSeed(dek, title, phrase);
      const item = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), blob, createdAt: new Date().toISOString() };
      const store = loadStore();
      store.unshift(item);
      saveStore(store);
      setSeeds(p => [{ id: item.id, title, seedPhrase: phrase, timestamp: item.createdAt }, ...p]);
      setModal(null);
      setSeedF({ title: '', seedPhrase: '' });
      setShowSeed(false);
      showSuccess('🔒 Seed encrypted and saved on this device');
    } catch (err) {
      setError('Failed to encrypt the seed: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }

  // ── Delete a seed ───────────────────────────────────────────
  function handleDeleteSeed(id) {
    if (!window.confirm('Delete this seed from this device? This cannot be undone.')) return;
    saveStore(loadStore().filter(i => i.id !== id));
    setSeeds(p => p.filter(s => s.id !== id));
    setModal(null);
    setShowSeed(false);
    showSuccess('Seed deleted from this device.');
  }

  // ── Rename a saved wallet (re-encrypts the blob with the new title) ──
  async function handleRenameSeed(e) {
    e.preventDefault();
    clearMsgs();
    const title = renameF.trim();
    if (!title) return;
    setLoading(true);
    try {
      const id = modal.seed.id;
      const store = loadStore();
      const idx = store.findIndex(i => i.id === id);
      if (idx === -1) throw new Error('not found');
      const data = await Vault.decryptSeed(dek, store[idx].blob);
      store[idx] = { ...store[idx], blob: await Vault.encryptSeed(dek, title, data.seedPhrase) };
      saveStore(store);
      setSeeds(p => p.map(s => (s.id === id ? { ...s, title } : s)));
      setModal(null);
      setRenameF('');
      showSuccess('Wallet renamed.');
    } catch (err) {
      setError('Could not rename: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }

  // ── Backup: export the encrypted vault (opens only with the password) ──
  function handleExport() {
    clearMsgs();
    const auth = loadAuth();
    const payload = {
      app: 'SpaceOne', version: 2, exportedAt: new Date().toISOString(),
      kdfSalt: auth.kdfSalt, wrappedDek: auth.wrappedDek,
      items: loadStore(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spaceone-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showSuccess('Backup exported. It only opens with the password used at export time.');
  }

  function handleImportFile(e) {
    clearMsgs();
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(text => {
      const payload = JSON.parse(text);
      if (payload.app !== 'SpaceOne' || !Array.isArray(payload.items)) throw new Error('invalid');
      if (payload.version === 1 && payload.dek) {
        // legacy passwordless backup: the key travels inside the file
        doImport(payload, b64dec(payload.dek));
      } else if (payload.version === 2 && payload.kdfSalt && payload.wrappedDek) {
        setModal({ type: 'importpass', payload });
      } else {
        throw new Error('invalid');
      }
    }).catch(() => setError('Invalid backup file.'));
  }

  async function handleImportPass(e) {
    e.preventDefault();
    clearMsgs();
    setLoading(true);
    try {
      const { payload } = modal;
      const importDek = await Vault.openPasswordLock(importPass, payload.kdfSalt, payload.wrappedDek);
      setImportPass('');
      setModal(null);
      await doImport(payload, importDek);
    } catch {
      setError('Incorrect backup password.');
    } finally {
      setLoading(false);
    }
  }

  async function doImport(payload, importDek) {
    setLoading(true);
    try {
      const store = loadStore();
      const added = [];
      for (const item of payload.items) {
        if (store.some(i => i.id === item.id)) continue;
        const data = await Vault.decryptSeed(importDek, item.blob);              // open with the backup's key
        const blob = await Vault.encryptSeed(dek, data.title, data.seedPhrase); // re-encrypt with this vault's key
        const newItem = { id: item.id, blob, createdAt: item.createdAt };
        store.push(newItem);
        added.push({ id: newItem.id, title: data.title, seedPhrase: data.seedPhrase, timestamp: newItem.createdAt });
      }
      saveStore(store);
      if (added.length) setSeeds(p => [...added, ...p]);
      showSuccess(added.length
        ? `Backup imported: ${added.length} seed${added.length !== 1 ? 's' : ''} restored.`
        : 'Nothing new to import — every seed in the backup is already here.');
    } catch {
      setError('Could not import: the backup is corrupted or the password does not match.');
    } finally {
      setLoading(false);
    }
  }

  // ════════════════════════════════════════════════════════
  // SCREEN: CREATE PASSWORD (first run)
  // ════════════════════════════════════════════════════════
  if (view === 'setup') {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-auth">
          <div className="cv-brand">
            <img src="logo.png" alt="SpaceOne" className="cv-brand-logo" />
            <h1 className="cv-brand-name">SpaceOne</h1>
            <p className="cv-brand-sub">Create your vault password. Everything stays on this device.</p>
          </div>

          <form onSubmit={handleSetup} className="cv-form" noValidate>
            <Field label="Vault password">
              <div className="cv-input-wrap">
                <input type={showPass ? 'text' : 'password'} autoComplete="new-password" required autoFocus placeholder="At least 8 characters"
                  value={passF.password}
                  onChange={e => setPassF(p => ({ ...p, password: e.target.value }))} />
                <button type="button" className="cv-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
              <PasswordStrength password={passF.password} />
            </Field>

            <Field label="Confirm password">
              <input type={showPass ? 'text' : 'password'} autoComplete="new-password" required placeholder="Repeat the password"
                value={passF.confirm}
                onChange={e => setPassF(p => ({ ...p, confirm: e.target.value }))} />
            </Field>

            <Alert type="warning">
              ⚠️ Your password is the <strong>only</strong> key to the vault and is <strong>never stored anywhere</strong>. If you forget it, your seeds cannot be recovered. Write it down and keep it safe.
            </Alert>
            {error && <Alert type="error">{error}</Alert>}

            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <><Spinner /> Generating your keys…</> : <><Icon.Shield /> Create vault</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // SCREEN: UNLOCK
  // ════════════════════════════════════════════════════════
  if (view === 'unlock') {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-auth">
          <div className="cv-brand">
            <img src="logo.png" alt="SpaceOne" className="cv-brand-logo" />
            <h1 className="cv-brand-name">SpaceOne</h1>
            <p className="cv-brand-sub">Vault locked. Enter your password to continue.</p>
          </div>

          <form onSubmit={handleUnlock} className="cv-form" noValidate>
            <Field label="Password">
              <div className="cv-input-wrap">
                <input type={showPass ? 'text' : 'password'} autoComplete="current-password" required autoFocus placeholder="••••••••"
                  value={unlockPass}
                  onChange={e => setUnlockPass(e.target.value)} />
                <button type="button" className="cv-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
            </Field>

            {error && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">{success}</Alert>}

            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <><Spinner /> Verifying…</> : <><Icon.Lock /> Unlock</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // SCREEN: VAULT
  // ════════════════════════════════════════════════════════
  return (
    <div className="cv-dashboard">
      <header className="cv-header">
        <div className="cv-header-brand">
          <img src="logo.png" alt="" className="cv-header-logo" />
          <span className="cv-header-name">SpaceOne</span>
        </div>
        <div className="cv-header-right">
          <span className="cv-header-email">100% local · nothing leaves your device</span>
          <button onClick={() => { setModal({ type: 'changepass' }); clearMsgs(); }} className="cv-btn-icon" title="Change password"><Icon.Gear /></button>
          <button onClick={() => { setModal({ type: 'backup' }); clearMsgs(); }} className="cv-btn cv-btn-ghost" style={{ padding: '8px 14px' }} title="Backup & moving between computers">
            <Icon.Download /> Backup
          </button>
          <button onClick={handleLock} className="cv-btn-icon cv-btn-icon--logout" title="Lock vault"><Icon.LogOut /></button>
        </div>
      </header>

      <main className="cv-main">
        <div className="cv-dash-top">
          <div>
            <h2 className="cv-dash-title">My Seeds</h2>
            <p className="cv-dash-sub">
              {loading && seeds.length === 0
                ? 'Decrypting…'
                : `${seeds.length} seed${seeds.length !== 1 ? 's' : ''} encrypted on this device (AES-256)`}
            </p>
          </div>
          <button onClick={() => { setModal({ type: 'add' }); clearMsgs(); }} className="cv-btn cv-btn-primary">
            <Icon.Plus /> New Seed
          </button>
        </div>

        {error   && <Alert type="error"   className="cv-alert-float">{error}</Alert>}
        {success && <Alert type="success" className="cv-alert-float">{success}</Alert>}

        {loading && seeds.length === 0 && (
          <div className="cv-state-center"><Spinner /><p>Decrypting your seeds on this device…</p></div>
        )}

        {!loading && seeds.length === 0 && (
          <div className="cv-state-center cv-empty">
            <div className="cv-empty-icon"><Icon.Key /></div>
            <h3>No seeds saved yet</h3>
            <p>Click <strong>New Seed</strong> to store your first seed phrase. Everything is encrypted <strong>on this device only</strong>, protected by your password.</p>
            <button onClick={() => setModal({ type: 'add' })} className="cv-btn cv-btn-primary"><Icon.Plus /> Save first seed</button>
          </div>
        )}

        {seeds.length > 0 && (
          <div className="cv-grid">
            {seeds.map((seed) => (
              <div key={seed.id} className="cv-seed-card">
                <div className="cv-sc-header">
                  <div className="cv-sc-icon"><Icon.Key /></div>
                  <div className="cv-sc-info">
                    <h3 className="cv-sc-title">{seed.title}</h3>
                    <p className="cv-sc-date">{formatDate(seed.timestamp)}</p>
                  </div>
                </div>
                <div className="cv-sc-preview">{'•'.repeat(6)} {'•'.repeat(6)} {'•'.repeat(6)} {'•'.repeat(6)}</div>
                <div className="cv-sc-footer">
                  <span className="cv-badge-chain">🔒 AES-256-GCM</span>
                  <button
                    onClick={() => { setModal({ type: 'view', seed }); clearMsgs(); setShowSeed(false); setCopied(false); }}
                    className="cv-btn-view" disabled={seed.broken}
                  >
                    <Icon.Eye /> View seed
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Modal: Add Seed ── */}
      {modal?.type === 'add' && (
        <Modal onClose={() => { setModal(null); clearMsgs(); setSeedF({ title: '', seedPhrase: '' }); setShowSeed(false); }}>
          <div className="cv-modal-header"><h3><Icon.Key /> New Seed</h3></div>
          <form onSubmit={handleSaveSeed}>
            <Field label="Wallet name">
              <input type="text" required maxLength={100} autoFocus placeholder="E.g. Cold Bitcoin, Main Ethereum…"
                autoComplete="off" spellCheck={false}
                value={seedF.title}
                onChange={e => setSeedF(p => ({ ...p, title: e.target.value }))} />
            </Field>

            <Field label="Seed Phrase">
              <div className="cv-input-wrap cv-textarea-wrap">
                <textarea required rows={4} className="cv-textarea" placeholder="Type or paste your words — or generate 12 new ones below…"
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  value={seedF.seedPhrase}
                  style={{ WebkitTextSecurity: showSeed ? 'none' : 'disc' }}
                  onChange={e => setSeedF(p => ({ ...p, seedPhrase: e.target.value }))} />
                <button type="button" className="cv-eye cv-eye-ta" onClick={() => setShowSeed(p => !p)}>
                  {showSeed ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
              {(() => {
                const phrase = seedF.seedPhrase.trim().replace(/\s+/g, ' ');
                if (!phrase) return <small className="cv-hint">🔒 Encrypted with AES-256 and stored only on this device</small>;
                const n = phrase.split(' ').length;
                const isBip = validateMnemonic(phrase.toLowerCase(), wordlist);
                return (
                  <small className="cv-hint" style={{ color: isBip ? '#10b981' : undefined }}>
                    {isBip
                      ? `✓ ${n} words — valid BIP39 phrase (wallet compatible)`
                      : `${n} word${n !== 1 ? 's' : ''} — custom phrase · 🔒 encrypted with AES-256 on this device only`}
                  </small>
                );
              })()}
            </Field>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <button type="button" onClick={() => handleGenerateSeed(128)} className="cv-btn cv-btn-ghost" style={{ flex: 1 }}>
                <Icon.Dice /> Generate 12 words
              </button>
              <button type="button" onClick={() => handleGenerateSeed(256)} className="cv-btn cv-btn-ghost" style={{ flex: 1 }}>
                <Icon.Dice /> Generate 24 words
              </button>
            </div>

            <Alert type="warning">⚠️ Make sure you are in a safe, private place{seedF.seedPhrase ? '. If you just generated these words, write them down on paper before saving.' : ''}</Alert>
            {error && <Alert type="error">{error}</Alert>}

            <div className="cv-modal-actions">
              <button type="button" onClick={() => { setModal(null); clearMsgs(); setSeedF({ title: '', seedPhrase: '' }); setShowSeed(false); }} className="cv-btn cv-btn-ghost">Cancel</button>
              <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                {loading ? <><Spinner /> Encrypting…</> : <><Icon.Shield /> Save securely</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: View Seed ── */}
      {modal?.type === 'view' && (
        <Modal onClose={() => { setModal(null); clearMsgs(); setShowSeed(false); setCopied(false); setRevealPass(''); }}>
          <div className="cv-modal-header">
            <h3>
              <Icon.Key /> {modal.seed.title}
              <button type="button" className="cv-btn-icon" title="Rename wallet" style={{ marginLeft: 4 }}
                onClick={() => { setRenameF(modal.seed.title); setModal({ type: 'rename', seed: modal.seed }); clearMsgs(); setShowSeed(false); setRevealPass(''); }}>
                <Icon.Pencil />
              </button>
            </h3>
            <p className="cv-modal-date">Saved on {formatDate(modal.seed.timestamp)}</p>
          </div>

          <div className={`cv-seed-reveal ${showSeed ? 'is-visible' : 'is-hidden'}`}>
            {showSeed ? (
              <div className="cv-word-grid">
                {modal.seed.seedPhrase.trim().split(/\s+/).map((word, i) => (
                  <div key={i} className="cv-word"><span className="cv-word-n">{i + 1}</span><span className="cv-word-text">{word}</span></div>
                ))}
              </div>
            ) : (
              <div className="cv-seed-locked">
                <div className="cv-locked-icon"><Icon.Lock /></div>
                <p>Enter your vault password to reveal</p>
                <small>Make sure no cameras or people are watching</small>
              </div>
            )}
          </div>

          {!showSeed && (
            <form onSubmit={handleRevealSeed}>
              <Field label="Vault password">
                <input type="password" autoComplete="current-password" required autoFocus placeholder="••••••••"
                  value={revealPass}
                  onChange={e => setRevealPass(e.target.value)} />
              </Field>
              {error && <Alert type="error">{error}</Alert>}
              <div className="cv-modal-actions">
                <button type="button" onClick={() => handleDeleteSeed(modal.seed.id)} className="cv-btn cv-btn-danger" title="Delete seed">
                  <Icon.Trash /> Delete
                </button>
                <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                  {loading ? <><Spinner /> Verifying…</> : <><Icon.Eye /> Reveal Seed</>}
                </button>
              </div>
            </form>
          )}

          {showSeed && (
            <>
              <Alert type="warning">⚠️ Never share your seed phrase. Do not screenshot this screen.</Alert>
              {success && <Alert type="success">{success}</Alert>}
              <div className="cv-modal-actions">
                <button type="button" onClick={() => handleDeleteSeed(modal.seed.id)} className="cv-btn cv-btn-danger" title="Delete seed">
                  <Icon.Trash /> Delete
                </button>
                <button type="button" onClick={() => copyText(modal.seed.seedPhrase)} className={`cv-btn ${copied ? 'cv-btn-copied' : 'cv-btn-ghost'}`}>
                  {copied ? <><Icon.Check /> Copied!</> : <><Icon.Copy /> Copy</>}
                </button>
                <button type="button" onClick={() => { setShowSeed(false); setRevealPass(''); clearMsgs(); }} className="cv-btn cv-btn-primary">
                  <Icon.EyeOff /> Hide
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── Modal: Rename wallet ── */}
      {modal?.type === 'rename' && (
        <Modal onClose={() => { setModal(null); setRenameF(''); clearMsgs(); }}>
          <div className="cv-modal-header"><h3><Icon.Pencil /> Rename wallet</h3></div>
          <form onSubmit={handleRenameSeed}>
            <Field label="Wallet name">
              <input type="text" required maxLength={100} autoFocus
                autoComplete="off" spellCheck={false}
                value={renameF}
                onChange={e => setRenameF(e.target.value)} />
            </Field>
            {error && <Alert type="error">{error}</Alert>}
            <div className="cv-modal-actions">
              <button type="button" onClick={() => { setModal(null); setRenameF(''); clearMsgs(); }} className="cv-btn cv-btn-ghost">Cancel</button>
              <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                {loading ? <Spinner /> : <><Icon.Check /> Save name</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Change password ── */}
      {modal?.type === 'changepass' && (
        <Modal onClose={() => { setModal(null); setChangeF({ current: '', password: '', confirm: '' }); clearMsgs(); }}>
          <div className="cv-modal-header"><h3><Icon.Lock /> Change vault password</h3></div>
          <form onSubmit={handleChangePassword}>
            <Field label="Current password">
              <input type="password" autoComplete="current-password" required autoFocus placeholder="••••••••"
                value={changeF.current}
                onChange={e => setChangeF(p => ({ ...p, current: e.target.value }))} />
            </Field>
            <Field label="New password">
              <input type="password" autoComplete="new-password" required placeholder="At least 8 characters"
                value={changeF.password}
                onChange={e => setChangeF(p => ({ ...p, password: e.target.value }))} />
              <PasswordStrength password={changeF.password} />
            </Field>
            <Field label="Confirm new password">
              <input type="password" autoComplete="new-password" required placeholder="Repeat the new password"
                value={changeF.confirm}
                onChange={e => setChangeF(p => ({ ...p, confirm: e.target.value }))} />
            </Field>
            <Alert type="warning">⚠️ Old backups still open with the password they were exported with.</Alert>
            {error && <Alert type="error">{error}</Alert>}
            <div className="cv-modal-actions">
              <button type="button" onClick={() => { setModal(null); setChangeF({ current: '', password: '', confirm: '' }); clearMsgs(); }} className="cv-btn cv-btn-ghost">Cancel</button>
              <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                {loading ? <Spinner /> : <><Icon.Check /> Change password</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Backup & transfer ── */}
      {modal?.type === 'backup' && (
        <Modal onClose={() => { setModal(null); clearMsgs(); }}>
          <div className="cv-modal-header">
            <h3><Icon.Download /> Backup & other computers</h3>
            <p className="cv-modal-date">Your vault lives only on this device — the backup is how it travels</p>
          </div>

          <div className="cv-seed-locked" style={{ textAlign: 'left', marginBottom: 16 }}>
            <p style={{ marginBottom: 10 }}><strong>To use SpaceOne on another computer:</strong></p>
            <p style={{ marginBottom: 6 }}>1. Click <strong>Export backup</strong> here — it downloads an encrypted file</p>
            <p style={{ marginBottom: 6 }}>2. Take the file to the other computer (USB drive, email, cloud…)</p>
            <p style={{ marginBottom: 6 }}>3. There, open SpaceOne, create a password and use <strong>Import backup</strong></p>
            <p style={{ marginBottom: 0 }}>4. Enter the password the vault had when you exported — done</p>
          </div>

          <Alert type="warning">🔒 The backup file is encrypted: without the password it is useless to whoever finds it. Still, keep it safe. It is also your insurance if this computer breaks or the browser data is cleared.</Alert>
          {error   && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          <div className="cv-modal-actions">
            <label className="cv-btn cv-btn-ghost" style={{ cursor: 'pointer' }}>
              <Icon.Upload /> Import backup
              <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImportFile} />
            </label>
            <button type="button" onClick={handleExport} className="cv-btn cv-btn-primary">
              <Icon.Download /> Export backup
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Imported backup password ── */}
      {modal?.type === 'importpass' && (
        <Modal onClose={() => { setModal(null); setImportPass(''); clearMsgs(); }}>
          <div className="cv-modal-header">
            <h3><Icon.Upload /> Import backup</h3>
            <p className="cv-modal-date">Enter the password the vault had when this backup was exported</p>
          </div>
          <form onSubmit={handleImportPass}>
            <Field label="Backup password">
              <input type="password" autoComplete="off" required autoFocus placeholder="••••••••"
                value={importPass}
                onChange={e => setImportPass(e.target.value)} />
            </Field>
            {error && <Alert type="error">{error}</Alert>}
            <div className="cv-modal-actions">
              <button type="button" onClick={() => { setModal(null); setImportPass(''); clearMsgs(); }} className="cv-btn cv-btn-ghost">Cancel</button>
              <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                {loading ? <Spinner /> : <><Icon.Check /> Import</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Helper components ────────────────────────────────────────
function Field({ label, children }) {
  return <div className="cv-field"><label className="cv-label">{label}</label>{children}</div>;
}

function Alert({ type, children, className = '' }) {
  const cls = { error: 'cv-alert-error', success: 'cv-alert-success', warning: 'cv-alert-warning' };
  return <div className={`cv-alert ${cls[type]} ${className}`}>{children}</div>;
}

function Modal({ onClose, children }) {
  return (
    <div className="cv-overlay" onClick={onClose}>
      <div className="cv-modal" onClick={e => e.stopPropagation()}>
        <button className="cv-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        {children}
      </div>
    </div>
  );
}

function PasswordStrength({ password }) {
  const checks = [
    { ok: password.length >= 8,   label: '8+ characters' },
    { ok: /[A-Z]/.test(password), label: 'Uppercase' },
    { ok: /[0-9]/.test(password), label: 'Number' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'Symbol' },
  ];
  const score = checks.filter(c => c.ok).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  return (
    <div className="cv-pwd-strength">
      <div className="cv-pwd-bars">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="cv-pwd-bar" style={{ background: i <= score ? colors[score] : 'var(--border)' }} />
        ))}
      </div>
      <span style={{ color: colors[score] }}>{labels[score]}</span>
    </div>
  );
}

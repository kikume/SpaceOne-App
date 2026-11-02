/* ============================================================
 * SpaceOne — Cofre local de seed phrases (estilo Phantom)
 *
 * 100% local: sem conta e sem servidor. No primeiro uso você cria
 * uma senha; depois o app só abre com ela. A senha NUNCA é salva:
 * dela deriva-se uma chave (Argon2id + HKDF) que embrulha a chave
 * do cofre (AES-256-GCM). Senha errada = a decifragem falha.
 * ============================================================ */
import React, { useState, useEffect } from 'react';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import Vault from './crypto';
import './App.css';

// ── Ícones inline (sem dependência externa) ──────────────────
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
};

function Spinner() {
  return <span className="cv-spinner" aria-label="Carregando" />;
}

// ── Armazenamento local ──────────────────────────────────────
const STORE_KEY   = 'spaceone_vault_v1';  // seeds cifradas
const AUTH_KEY    = 'spaceone_auth_v2';   // { kdfSalt, wrappedDek } — a senha nunca é salva
const LEGACY_DEK  = 'spaceone_dek_v1';    // versão antiga (chave sem senha) — migrada no setup

function b64dec(str) { const s = atob(str); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

function loadAuth()  { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; } }
function saveAuth(a) { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }
function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; } }
function saveStore(items) { localStorage.setItem(STORE_KEY, JSON.stringify(items)); }

function formatDate(ts) {
  try { return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; }
}

export default function App() {
  // setup (primeira vez) | unlock (pede senha) | vault (aberto)
  const [view, setView]       = useState(() => (loadAuth() ? 'unlock' : 'setup'));
  const [dek, setDek]         = useState(null);    // chave do cofre — SÓ em memória
  const [seeds, setSeeds]     = useState([]);      // decifradas — só em memória
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal]     = useState(null);    // {type:'add'|'view'|'changepass'|'importpass'}
  const [seedF, setSeedF]     = useState({ title: '', seedPhrase: '' });
  const [passF, setPassF]     = useState({ password: '', confirm: '' });
  const [unlockPass, setUnlockPass] = useState('');
  const [changeF, setChangeF] = useState({ current: '', password: '', confirm: '' });
  const [importPass, setImportPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [copied, setCopied]   = useState(false);

  function clearMsgs() { setError(''); setSuccess(''); }
  function showSuccess(msg, ms = 4000) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), ms);
  }

  // ── Com o cofre aberto, decifra as seeds guardadas ────────
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
          out.push({ id: item.id, title: '(não foi possível decifrar)', seedPhrase: '', timestamp: item.createdAt, broken: true });
        }
      }
      setSeeds(out);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [view, dek]);

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // Privacidade: limpa a área de transferência após 30s para a seed
      // não ficar esquecida no clipboard (melhor esforço).
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === text) await navigator.clipboard.writeText('');
        } catch {}
      }, 30000);
    } catch {
      setError('Não foi possível copiar automaticamente. Copie manualmente.');
    }
  }

  // ── Gerar 12 palavras (BIP39, padrão das carteiras) ───────
  function handleGenerateSeed() {
    clearMsgs();
    setSeedF(p => ({ ...p, seedPhrase: generateMnemonic(wordlist, 128) }));
    setShowSeed(true); // mostra para o usuário anotar
  }

  // ── Primeira vez: criar a senha do cofre ──────────────────
  async function handleSetup(e) {
    e.preventDefault();
    clearMsgs();
    if (passF.password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (passF.password !== passF.confirm) { setError('As senhas não conferem.'); return; }
    setLoading(true);
    try {
      // Migração: se existir o cofre antigo (sem senha), reaproveita a chave
      // dele para que as seeds já salvas continuem abrindo.
      let legacyDek = null;
      try {
        const b64 = localStorage.getItem(LEGACY_DEK);
        if (b64) legacyDek = b64dec(b64);
      } catch {}
      const lock = await Vault.createPasswordLock(passF.password, legacyDek);
      saveAuth({ kdfSalt: lock.kdfSalt, wrappedDek: lock.wrappedDek, createdAt: new Date().toISOString() });
      try { localStorage.removeItem(LEGACY_DEK); } catch {} // some com a chave sem proteção
      setDek(lock.dek);
      setPassF({ password: '', confirm: '' });
      setView('vault');
      showSuccess('🔒 Cofre criado. Guarde bem a sua senha — sem ela não há recuperação.');
    } catch (err) {
      setError('Falha ao criar o cofre: ' + (err.message || 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  // ── Desbloquear com a senha ───────────────────────────────
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
      setError('Senha incorreta.');
    } finally {
      setLoading(false);
    }
  }

  // ── Bloquear (limpa tudo da memória) ──────────────────────
  function handleLock() {
    setDek(null);
    setSeeds([]);
    setModal(null);
    setSeedF({ title: '', seedPhrase: '' });
    setShowSeed(false);
    clearMsgs();
    setView('unlock');
  }

  // ── Trocar a senha ────────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    clearMsgs();
    const auth = loadAuth();
    if (changeF.password.length < 8) { setError('A nova senha precisa ter pelo menos 8 caracteres.'); return; }
    if (changeF.password !== changeF.confirm) { setError('As novas senhas não conferem.'); return; }
    setLoading(true);
    try {
      // confirma a senha atual antes de trocar
      await Vault.openPasswordLock(changeF.current, auth.kdfSalt, auth.wrappedDek);
      const lock = await Vault.createPasswordLock(changeF.password, dek);
      saveAuth({ ...auth, kdfSalt: lock.kdfSalt, wrappedDek: lock.wrappedDek });
      setChangeF({ current: '', password: '', confirm: '' });
      setModal(null);
      showSuccess('Senha alterada com sucesso.');
    } catch {
      setError('Senha atual incorreta.');
    } finally {
      setLoading(false);
    }
  }

  // ── Salvar nova seed ──────────────────────────────────────
  async function handleSaveSeed(e) {
    e.preventDefault();
    clearMsgs();
    const title = seedF.title.trim();
    const phrase = seedF.seedPhrase.trim().replace(/\s+/g, ' ');
    if (!title || !phrase) return;
    if (phrase.split(' ').length < 3) { setError('A seed phrase parece curta demais. Confira as palavras.'); return; }
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
      showSuccess('🔒 Seed cifrada e salva neste aparelho');
    } catch (err) {
      setError('Falha ao cifrar a seed: ' + (err.message || 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  // ── Apagar seed ───────────────────────────────────────────
  function handleDeleteSeed(id) {
    if (!window.confirm('Apagar esta seed deste aparelho? Esta ação não pode ser desfeita.')) return;
    saveStore(loadStore().filter(i => i.id !== id));
    setSeeds(p => p.filter(s => s.id !== id));
    setModal(null);
    setShowSeed(false);
    showSuccess('Seed apagada deste aparelho.');
  }

  // ── Backup: exporta cofre cifrado (abre só com a senha) ───
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
    showSuccess('Backup exportado. Ele só abre com a senha usada na exportação.');
  }

  function handleImportFile(e) {
    clearMsgs();
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(text => {
      const payload = JSON.parse(text);
      if (payload.app !== 'SpaceOne' || !Array.isArray(payload.items)) throw new Error('inválido');
      if (payload.version === 1 && payload.dek) {
        // backup antigo (sem senha): a chave vem dentro do arquivo
        doImport(payload, b64dec(payload.dek));
      } else if (payload.version === 2 && payload.kdfSalt && payload.wrappedDek) {
        setModal({ type: 'importpass', payload });
      } else {
        throw new Error('inválido');
      }
    }).catch(() => setError('Arquivo de backup inválido.'));
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
      setError('Senha do backup incorreta.');
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
        const data = await Vault.decryptSeed(importDek, item.blob);           // abre com a chave do backup
        const blob = await Vault.encryptSeed(dek, data.title, data.seedPhrase); // re-cifra com a chave deste cofre
        const newItem = { id: item.id, blob, createdAt: item.createdAt };
        store.push(newItem);
        added.push({ id: newItem.id, title: data.title, seedPhrase: data.seedPhrase, timestamp: newItem.createdAt });
      }
      saveStore(store);
      if (added.length) setSeeds(p => [...added, ...p]);
      showSuccess(added.length
        ? `Backup importado: ${added.length} seed${added.length !== 1 ? 's' : ''} restaurada${added.length !== 1 ? 's' : ''}.`
        : 'Nada novo para importar — todas as seeds do backup já estão aqui.');
    } catch {
      setError('Não foi possível importar: o backup está corrompido ou a senha não confere.');
    } finally {
      setLoading(false);
    }
  }

  // ════════════════════════════════════════════════════════
  // TELA: CRIAR SENHA (primeira vez)
  // ════════════════════════════════════════════════════════
  if (view === 'setup') {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-auth">
          <div className="cv-brand">
            <div className="cv-brand-icon"><Icon.Shield /></div>
            <h1 className="cv-brand-name">SpaceOne</h1>
            <p className="cv-brand-sub">Crie a senha do seu cofre. Tudo fica só neste aparelho.</p>
          </div>

          <form onSubmit={handleSetup} className="cv-form" noValidate>
            <Field label="Senha do cofre">
              <div className="cv-input-wrap">
                <input type={showPass ? 'text' : 'password'} autoComplete="new-password" required autoFocus placeholder="Mínimo 8 caracteres"
                  value={passF.password}
                  onChange={e => setPassF(p => ({ ...p, password: e.target.value }))} />
                <button type="button" className="cv-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
              <PasswordStrength password={passF.password} />
            </Field>

            <Field label="Confirmar senha">
              <input type={showPass ? 'text' : 'password'} autoComplete="new-password" required placeholder="Repita a senha"
                value={passF.confirm}
                onChange={e => setPassF(p => ({ ...p, confirm: e.target.value }))} />
            </Field>

            <Alert type="warning">
              ⚠️ Sua senha é a <strong>única</strong> chave do cofre e <strong>não é salva em lugar nenhum</strong>. Se esquecê-la, as seeds não poderão ser recuperadas. Anote-a em local seguro.
            </Alert>
            {error && <Alert type="error">{error}</Alert>}

            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <><Spinner /> Gerando suas chaves…</> : <><Icon.Shield /> Criar cofre</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // TELA: DESBLOQUEAR
  // ════════════════════════════════════════════════════════
  if (view === 'unlock') {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-auth">
          <div className="cv-brand">
            <div className="cv-brand-icon"><Icon.Shield /></div>
            <h1 className="cv-brand-name">SpaceOne</h1>
            <p className="cv-brand-sub">Cofre bloqueado. Digite sua senha para entrar.</p>
          </div>

          <form onSubmit={handleUnlock} className="cv-form" noValidate>
            <Field label="Senha">
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
              {loading ? <><Spinner /> Verificando…</> : <><Icon.Lock /> Desbloquear</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // TELA: COFRE
  // ════════════════════════════════════════════════════════
  return (
    <div className="cv-dashboard">
      <header className="cv-header">
        <div className="cv-header-brand">
          <div className="cv-header-icon"><Icon.Shield /></div>
          <span className="cv-header-name">SpaceOne</span>
        </div>
        <div className="cv-header-right">
          <span className="cv-header-email">100% local · nada sai do seu aparelho</span>
          <button onClick={() => { setModal({ type: 'changepass' }); clearMsgs(); }} className="cv-btn-icon" title="Trocar senha"><Icon.Gear /></button>
          <button onClick={handleExport} className="cv-btn-icon" title="Exportar backup"><Icon.Download /></button>
          <label className="cv-btn-icon" title="Importar backup" style={{ cursor: 'pointer' }}>
            <Icon.Upload />
            <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImportFile} />
          </label>
          <button onClick={handleLock} className="cv-btn-icon cv-btn-icon--logout" title="Bloquear cofre"><Icon.LogOut /></button>
        </div>
      </header>

      <main className="cv-main">
        <div className="cv-dash-top">
          <div>
            <h2 className="cv-dash-title">Minhas Seeds</h2>
            <p className="cv-dash-sub">
              {loading && seeds.length === 0
                ? 'Decifrando…'
                : `${seeds.length} seed${seeds.length !== 1 ? 's' : ''} cifrada${seeds.length !== 1 ? 's' : ''} neste aparelho (AES-256)`}
            </p>
          </div>
          <button onClick={() => { setModal({ type: 'add' }); clearMsgs(); }} className="cv-btn cv-btn-primary">
            <Icon.Plus /> Nova Seed
          </button>
        </div>

        {error   && <Alert type="error"   className="cv-alert-float">{error}</Alert>}
        {success && <Alert type="success" className="cv-alert-float">{success}</Alert>}

        {loading && seeds.length === 0 && (
          <div className="cv-state-center"><Spinner /><p>Decifrando suas seeds neste aparelho…</p></div>
        )}

        {!loading && seeds.length === 0 && (
          <div className="cv-state-center cv-empty">
            <div className="cv-empty-icon"><Icon.Key /></div>
            <h3>Nenhuma seed salva ainda</h3>
            <p>Clique em <strong>Nova Seed</strong> para guardar sua primeira seed phrase. Tudo fica cifrado <strong>somente neste aparelho</strong>, protegido pela sua senha.</p>
            <button onClick={() => setModal({ type: 'add' })} className="cv-btn cv-btn-primary"><Icon.Plus /> Salvar primeira seed</button>
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
                    <Icon.Eye /> Ver seed
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Modal: Adicionar Seed ── */}
      {modal?.type === 'add' && (
        <Modal onClose={() => { setModal(null); clearMsgs(); setSeedF({ title: '', seedPhrase: '' }); setShowSeed(false); }}>
          <div className="cv-modal-header"><h3><Icon.Key /> Nova Seed</h3></div>
          <form onSubmit={handleSaveSeed}>
            <Field label="Nome da carteira">
              <input type="text" required maxLength={100} autoFocus placeholder="Ex: Bitcoin Fria, Ethereum Principal…"
                autoComplete="off" spellCheck={false}
                value={seedF.title}
                onChange={e => setSeedF(p => ({ ...p, title: e.target.value }))} />
            </Field>

            <Field label="Seed Phrase">
              <div className="cv-input-wrap cv-textarea-wrap">
                <textarea required rows={4} className="cv-textarea" placeholder="Escreva ou cole suas palavras — ou gere 12 novas abaixo…"
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
                if (!phrase) return <small className="cv-hint">🔒 Cifrada com AES-256 e guardada somente neste aparelho</small>;
                const n = phrase.split(' ').length;
                const isBip = validateMnemonic(phrase.toLowerCase(), wordlist);
                return (
                  <small className="cv-hint" style={{ color: isBip ? '#10b981' : undefined }}>
                    {isBip
                      ? `✓ ${n} palavras — frase BIP39 válida (compatível com carteiras)`
                      : `${n} palavra${n !== 1 ? 's' : ''} — frase personalizada · 🔒 cifrada com AES-256 somente neste aparelho`}
                  </small>
                );
              })()}
            </Field>

            <button type="button" onClick={handleGenerateSeed} className="cv-btn cv-btn-ghost" style={{ width: '100%', marginBottom: 14 }}>
              <Icon.Dice /> Gerar 12 palavras para mim (BIP39)
            </button>

            <Alert type="warning">⚠️ Certifique-se de estar em ambiente seguro e privado{seedF.seedPhrase ? '. Se gerou as palavras agora, anote-as em papel antes de salvar.' : ''}</Alert>
            {error && <Alert type="error">{error}</Alert>}

            <div className="cv-modal-actions">
              <button type="button" onClick={() => { setModal(null); clearMsgs(); setSeedF({ title: '', seedPhrase: '' }); setShowSeed(false); }} className="cv-btn cv-btn-ghost">Cancelar</button>
              <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                {loading ? <><Spinner /> Cifrando…</> : <><Icon.Shield /> Salvar com segurança</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Ver Seed ── */}
      {modal?.type === 'view' && (
        <Modal onClose={() => { setModal(null); clearMsgs(); setShowSeed(false); setCopied(false); }}>
          <div className="cv-modal-header">
            <h3><Icon.Key /> {modal.seed.title}</h3>
            <p className="cv-modal-date">Salva em {formatDate(modal.seed.timestamp)}</p>
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
                <p>Clique para revelar a seed phrase</p>
                <small>Certifique-se de que não há câmeras ou pessoas olhando</small>
              </div>
            )}
          </div>

          <Alert type="warning">⚠️ Nunca compartilhe sua seed phrase. Não tire print desta tela.</Alert>
          {success && <Alert type="success">{success}</Alert>}

          <div className="cv-modal-actions">
            <button type="button" onClick={() => handleDeleteSeed(modal.seed.id)} className="cv-btn cv-btn-danger" title="Apagar seed">
              <Icon.Trash /> Apagar
            </button>
            {showSeed && (
              <button type="button" onClick={() => copyText(modal.seed.seedPhrase)} className={`cv-btn ${copied ? 'cv-btn-copied' : 'cv-btn-ghost'}`}>
                {copied ? <><Icon.Check /> Copiado!</> : <><Icon.Copy /> Copiar</>}
              </button>
            )}
            <button type="button" onClick={() => setShowSeed(p => !p)} className="cv-btn cv-btn-primary">
              {showSeed ? <><Icon.EyeOff /> Ocultar</> : <><Icon.Eye /> Revelar Seed</>}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Trocar senha ── */}
      {modal?.type === 'changepass' && (
        <Modal onClose={() => { setModal(null); setChangeF({ current: '', password: '', confirm: '' }); clearMsgs(); }}>
          <div className="cv-modal-header"><h3><Icon.Lock /> Trocar senha do cofre</h3></div>
          <form onSubmit={handleChangePassword}>
            <Field label="Senha atual">
              <input type="password" autoComplete="current-password" required autoFocus placeholder="••••••••"
                value={changeF.current}
                onChange={e => setChangeF(p => ({ ...p, current: e.target.value }))} />
            </Field>
            <Field label="Nova senha">
              <input type="password" autoComplete="new-password" required placeholder="Mínimo 8 caracteres"
                value={changeF.password}
                onChange={e => setChangeF(p => ({ ...p, password: e.target.value }))} />
              <PasswordStrength password={changeF.password} />
            </Field>
            <Field label="Confirmar nova senha">
              <input type="password" autoComplete="new-password" required placeholder="Repita a nova senha"
                value={changeF.confirm}
                onChange={e => setChangeF(p => ({ ...p, confirm: e.target.value }))} />
            </Field>
            <Alert type="warning">⚠️ Backups antigos continuam abrindo com a senha usada quando foram exportados.</Alert>
            {error && <Alert type="error">{error}</Alert>}
            <div className="cv-modal-actions">
              <button type="button" onClick={() => { setModal(null); setChangeF({ current: '', password: '', confirm: '' }); clearMsgs(); }} className="cv-btn cv-btn-ghost">Cancelar</button>
              <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                {loading ? <Spinner /> : <><Icon.Check /> Trocar senha</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Senha do backup importado ── */}
      {modal?.type === 'importpass' && (
        <Modal onClose={() => { setModal(null); setImportPass(''); clearMsgs(); }}>
          <div className="cv-modal-header">
            <h3><Icon.Upload /> Importar backup</h3>
            <p className="cv-modal-date">Digite a senha que o cofre tinha quando este backup foi exportado</p>
          </div>
          <form onSubmit={handleImportPass}>
            <Field label="Senha do backup">
              <input type="password" autoComplete="off" required autoFocus placeholder="••••••••"
                value={importPass}
                onChange={e => setImportPass(e.target.value)} />
            </Field>
            {error && <Alert type="error">{error}</Alert>}
            <div className="cv-modal-actions">
              <button type="button" onClick={() => { setModal(null); setImportPass(''); clearMsgs(); }} className="cv-btn cv-btn-ghost">Cancelar</button>
              <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                {loading ? <Spinner /> : <><Icon.Check /> Importar</>}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Componentes auxiliares ───────────────────────────────────
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
        <button className="cv-modal-close" onClick={onClose} aria-label="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        {children}
      </div>
    </div>
  );
}

function PasswordStrength({ password }) {
  const checks = [
    { ok: password.length >= 8,   label: '8+ caracteres' },
    { ok: /[A-Z]/.test(password), label: 'Maiúscula' },
    { ok: /[0-9]/.test(password), label: 'Número' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'Símbolo' },
  ];
  const score = checks.filter(c => c.ok).length;
  const labels = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];
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

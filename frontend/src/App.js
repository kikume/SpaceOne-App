/* ============================================================
 * SpaceOne — Cofre local de seed phrases
 *
 * 100% local: sem conta, sem senha, sem servidor. As seeds são
 * cifradas com AES-256-GCM e guardadas apenas neste dispositivo
 * (localStorage). Nada sai do aparelho.
 * ============================================================ */
import React, { useState, useEffect } from 'react';
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
};

function Spinner() {
  return <span className="cv-spinner" aria-label="Carregando" />;
}

// ── Armazenamento local ──────────────────────────────────────
const STORE_KEY = 'spaceone_vault_v1';
const DEK_KEY   = 'spaceone_dek_v1';

function b64enc(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function b64dec(str)   { const s = atob(str); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }

/** Chave local do dispositivo: criada no primeiro uso, fica só neste aparelho. */
function getLocalDek() {
  let b64 = null;
  try { b64 = localStorage.getItem(DEK_KEY); } catch {}
  if (b64) return b64dec(b64);
  const dek = window.crypto.getRandomValues(new Uint8Array(32));
  try { localStorage.setItem(DEK_KEY, b64enc(dek)); } catch {}
  return dek;
}

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function saveStore(items) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}

function formatDate(ts) {
  try { return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ''; }
}

export default function App() {
  const [dek]                 = useState(getLocalDek);
  const [seeds, setSeeds]     = useState([]);      // decifradas, só em memória
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal]     = useState(null);    // null | {type:'add'} | {type:'view', seed}
  const [seedF, setSeedF]     = useState({ title: '', seedPhrase: '' });
  const [showSeed, setShowSeed] = useState(false);
  const [copied, setCopied]   = useState(false);

  // ── Carrega e decifra as seeds guardadas neste aparelho ──
  useEffect(() => {
    (async () => {
      const items = loadStore();
      const out = [];
      for (const item of items) {
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
  }, []);

  function clearMsgs() { setError(''); setSuccess(''); }
  function showSuccess(msg, ms = 4000) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), ms);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar automaticamente. Copie manualmente.');
    }
  }

  // ── Salvar nova seed (cifra e guarda localmente) ──────────
  async function handleSaveSeed(e) {
    e.preventDefault();
    clearMsgs();
    const title = seedF.title.trim();
    const phrase = seedF.seedPhrase.trim().replace(/\s+/g, ' ');
    if (!title || !phrase) return;
    const words = phrase.split(' ');
    if (words.length < 3) { setError('A seed phrase parece curta demais. Confira as palavras.'); return; }
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

  // ── Backup: exporta e importa o cofre cifrado ─────────────
  function handleExport() {
    clearMsgs();
    const payload = {
      app: 'SpaceOne', version: 1, exportedAt: new Date().toISOString(),
      dek: (() => { try { return localStorage.getItem(DEK_KEY); } catch { return null; } })(),
      items: loadStore(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spaceone-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showSuccess('Backup exportado. Guarde o arquivo em local seguro — ele permite abrir suas seeds.');
  }

  async function handleImport(e) {
    clearMsgs();
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.app !== 'SpaceOne' || !Array.isArray(payload.items) || !payload.dek) {
        throw new Error('Arquivo de backup inválido');
      }
      const importDek = b64dec(payload.dek);
      const existing = loadStore();
      const store = [...existing];
      const decrypted = [];
      let added = 0;
      for (const item of payload.items) {
        if (store.some(i => i.id === item.id)) continue;
        const data = await Vault.decryptSeed(importDek, item.blob); // valida o backup
        const blob = await Vault.encryptSeed(dek, data.title, data.seedPhrase); // re-cifra com a chave deste aparelho
        const newItem = { id: item.id, blob, createdAt: item.createdAt };
        store.push(newItem);
        decrypted.push({ id: newItem.id, title: data.title, seedPhrase: data.seedPhrase, timestamp: newItem.createdAt });
        added++;
      }
      saveStore(store);
      if (decrypted.length) setSeeds(p => [...decrypted, ...p]);
      showSuccess(added ? `Backup importado: ${added} seed${added !== 1 ? 's' : ''} restaurada${added !== 1 ? 's' : ''}.` : 'Nada novo para importar — todas as seeds do backup já estão aqui.');
    } catch (err) {
      setError('Não foi possível importar o backup: ' + (err.message || 'arquivo inválido'));
    }
  }

  // ════════════════════════════════════════════════════════
  // TELA ÚNICA: COFRE LOCAL
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
          <button onClick={handleExport} className="cv-btn-icon" title="Exportar backup"><Icon.Download /></button>
          <label className="cv-btn-icon" title="Importar backup" style={{ cursor: 'pointer' }}>
            <Icon.Upload />
            <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
      </header>

      <main className="cv-main">
        <div className="cv-dash-top">
          <div>
            <h2 className="cv-dash-title">Minhas Seeds</h2>
            <p className="cv-dash-sub">
              {loading
                ? 'Abrindo o cofre…'
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
            <p>Clique em <strong>Nova Seed</strong> para guardar sua primeira seed phrase. Tudo fica cifrado <strong>somente neste aparelho</strong> — sem conta, sem servidor.</p>
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
                value={seedF.title}
                onChange={e => setSeedF(p => ({ ...p, title: e.target.value }))} />
            </Field>

            <Field label="Seed Phrase">
              <div className="cv-input-wrap cv-textarea-wrap">
                <textarea required rows={4} className="cv-textarea" placeholder="Escreva ou cole suas 12 ou 24 palavras aqui…"
                  value={seedF.seedPhrase}
                  style={{ WebkitTextSecurity: showSeed ? 'none' : 'disc' }}
                  onChange={e => setSeedF(p => ({ ...p, seedPhrase: e.target.value }))} />
                <button type="button" className="cv-eye cv-eye-ta" onClick={() => setShowSeed(p => !p)}>
                  {showSeed ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
              <small className="cv-hint">🔒 Cifrada com AES-256 e guardada somente neste aparelho</small>
            </Field>

            <Alert type="warning">⚠️ Certifique-se de estar em ambiente seguro e privado</Alert>
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

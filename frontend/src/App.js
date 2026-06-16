import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// ── Ícones inline (sem dependência externa) ──────────────────
const Icon = {
  Lock:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Key:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3"/></svg>,
  Eye:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Plus:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Copy:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  LogOut:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Shield:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Check:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  X:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
};

function Spinner() {
  return <span className="cv-spinner" aria-label="Carregando" />;
}

export default function App() {
  // ── Estado principal ─────────────────────────────────────
  const [view, setView]         = useState('login'); // 'login' | 'register' | 'qrcode' | 'dashboard'
  const [auth, setAuth]         = useState(null);    // { token, email }
  const [seeds, setSeeds]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [modal, setModal]       = useState(null);    // null | {type:'add'} | {type:'view', seed}
  const [qrData, setQrData]     = useState(null);    // { qrCode, backupCode }

  // ── Formulários ──────────────────────────────────────────
  const [loginF, setLoginF]     = useState({ email: '', password: '', totpCode: '' });
  const [regF, setRegF]         = useState({ email: '', password: '', confirm: '' });
  const [seedF, setSeedF]       = useState({ title: '', seedPhrase: '' });
  const [showPass, setShowPass] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [copied, setCopied]     = useState(false);

  // ── Restaura sessão do localStorage ──────────────────────
  useEffect(() => {
    const token = localStorage.getItem('cv_token');
    const email = localStorage.getItem('cv_email');
    if (token && email) {
      setAuth({ token, email });
      setView('dashboard');
    }
  }, []);

  // ── Carrega seeds ao entrar no dashboard ─────────────────
  useEffect(() => {
    if (view === 'dashboard' && auth) loadSeeds();
  }, [view, auth]);

  // ── Helpers ──────────────────────────────────────────────
  function clearMsgs()          { setError(''); setSuccess(''); }
  function goTo(v)              { clearMsgs(); setView(v); }
  function showSuccess(msg, ms = 3000) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), ms);
  }

  async function apiFetch(path, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...opts.headers,
    };
    const res  = await fetch(`${API_URL}${path}`, { ...opts, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
    return data;
  }

  function handleLogout() {
    localStorage.removeItem('cv_token');
    localStorage.removeItem('cv_email');
    setAuth(null);
    setSeeds([]);
    setModal(null);
    goTo('login');
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Handlers de autenticação ─────────────────────────────
  async function handleRegister(e) {
    e.preventDefault();
    clearMsgs();
    if (regF.password !== regF.confirm) return setError('As senhas não coincidem');
    if (regF.password.length < 8)       return setError('Senha deve ter pelo menos 8 caracteres');

    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body:   JSON.stringify({ email: regF.email, password: regF.password }),
      });
      setQrData({ qrCode: data.qrCode, backupCode: data.backupCode });
      setView('qrcode');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    clearMsgs();
    if (loginF.totpCode.length !== 6) return setError('O código 2FA deve ter 6 dígitos');

    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body:   JSON.stringify(loginF),
      });
      localStorage.setItem('cv_token', data.token);
      localStorage.setItem('cv_email', data.email);
      setAuth({ token: data.token, email: data.email });
      setLoginF({ email: '', password: '', totpCode: '' });
      setView('dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Seeds ────────────────────────────────────────────────
  async function loadSeeds() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/seeds');
      setSeeds(data.seeds || []);
    } catch (err) {
      if (err.message.includes('expirada') || err.message.includes('inválido')) handleLogout();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSeed(e) {
    e.preventDefault();
    clearMsgs();

    setLoading(true);
    try {
      const data = await apiFetch('/api/seeds', {
        method: 'POST',
        body:   JSON.stringify({ title: seedF.title.trim(), seedPhrase: seedF.seedPhrase.trim() }),
      });
      showSuccess(`✅ ${data.message}`);
      setModal(null);
      setSeedF({ title: '', seedPhrase: '' });
      setShowSeed(false);
      // Recarrega após alguns segundos (blockchain leva um momento)
      setTimeout(loadSeeds, 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ════════════════════════════════════════════════════════
  // TELA: LOGIN
  // ════════════════════════════════════════════════════════
  if (view === 'login') {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-auth">
          <div className="cv-brand">
            <div className="cv-brand-icon"><Icon.Shield /></div>
            <h1 className="cv-brand-name">CryptoVault</h1>
            <p className="cv-brand-sub">Suas seeds na blockchain, para sempre</p>
          </div>

          <form onSubmit={handleLogin} className="cv-form" noValidate>
            <Field label="Email">
              <input
                type="email" autoComplete="email" required
                placeholder="seu@email.com"
                value={loginF.email}
                onChange={e => setLoginF(p => ({ ...p, email: e.target.value }))}
              />
            </Field>

            <Field label="Senha">
              <div className="cv-input-wrap">
                <input
                  type={showPass ? 'text' : 'password'} autoComplete="current-password" required
                  placeholder="••••••••"
                  value={loginF.password}
                  onChange={e => setLoginF(p => ({ ...p, password: e.target.value }))}
                />
                <button type="button" className="cv-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
            </Field>

            <Field label="Código Google Authenticator (6 dígitos)">
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code"
                placeholder="000000" maxLength={6}
                className="cv-input-mono"
                value={loginF.totpCode}
                onChange={e => setLoginF(p => ({
                  ...p,
                  totpCode: e.target.value.replace(/\D/g, '').slice(0, 6),
                }))}
              />
            </Field>

            {error   && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">{success}</Alert>}

            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <Spinner /> : <><Icon.Lock /> Entrar</>}
            </button>
          </form>

          <div className="cv-sep"><span>Não tem conta?</span></div>

          <button onClick={() => goTo('register')} className="cv-btn cv-btn-ghost">
            Criar conta gratuita
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // TELA: CADASTRO
  // ════════════════════════════════════════════════════════
  if (view === 'register') {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-auth">
          <div className="cv-brand">
            <div className="cv-brand-icon"><Icon.Shield /></div>
            <h1 className="cv-brand-name">Criar Conta</h1>
            <p className="cv-brand-sub">Segurança em 3 camadas: senha + 2FA + blockchain</p>
          </div>

          <form onSubmit={handleRegister} className="cv-form" noValidate>
            <Field label="Email">
              <input
                type="email" autoComplete="email" required
                placeholder="seu@email.com"
                value={regF.email}
                onChange={e => setRegF(p => ({ ...p, email: e.target.value }))}
              />
            </Field>

            <Field label="Senha (mínimo 8 caracteres)">
              <div className="cv-input-wrap">
                <input
                  type={showPass ? 'text' : 'password'} autoComplete="new-password" required
                  placeholder="Crie uma senha forte"
                  value={regF.password}
                  onChange={e => setRegF(p => ({ ...p, password: e.target.value }))}
                />
                <button type="button" className="cv-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
              {regF.password && <PasswordStrength password={regF.password} />}
            </Field>

            <Field label="Confirmar Senha">
              <input
                type="password" autoComplete="new-password" required
                placeholder="Repita a senha"
                value={regF.confirm}
                onChange={e => setRegF(p => ({ ...p, confirm: e.target.value }))}
              />
            </Field>

            {error && <Alert type="error">{error}</Alert>}

            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <Spinner /> : <><Icon.Shield /> Criar Conta</>}
            </button>
          </form>

          <div className="cv-sep"><span>Já tem conta?</span></div>

          <button onClick={() => goTo('login')} className="cv-btn cv-btn-ghost">
            Fazer login
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // TELA: QR CODE 2FA
  // ════════════════════════════════════════════════════════
  if (view === 'qrcode' && qrData) {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-wide">
          <div className="cv-brand">
            <div className="cv-brand-icon cv-brand-icon--phone">📱</div>
            <h1 className="cv-brand-name">Configure o 2FA</h1>
            <p className="cv-brand-sub">Última etapa — leva menos de 1 minuto</p>
          </div>

          <div className="cv-steps">
            {[
              { n: '1', text: <span>Instale o <strong>Google Authenticator</strong> no celular</span> },
              { n: '2', text: <span>Abra o app → toque em <strong>+</strong> → <strong>Escanear QR code</strong></span> },
              { n: '3', text: <span>Escaneie o código abaixo e pronto!</span> },
            ].map(s => (
              <div key={s.n} className="cv-step">
                <span className="cv-step-n">{s.n}</span>
                <p>{s.text}</p>
              </div>
            ))}
          </div>

          <div className="cv-qr-wrap">
            <img src={qrData.qrCode} alt="QR Code para Google Authenticator" className="cv-qr" />
          </div>

          <div className="cv-backup">
            <p className="cv-backup-label">Código manual (caso não consiga escanear)</p>
            <code className="cv-backup-code" onClick={() => copyText(qrData.backupCode)}>
              {qrData.backupCode}
            </code>
            <small>Clique para copiar • Salve este código em local seguro!</small>
          </div>

          <Alert type="warning">
            ⚠️ <strong>Importante:</strong> Se perder o acesso ao Google Authenticator sem o código de backup acima, não conseguirá mais entrar na conta.
          </Alert>

          <button
            onClick={() => { setQrData(null); goTo('login'); }}
            className="cv-btn cv-btn-primary"
          >
            <Icon.Check /> Já escaneei — Ir para Login
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // TELA: DASHBOARD
  // ════════════════════════════════════════════════════════
  if (view === 'dashboard' && auth) {
    return (
      <div className="cv-dashboard">
        {/* Header */}
        <header className="cv-header">
          <div className="cv-header-brand">
            <div className="cv-header-icon"><Icon.Shield /></div>
            <span className="cv-header-name">CryptoVault</span>
          </div>
          <div className="cv-header-right">
            <span className="cv-header-email">{auth.email}</span>
            <button onClick={() => loadSeeds()} className="cv-btn-icon" title="Recarregar" disabled={loading}>
              <Icon.Refresh />
            </button>
            <button onClick={handleLogout} className="cv-btn-icon cv-btn-icon--logout" title="Sair">
              <Icon.LogOut />
            </button>
          </div>
        </header>

        {/* Conteúdo principal */}
        <main className="cv-main">
          {/* Barra de status */}
          <div className="cv-dash-top">
            <div>
              <h2 className="cv-dash-title">Minhas Seeds</h2>
              <p className="cv-dash-sub">
                {loading && seeds.length === 0
                  ? 'Carregando da blockchain...'
                  : `${seeds.length} seed${seeds.length !== 1 ? 's' : ''} armazenada${seeds.length !== 1 ? 's' : ''} na Avalanche`}
              </p>
            </div>
            <button
              onClick={() => { setModal({ type: 'add' }); clearMsgs(); }}
              className="cv-btn cv-btn-primary"
            >
              <Icon.Plus /> Nova Seed
            </button>
          </div>

          {error   && <Alert type="error"   className="cv-alert-float">{error}</Alert>}
          {success && <Alert type="success" className="cv-alert-float">{success}</Alert>}

          {/* Estado: carregando */}
          {loading && seeds.length === 0 && (
            <div className="cv-state-center">
              <Spinner />
              <p>Buscando suas seeds na blockchain...</p>
            </div>
          )}

          {/* Estado: vazio */}
          {!loading && seeds.length === 0 && (
            <div className="cv-state-center cv-empty">
              <div className="cv-empty-icon"><Icon.Key /></div>
              <h3>Nenhuma seed salva ainda</h3>
              <p>Clique em <strong>Nova Seed</strong> para armazenar sua primeira seed phrase de forma segura na blockchain.</p>
              <button
                onClick={() => setModal({ type: 'add' })}
                className="cv-btn cv-btn-primary"
              >
                <Icon.Plus /> Salvar primeira seed
              </button>
            </div>
          )}

          {/* Grid de seeds */}
          {seeds.length > 0 && (
            <div className="cv-grid">
              {seeds.map((seed, i) => (
                <div key={i} className="cv-seed-card">
                  <div className="cv-sc-header">
                    <div className="cv-sc-icon"><Icon.Key /></div>
                    <div className="cv-sc-info">
                      <h3 className="cv-sc-title">{seed.title}</h3>
                      <p className="cv-sc-date">{formatDate(seed.timestamp)}</p>
                    </div>
                  </div>
                  <div className="cv-sc-preview">
                    {'•'.repeat(6)} {' '}{'•'.repeat(6)} {' '}{'•'.repeat(6)} {' '}{'•'.repeat(6)}
                  </div>
                  <div className="cv-sc-footer">
                    <span className="cv-badge-chain">⛓ Avalanche Fuji</span>
                    <button
                      onClick={() => { setModal({ type: 'view', seed }); setShowSeed(false); setCopied(false); }}
                      className="cv-btn-view"
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
            <div className="cv-modal-header">
              <h3><Icon.Key /> Nova Seed</h3>
            </div>

            <form onSubmit={handleSaveSeed}>
              <Field label="Nome da carteira">
                <input
                  type="text" required maxLength={100} autoFocus
                  placeholder="Ex: Bitcoin Fria, Ethereum Principal…"
                  value={seedF.title}
                  onChange={e => setSeedF(p => ({ ...p, title: e.target.value }))}
                />
              </Field>

              <Field label="Seed Phrase">
                <div className="cv-input-wrap cv-textarea-wrap">
                  <textarea
                    required rows={4} className="cv-textarea"
                    placeholder="Escreva ou cole suas 12 ou 24 palavras aqui…"
                    value={seedF.seedPhrase}
                    style={{ WebkitTextSecurity: showSeed ? 'none' : 'disc' }}
                    onChange={e => setSeedF(p => ({ ...p, seedPhrase: e.target.value }))}
                  />
                  <button type="button" className="cv-eye cv-eye-ta" onClick={() => setShowSeed(p => !p)}>
                    {showSeed ? <Icon.EyeOff /> : <Icon.Eye />}
                  </button>
                </div>
                <small className="cv-hint">🔒 Criptografada com AES-256 antes de ir para a blockchain</small>
              </Field>

              <Alert type="warning">⚠️ Certifique-se de estar em ambiente seguro e privado</Alert>

              {error   && <Alert type="error">{error}</Alert>}
              {success && <Alert type="success">{success}</Alert>}

              <div className="cv-modal-actions">
                <button
                  type="button"
                  onClick={() => { setModal(null); clearMsgs(); setSeedF({ title: '', seedPhrase: '' }); setShowSeed(false); }}
                  className="cv-btn cv-btn-ghost"
                >
                  Cancelar
                </button>
                <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                  {loading
                    ? <><Spinner /> Salvando na blockchain…</>
                    : <><Icon.Shield /> Salvar com segurança</>}
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
                    <div key={i} className="cv-word">
                      <span className="cv-word-n">{i + 1}</span>
                      <span className="cv-word-text">{word}</span>
                    </div>
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

            <Alert type="warning">
              ⚠️ Nunca compartilhe sua seed phrase. Não tire print desta tela.
            </Alert>

            {success && <Alert type="success">{success}</Alert>}

            <div className="cv-modal-actions">
              {showSeed && (
                <button
                  type="button"
                  onClick={() => copyText(modal.seed.seedPhrase)}
                  className={`cv-btn ${copied ? 'cv-btn-copied' : 'cv-btn-ghost'}`}
                >
                  {copied ? <><Icon.Check /> Copiado!</> : <><Icon.Copy /> Copiar</>}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSeed(p => !p)}
                className="cv-btn cv-btn-primary"
              >
                {showSeed ? <><Icon.EyeOff /> Ocultar</> : <><Icon.Eye /> Revelar Seed</>}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return null;
}

// ── Componentes auxiliares ───────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="cv-field">
      <label className="cv-label">{label}</label>
      {children}
    </div>
  );
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
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
          <div
            key={i}
            className="cv-pwd-bar"
            style={{ background: i <= score ? colors[score] : 'var(--border)' }}
          />
        ))}
      </div>
      <span style={{ color: colors[score] }}>{labels[score]}</span>
    </div>
  );
}

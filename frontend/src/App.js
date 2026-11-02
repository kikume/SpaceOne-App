import React, { useState, useEffect } from 'react';
import Vault from './crypto';
import DeviceLock from './deviceLock';
import * as BioNative from './biometricNative';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || '';

// ── Ícones inline (sem dependência externa) ──────────────────
const Icon = {
  Lock:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Key:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3"/></svg>,
  Eye:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Plus:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Copy:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  Trash:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  LogOut:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Shield:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Check:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  Finger:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 11v4M8.5 9.5a4 4 0 017 2.5 9 9 0 01-1 4M6 13a8 8 0 01-.6-3 6.6 6.6 0 0111-4.9M9.2 18.3A6 6 0 0010 16"/></svg>,
  Phone:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>,
};

function Spinner() {
  return <span className="cv-spinner" aria-label="Carregando" />;
}

export default function App() {
  // ── Estado principal (TUDO em memória — nada sensível persiste) ──
  const [view, setView]       = useState('login'); // login | register | qrcode | recover | dashboard
  const [auth, setAuth]       = useState(null);     // { token, email }
  const [dek, setDek]         = useState(null);     // chave de dados (Uint8Array), só na memória
  const [seeds, setSeeds]     = useState([]);       // já DECIFRADAS no cliente
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal]     = useState(null);     // null | {type:'add'} | {type:'view', seed}
  const [regResult, setRegResult] = useState(null); // { qrCode, totpSecret, recoveryCode, secretKey, setupToken }
  const [savedRecovery, setSavedRecovery] = useState(false);
  const [totpConfirm, setTotpConfirm]     = useState({ code: '', ok: false });

  // ── Formulários ──────────────────────────────────────────
  const [loginF, setLoginF]   = useState({ email: '', password: '', totpCode: '' });
  const [regF, setRegF]       = useState({ email: '', password: '', confirm: '' });
  const [recF, setRecF]       = useState({ email: '', recoveryCode: '', secretKey: '', newPassword: '', confirm: '' });
  const [seedF, setSeedF]     = useState({ title: '', seedPhrase: '' });
  const [showPass, setShowPass] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [copied, setCopied]   = useState(false);

  // ── Dispositivo novo: pede Chave-Secreta só quando não está guardada localmente ──
  const [needsSecretKey, setNeedsSecretKey] = useState(false);
  const [newDeviceSK, setNewDeviceSK]       = useState('');

  // ── Desbloqueio rápido (PIN / biometria por aparelho) ────
  const [bioAvailable, setBioAvailable] = useState(false);
  const [unlockF, setUnlockF]   = useState({ pin: '' });
  const [pinSetup, setPinSetup] = useState({ pin: '', confirm: '', useBio: false });
  const [gateSeed, setGateSeed] = useState(null);
  const [gatePin, setGatePin]   = useState('');
  const [promptedPin, setPromptedPin] = useState(false);

  // ── Modo offline ─────────────────────────────────────────
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // ── Pagamento (acesso vitalício) ─────────────────────────
  const [payInfo, setPayInfo]   = useState(null);
  const [payQr, setPayQr]       = useState(null);
  const [payF, setPayF]         = useState({ signature: '' });

  // ── Carrega seeds ao entrar no dashboard ─────────────────
  useEffect(() => {
    if (view === 'dashboard' && auth && dek) loadSeeds();
    // eslint-disable-next-line
  }, [view, auth, dek]);

  // ── Ao abrir o app: se este aparelho já tem desbloqueio rápido, vai pra tela de unlock ──
  useEffect(() => {
    BioNative.isAvailable().then(setBioAvailable).catch(() => {});
    if (DeviceLock.isEnabled() && !auth) setView('unlock');
    const goOnline  = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
    // eslint-disable-next-line
  }, []);

  // ── Quando entra no paywall: busca QR code Solana Pay ───────
  useEffect(() => {
    if (view === 'paywall' && auth && !payQr) {
      apiFetch('/api/payment/qr').then(setPayQr).catch(() => {
        setError('Não foi possível carregar os dados de pagamento. Verifique sua conexão e recarregue.');
      });
    }
    // eslint-disable-next-line
  }, [view]);

  // ── Após primeiro login sem PIN: abre modal de configuração ──
  useEffect(() => {
    if (view === 'dashboard' && auth && !DeviceLock.isEnabled() && !promptedPin) {
      setPromptedPin(true);
      const t = setTimeout(() => setModal({ type: 'devicelock' }), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line
  }, [view]);

  // ── Helpers ──────────────────────────────────────────────
  function clearMsgs() { setError(''); setSuccess(''); }
  function goTo(v) { clearMsgs(); setView(v); }
  function showSuccess(msg, ms = 4000) {
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Erro de comunicação com o servidor');
      err.code = data.code;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function handleLogout() {
    setAuth(null);
    setDek(null);
    setSeeds([]);
    setModal(null);
    setPayInfo(null);
    setPayQr(null);
    goTo('login');
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text; el.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(el); el.select(); document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  function formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Cadastro: TODA a cripto acontece aqui, no navegador ──
  async function handleRegister(e) {
    e.preventDefault();
    clearMsgs();
    if (regF.password !== regF.confirm) return setError('As senhas não coincidem');
    if (regF.password.length < 8)       return setError('A senha deve ter pelo menos 8 caracteres');

    setLoading(true);
    try {
      const reg = await Vault.buildRegistration(regF.email.trim(), regF.password);
      // Guarda a Chave-Secreta neste aparelho para login automático nas próximas vezes
      try { localStorage.setItem('cv_sk_' + regF.email.trim().toLowerCase(), reg.secretKey); } catch {}
      const data = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(reg.payload) });
      setRegResult({ qrCode: data.qrCode, totpSecret: data.totpSecret, recoveryCode: reg.recoveryCode, secretKey: reg.secretKey, setupToken: data.setupToken });
      setSavedRecovery(false);
      setTotpConfirm({ code: '', ok: false });
      setRegF({ email: '', password: '', confirm: '' });
      setView('qrcode');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Login: deriva no cliente, desembrulha a DEK localmente ──
  async function handleLogin(e) {
    e.preventDefault();
    clearMsgs();
    if (loginF.totpCode.length !== 6) return setError('O código 2FA deve ter 6 dígitos');

    setLoading(true);
    try {
      const email = loginF.email.trim();
      const { kdfSalt } = await apiFetch(`/api/auth/params?email=${encodeURIComponent(email)}`);

      // Chave-Secreta: guardada localmente no aparelho; o usuário só precisa inserir numa vez (aparelho novo)
      const storedSK = localStorage.getItem('cv_sk_' + email.toLowerCase()) || newDeviceSK.trim();
      const derived  = await Vault.deriveLogin(loginF.password, kdfSalt, storedSK);

      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, authKey: derived.authKey, totpCode: loginF.totpCode }),
      });
      let dekBytes;
      try { dekBytes = await Vault.unwrapDek(derived.kek, data.wrappedDekPw); }
      catch {
        if (!storedSK) {
          setNeedsSecretKey(true);
          throw new Error('Aparelho novo detectado — insira sua Chave-Secreta abaixo e tente novamente');
        }
        throw new Error('Falha ao abrir o cofre. Verifique sua senha.');
      }

      // Guarda SK para futuros logins neste aparelho
      if (newDeviceSK.trim()) {
        try { localStorage.setItem('cv_sk_' + email.toLowerCase(), newDeviceSK.trim()); } catch {}
      }
      setLoginF({ email: '', password: '', totpCode: '' });
      setNewDeviceSK(''); setNeedsSecretKey(false);
      await gotoVault(data.token, data.email, dekBytes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Confirma o 2FA antes de concluir o cadastro (evita conta trancada) ──
  async function handleConfirmTotp(e) {
    e.preventDefault();
    clearMsgs();
    if (totpConfirm.code.length !== 6) return setError('Digite os 6 dígitos do app autenticador');
    setLoading(true);
    try {
      await apiFetch('/api/auth/register/verify-totp', {
        method: 'POST',
        body: JSON.stringify({ setupToken: regResult.setupToken, totpCode: totpConfirm.code }),
      });
      setTotpConfirm(p => ({ ...p, ok: true }));
      showSuccess('✅ 2FA confirmado — seu autenticador está funcionando!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Recuperação: usa o código de recuperação para redefinir a senha ──
  async function handleRecover(e) {
    e.preventDefault();
    clearMsgs();
    if (recF.newPassword !== recF.confirm) return setError('As senhas não coincidem');
    if (recF.newPassword.length < 8)       return setError('A nova senha deve ter pelo menos 8 caracteres');

    setLoading(true);
    try {
      const { kdfSaltRc } = await apiFetch(`/api/auth/recovery-params?email=${encodeURIComponent(recF.email.trim())}`);
      const r = await Vault.deriveRecovery(recF.recoveryCode.trim(), kdfSaltRc);
      const v = await apiFetch('/api/auth/recover/verify', {
        method: 'POST',
        body: JSON.stringify({ email: recF.email.trim(), recAuthKey: r.recAuthKey }),
      });
      let dekRec;
      try { dekRec = await Vault.unwrapDek(r.kek, v.wrappedDekRc); }
      catch { throw new Error('Código de recuperação incorreto'); }

      const reset = await Vault.buildPasswordReset(recF.newPassword, dekRec, recF.secretKey.trim());
      await apiFetch('/api/auth/recover/commit', {
        method: 'POST',
        body: JSON.stringify({ recoveryToken: v.recoveryToken, newAuthKey: reset.authKey, newKdfSalt: reset.kdfSalt, newWrappedDekPw: reset.wrappedDekPw }),
      });
      // Guarda a Chave-Secreta usada no reset: a nova senha foi atrelada a ELA.
      // Sem isto, o próximo login neste aparelho usaria uma chave antiga e falharia.
      try { localStorage.setItem('cv_sk_' + recF.email.trim().toLowerCase(), recF.secretKey.trim()); } catch {}
      setRecF({ email: '', recoveryCode: '', secretKey: '', newPassword: '', confirm: '' });
      goTo('login');
      showSuccess('✅ Senha redefinida! Entre com a nova senha.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Seeds ────────────────────────────────────────────────
  async function loadSeeds() {
    if (!dek) return;
    setLoading(true);
    try {
      const data = await apiFetch('/api/seeds');
      // Guarda blobs cifrados em cache local para acesso offline
      try { localStorage.setItem('cv_blobs_cache', JSON.stringify(data.seeds || [])); } catch {}
      const decrypted = await Promise.all((data.seeds || []).map(async (s) => {
        try {
          const o = await Vault.decryptSeed(dek, s.blob);
          return { id: s.id, title: o.title, seedPhrase: o.seedPhrase, timestamp: s.timestamp };
        } catch {
          return { id: s.id, title: '⚠️ Falha ao decifrar', seedPhrase: '', timestamp: s.timestamp, broken: true };
        }
      }));
      setIsOffline(false);
      setSeeds(decrypted);
    } catch (err) {
      // Tenta carregar do cache offline
      try {
        const raw = localStorage.getItem('cv_blobs_cache');
        if (raw && dek) {
          const cached = JSON.parse(raw);
          const decrypted = await Promise.all(cached.map(async (s) => {
            try {
              const o = await Vault.decryptSeed(dek, s.blob);
              return { id: s.id, title: o.title, seedPhrase: o.seedPhrase, timestamp: s.timestamp };
            } catch {
              return { id: s.id, title: '⚠️ Falha ao decifrar', seedPhrase: '', timestamp: s.timestamp, broken: true };
            }
          }));
          setSeeds(decrypted);
          setIsOffline(true);
          return;
        }
      } catch {}
      if (/expirada|inválido/i.test(err.message)) handleLogout();
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
      const blob = await Vault.encryptSeed(dek, seedF.title.trim(), seedF.seedPhrase.trim());
      await apiFetch('/api/seeds', { method: 'POST', body: JSON.stringify({ blob }) });
      setModal(null);
      setSeedF({ title: '', seedPhrase: '' });
      setShowSeed(false);
      showSuccess('🔒 Seed cifrada e salva com segurança');
      loadSeeds();
    } catch (err) {
      if (err.code === 'PAYMENT_REQUIRED') {
        setModal(null);
        goTo('paywall');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSeed(id) {
    if (!window.confirm('Apagar esta seed permanentemente? Esta ação não pode ser desfeita.')) return;
    setLoading(true);
    try {
      await apiFetch(`/api/seeds/${id}`, { method: 'DELETE' });
      setModal(null);
      showSuccess('Seed removida');
      loadSeeds();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Desbloqueio rápido: abrir o cofre por PIN / biometria ──
  async function openVaultWith(dekBytes, refreshToken) {
    try {
      const data = await apiFetch('/api/auth/device/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      setUnlockF({ pin: '' });
      await gotoVault(data.token, data.email, dekBytes);
    } catch {
      // Offline: usa email guardado localmente e entra em modo só-leitura
      const email = DeviceLock.enabledEmail() || '';
      setUnlockF({ pin: '' });
      setAuth({ token: '', email });
      setDek(dekBytes);
      setIsOffline(true);
      setView('dashboard');
    }
  }

  // Após autenticar: checa pagamento → vai pro cofre OU pro paywall
  async function gotoVault(token, email, dekBytes) {
    let info = null, paid = false;
    try {
      const r = await fetch(`${API_URL}/api/payment/status`, { headers: { Authorization: `Bearer ${token}` } });
      info = await r.json();
      paid = !!info.paid;
    } catch { /* offline: deixa entrar e o gate do backend protege */ paid = true; }
    setAuth({ token, email });
    setDek(dekBytes);
    setPayInfo(info);
    setView(paid ? 'dashboard' : 'paywall');
  }

  async function handleVerifyPayment(e) {
    e.preventDefault();
    clearMsgs();
    if (!payF.signature.trim()) return setError('Cole a assinatura (signature) da sua transação');
    setLoading(true);
    try {
      const d = await apiFetch('/api/payment/verify', { method: 'POST', body: JSON.stringify({ signature: payF.signature.trim() }) });
      setPayF({ signature: '' });
      showSuccess(d.message || 'Pagamento confirmado!');
      setView('dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlockPin(e) {
    e.preventDefault();
    clearMsgs();
    if (unlockF.pin.length < 4) return setError('Digite seu PIN');
    setLoading(true);
    try {
      const r = await DeviceLock.unlockPin(unlockF.pin);
      await openVaultWith(r.dek, r.refreshToken);
    } catch (err) {
      setError(err.message);
      if (!DeviceLock.isEnabled()) { setUnlockF({ pin: '' }); goTo('login'); } // foi auto-apagado
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlockBio() {
    clearMsgs();
    setLoading(true);
    try {
      const bioKeyB64 = await BioNative.getKey();
      const r = await DeviceLock.unlockBiometric(bioKeyB64);
      await openVaultWith(r.dek, r.refreshToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Ativar desbloqueio rápido neste aparelho ──
  async function handleEnableDeviceLock(e) {
    e.preventDefault();
    clearMsgs();
    if (!/^\d{4,8}$/.test(pinSetup.pin)) return setError('O PIN deve ter de 4 a 8 dígitos');
    if (pinSetup.pin !== pinSetup.confirm) return setError('Os PINs não coincidem');
    setLoading(true);
    try {
      const { refreshToken } = await apiFetch('/api/auth/device/enroll', {
        method: 'POST',
        body: JSON.stringify({ label: navigator.userAgent.slice(0, 60) }),
      });
      await DeviceLock.enrollPin({ email: auth.email, pin: pinSetup.pin, dek, refreshToken });
      let extra = '';
      if (pinSetup.useBio) {
        try {
          const bioKeyB64 = await DeviceLock.enrollBiometric({ dek, refreshToken });
          await BioNative.storeKey(auth.email, bioKeyB64);
        } catch { extra = ' (biometria não pôde ser ativada aqui — PIN funcionando)'; }
      }
      setModal(null);
      setPinSetup({ pin: '', confirm: '', useBio: false });
      showSuccess('🔒 Desbloqueio rápido ativado neste aparelho' + extra);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgetDevice() {
    if (!window.confirm('Desativar o desbloqueio rápido neste aparelho? No próximo acesso será necessário senha + 2FA.')) return;
    setLoading(true);
    try {
      await apiFetch('/api/auth/device/revoke', { method: 'POST' });
      DeviceLock.forget();
      await BioNative.deleteKey();
      setModal(null);
      showSuccess('Desbloqueio rápido desativado neste aparelho');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Trava por seed: revelar exige PIN/biometria (quando ativado) ──
  function requestReveal(seed) {
    clearMsgs();
    if (DeviceLock.isEnabled()) { setGateSeed(seed); setGatePin(''); }
    else { setModal({ type: 'view', seed }); setShowSeed(false); setCopied(false); }
  }

  async function handleGatePin(e) {
    e.preventDefault();
    clearMsgs();
    setLoading(true);
    try {
      await DeviceLock.verifyPin(gatePin, dek);
      const seed = gateSeed;
      setGateSeed(null); setGatePin('');
      setModal({ type: 'view', seed }); setShowSeed(true); setCopied(false);
    } catch (err) {
      setError(err.message);
      if (!DeviceLock.isEnabled()) { setGateSeed(null); handleLogout(); }
    } finally {
      setLoading(false);
    }
  }

  async function handleGateBio() {
    clearMsgs();
    setLoading(true);
    try {
      const bioKeyB64 = await BioNative.getKey();
      if (!(await DeviceLock.verifyBiometric(bioKeyB64, dek))) throw new Error('Biometria não confere');
      const seed = gateSeed;
      setGateSeed(null);
      setModal({ type: 'view', seed }); setShowSeed(true); setCopied(false);
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
            <h1 className="cv-brand-name">SpaceOne</h1>
            <p className="cv-brand-sub">Cifrado no seu dispositivo. Só você abre.</p>
          </div>

          <form onSubmit={handleLogin} className="cv-form" noValidate>
            <Field label="Email">
              <input type="email" autoComplete="email" required placeholder="seu@email.com"
                value={loginF.email}
                onChange={e => setLoginF(p => ({ ...p, email: e.target.value }))} />
            </Field>

            <Field label="Senha">
              <div className="cv-input-wrap">
                <input type={showPass ? 'text' : 'password'} autoComplete="current-password" required placeholder="••••••••"
                  value={loginF.password}
                  onChange={e => setLoginF(p => ({ ...p, password: e.target.value }))} />
                <button type="button" className="cv-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
            </Field>

            {needsSecretKey && (
              <>
                <Alert type="warning">
                  📱 Aparelho novo — insira a Chave-Secreta gerada no cadastro
                </Alert>
                <Field label="Chave-Secreta">
                  <input type="text" autoComplete="off" autoFocus placeholder="CV1-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" className="cv-input-mono"
                    value={newDeviceSK}
                    onChange={e => setNewDeviceSK(e.target.value.toUpperCase())} />
                </Field>
              </>
            )}

            <Field label="Código Google Authenticator (6 dígitos)">
              <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} className="cv-input-mono"
                value={loginF.totpCode}
                onChange={e => setLoginF(p => ({ ...p, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
            </Field>

            {error   && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">{success}</Alert>}

            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <Spinner /> : <><Icon.Lock /> Entrar</>}
            </button>
          </form>

          <button onClick={() => goTo('recover')} className="cv-link-btn">Esqueci minha senha</button>

          <div className="cv-sep"><span>Não tem conta?</span></div>
          <button onClick={() => goTo('register')} className="cv-btn cv-btn-ghost">Criar conta gratuita</button>
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
            <p className="cv-brand-sub">Criptografia ponta-a-ponta: o servidor nunca vê suas seeds</p>
          </div>

          <form onSubmit={handleRegister} className="cv-form" noValidate>
            <Field label="Email">
              <input type="email" autoComplete="email" required placeholder="seu@email.com"
                value={regF.email}
                onChange={e => setRegF(p => ({ ...p, email: e.target.value }))} />
            </Field>

            <Field label="Senha (mínimo 8 caracteres)">
              <div className="cv-input-wrap">
                <input type={showPass ? 'text' : 'password'} autoComplete="new-password" required placeholder="Crie uma senha forte"
                  value={regF.password}
                  onChange={e => setRegF(p => ({ ...p, password: e.target.value }))} />
                <button type="button" className="cv-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
              {regF.password && <PasswordStrength password={regF.password} />}
            </Field>

            <Field label="Confirmar Senha">
              <input type="password" autoComplete="new-password" required placeholder="Repita a senha"
                value={regF.confirm}
                onChange={e => setRegF(p => ({ ...p, confirm: e.target.value }))} />
            </Field>

            <Alert type="warning">
              ⚠️ Sua senha é a <strong>única</strong> chave que abre o cofre. Se esquecê-la, só o código de recuperação (gerado a seguir) recupera o acesso.
            </Alert>

            {error && <Alert type="error">{error}</Alert>}

            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <><Spinner /> Gerando suas chaves…</> : <><Icon.Shield /> Criar Conta</>}
            </button>
          </form>

          <div className="cv-sep"><span>Já tem conta?</span></div>
          <button onClick={() => goTo('login')} className="cv-btn cv-btn-ghost">Fazer login</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // TELA: QR CODE 2FA + CÓDIGO DE RECUPERAÇÃO
  // ════════════════════════════════════════════════════════
  if (view === 'qrcode' && regResult) {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-wide">
          <div className="cv-brand">
            <div className="cv-brand-icon cv-brand-icon--phone">📱</div>
            <h1 className="cv-brand-name">Quase lá — 2 passos</h1>
            <p className="cv-brand-sub">Configure o 2FA e guarde seu código de recuperação</p>
          </div>

          <div className="cv-steps">
            {[
              { n: '1', text: <span>Instale o <strong>Google Authenticator</strong> no celular</span> },
              { n: '2', text: <span>Abra o app → <strong>+</strong> → <strong>Escanear QR code</strong></span> },
              { n: '3', text: <span>Escaneie o código abaixo</span> },
            ].map(s => (
              <div key={s.n} className="cv-step"><span className="cv-step-n">{s.n}</span><p>{s.text}</p></div>
            ))}
          </div>

          <div className="cv-qr-wrap">
            <img src={regResult.qrCode} alt="QR Code para Google Authenticator" className="cv-qr" />
          </div>

          <div className="cv-backup">
            <p className="cv-backup-label">Não consegue escanear? Código manual do 2FA</p>
            <code className="cv-backup-code" onClick={() => copyText(regResult.totpSecret)}>{regResult.totpSecret}</code>
            <small>Clique para copiar</small>
          </div>

          {/* CONFIRMAÇÃO DO 2FA — garante que o autenticador funciona antes de sair da tela */}
          <div className="cv-recovery-box">
            <div className="cv-recovery-head"><Icon.Check /> <strong>Confirme o 2FA</strong></div>
            {totpConfirm.ok ? (
              <Alert type="success">✅ Autenticador confirmado — você já consegue gerar códigos de login.</Alert>
            ) : (
              <form onSubmit={handleConfirmTotp} className="cv-form" noValidate>
                <Field label="Digite o código de 6 dígitos que aparece no app">
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} className="cv-input-mono"
                    value={totpConfirm.code}
                    onChange={e => setTotpConfirm(p => ({ ...p, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                </Field>
                <button type="submit" className="cv-btn cv-btn-ghost" disabled={loading}>
                  {loading ? <Spinner /> : <><Icon.Check /> Confirmar código</>}
                </button>
              </form>
            )}
          </div>

          {/* CHAVE-SECRETA — crítico */}
          <div className="cv-recovery-box">
            <div className="cv-recovery-head"><Icon.Key /> <strong>Sua Chave-Secreta</strong></div>
            <code className="cv-recovery-code" onClick={() => copyText(regResult.secretKey)}>{regResult.secretKey}</code>
            <small>Clique para copiar</small>
            <Alert type="warning">
              🗝️ Necessária para <strong>entrar em qualquer aparelho novo</strong>. Sem ela, nem você nem nós abrimos o cofre — nem com a senha certa. Guarde-a <strong>offline</strong>, junto com o código de recuperação.
            </Alert>
          </div>

          {/* CÓDIGO DE RECUPERAÇÃO — crítico */}
          <div className="cv-recovery-box">
            <div className="cv-recovery-head"><Icon.Key /> <strong>Seu código de recuperação</strong></div>
            <code className="cv-recovery-code" onClick={() => copyText(regResult.recoveryCode)}>{regResult.recoveryCode}</code>
            <small>Clique para copiar</small>
            <Alert type="warning">
              🔑 É a <strong>única</strong> forma de recuperar o acesso se você esquecer a senha. Guarde-o <strong>offline</strong> (papel ou gerenciador de senhas). Não mostraremos de novo, e nós <strong>não conseguimos</strong> recuperá-lo por você.
            </Alert>
            <label className="cv-checkbox">
              <input type="checkbox" checked={savedRecovery} onChange={e => setSavedRecovery(e.target.checked)} />
              <span>Salvei meu código de recuperação <strong>e minha Chave-Secreta</strong> em local seguro</span>
            </label>
          </div>

          {error   && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          <button
            onClick={() => { setRegResult(null); goTo('login'); }}
            className="cv-btn cv-btn-primary"
            disabled={!savedRecovery || !totpConfirm.ok}
            title={!totpConfirm.ok ? 'Confirme o código 2FA acima antes de concluir' : (!savedRecovery ? 'Confirme que salvou os códigos' : '')}
          >
            <Icon.Check /> Concluir — Ir para Login
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // TELA: RECUPERAÇÃO DE SENHA
  // ════════════════════════════════════════════════════════
  if (view === 'recover') {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-auth">
          <div className="cv-brand">
            <div className="cv-brand-icon"><Icon.Key /></div>
            <h1 className="cv-brand-name">Recuperar acesso</h1>
            <p className="cv-brand-sub">Use seu código de recuperação para definir uma nova senha</p>
          </div>

          <form onSubmit={handleRecover} className="cv-form" noValidate>
            <Field label="Email">
              <input type="email" autoComplete="email" required placeholder="seu@email.com"
                value={recF.email}
                onChange={e => setRecF(p => ({ ...p, email: e.target.value }))} />
            </Field>

            <Field label="Código de recuperação">
              <input type="text" required placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" className="cv-input-mono"
                value={recF.recoveryCode}
                onChange={e => setRecF(p => ({ ...p, recoveryCode: e.target.value.toUpperCase() }))} />
            </Field>

            <Field label="Chave-Secreta">
              <input type="text" required placeholder="CV1-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" className="cv-input-mono"
                value={recF.secretKey}
                onChange={e => setRecF(p => ({ ...p, secretKey: e.target.value.toUpperCase() }))} />
            </Field>

            <Field label="Nova senha (mínimo 8 caracteres)">
              <div className="cv-input-wrap">
                <input type={showPass ? 'text' : 'password'} autoComplete="new-password" required placeholder="Nova senha forte"
                  value={recF.newPassword}
                  onChange={e => setRecF(p => ({ ...p, newPassword: e.target.value }))} />
                <button type="button" className="cv-eye" onClick={() => setShowPass(p => !p)}>
                  {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
              {recF.newPassword && <PasswordStrength password={recF.newPassword} />}
            </Field>

            <Field label="Confirmar nova senha">
              <input type="password" autoComplete="new-password" required placeholder="Repita a nova senha"
                value={recF.confirm}
                onChange={e => setRecF(p => ({ ...p, confirm: e.target.value }))} />
            </Field>

            {error && <Alert type="error">{error}</Alert>}

            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <><Spinner /> Recuperando…</> : <><Icon.Key /> Redefinir senha</>}
            </button>
          </form>

          <div className="cv-sep"><span>Lembrou a senha?</span></div>
          <button onClick={() => goTo('login')} className="cv-btn cv-btn-ghost">Voltar ao login</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // TELA: DESBLOQUEIO RÁPIDO (PIN / biometria)
  // ════════════════════════════════════════════════════════
  if (view === 'unlock') {
    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-auth">
          <div className="cv-brand">
            <div className="cv-brand-icon"><Icon.Lock /></div>
            <h1 className="cv-brand-name">Desbloquear</h1>
            <p className="cv-brand-sub">{DeviceLock.enabledEmail()}</p>
          </div>

          <form onSubmit={handleUnlockPin} className="cv-form" noValidate>
            <Field label="PIN">
              <input
                type="password" inputMode="numeric" autoComplete="off" autoFocus
                className="cv-input-pin" placeholder="••••" maxLength={8}
                value={unlockF.pin}
                onChange={e => setUnlockF({ pin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
              />
            </Field>

            {error   && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">{success}</Alert>}

            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <Spinner /> : <><Icon.Lock /> Desbloquear</>}
            </button>
          </form>

          {DeviceLock.hasBiometric() && (
            <button onClick={handleUnlockBio} className="cv-btn cv-btn-ghost" disabled={loading}>
              <Icon.Finger /> Usar biometria
            </button>
          )}

          <button onClick={() => goTo('login')} className="cv-link-btn">Entrar com senha completa</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // TELA: PAYWALL (pagamento único para liberar)
  // ════════════════════════════════════════════════════════
  if (view === 'paywall' && auth) {
    // Endereço e URI vêm SEMPRE do servidor — nunca de um fallback local,
    // para não haver risco de pagamento a um endereço que a API não reconhece.
    const price     = (payQr && payQr.price)   || (payInfo && payInfo.priceUsd) || 2;
    const address   = (payQr && payQr.address) || (payInfo && payInfo.address)  || null;
    const solanaUri = (payQr && payQr.uri) || null;

    function openWallet() {
      if (!solanaUri) return;
      try { window.open(solanaUri, '_system'); } catch { window.location.href = solanaUri; }
    }

    return (
      <div className="cv-bg">
        <div className="cv-card cv-card-wide">
          <div className="cv-brand">
            <div className="cv-brand-icon"><Icon.Shield /></div>
            <h1 className="cv-brand-name">Acesso vitalício</h1>
            <p className="cv-brand-sub">Pagamento único · ${price} USDC · rede Solana · sem mensalidade</p>
          </div>

          {/* ── QR code + endereço ── */}
          <div className="cv-pay-box">
            {payQr
              ? <img src={payQr.qr} alt="QR Code Solana Pay" className="cv-pay-qr" />
              : <div className="cv-pay-qr-ph"><Spinner /></div>
            }
            <p className="cv-pay-scan">Escaneie com Phantom, Solflare ou qualquer carteira Solana</p>

            <div className="cv-pay-addr-row">
              <code className="cv-pay-addr">{address || 'Carregando endereço…'}</code>
              <button type="button" className="cv-btn-icon-sm" onClick={() => address && copyText(address)} title="Copiar endereço" disabled={!address}>
                {copied ? <Icon.Check /> : <Icon.Copy />}
              </button>
            </div>
            <small className="cv-hint">{copied ? '✅ Endereço copiado!' : `Toque para copiar · USDC · $${price}`}</small>

            <button type="button" className="cv-btn cv-btn-primary cv-btn-pay-wallet" onClick={openWallet} disabled={!solanaUri}>
              <Icon.Key /> Abrir carteira Solana
            </button>
          </div>

          {/* ── Verificação ── */}
          <form onSubmit={handleVerifyPayment} className="cv-form">
            <Field label="Após pagar, cole o ID da transação">
              <input type="text" required placeholder="5GKd8FQ3Xw…" className="cv-input-mono"
                value={payF.signature}
                onChange={e => setPayF({ signature: e.target.value.trim() })} />
            </Field>
            <small className="cv-hint" style={{ marginTop: -10, display: 'block', marginBottom: 12 }}>
              Phantom → Atividade → toque na transação → Copiar ID
            </small>
            {error   && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">{success}</Alert>}
            <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
              {loading ? <><Spinner /> Verificando na blockchain…</> : <><Icon.Check /> Já paguei — Liberar acesso</>}
            </button>
          </form>

          <button onClick={handleLogout} className="cv-link-btn">Sair</button>
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
        <header className="cv-header">
          <div className="cv-header-brand">
            <div className="cv-header-icon"><Icon.Shield /></div>
            <span className="cv-header-name">SpaceOne</span>
          </div>
          <div className="cv-header-right">
            {isOffline && <span className="cv-badge-offline">● Offline</span>}
            <span className="cv-header-email">{auth.email}</span>
            <button onClick={() => { setModal({ type: 'devicelock' }); clearMsgs(); }} className="cv-btn-icon" title="Desbloqueio rápido (PIN/biometria)" disabled={isOffline}><Icon.Phone /></button>
            <button onClick={() => loadSeeds()} className="cv-btn-icon" title="Recarregar" disabled={loading || isOffline}><Icon.Refresh /></button>
            <button onClick={handleLogout} className="cv-btn-icon cv-btn-icon--logout" title="Sair"><Icon.LogOut /></button>
          </div>
        </header>

        <main className="cv-main">
          <div className="cv-dash-top">
            <div>
              <h2 className="cv-dash-title">Minhas Seeds</h2>
              <p className="cv-dash-sub">
                {loading && seeds.length === 0
                  ? 'Descriptografando…'
                  : isOffline
                  ? `${seeds.length} seed${seeds.length !== 1 ? 's' : ''} em cache local · modo offline`
                  : `${seeds.length} seed${seeds.length !== 1 ? 's' : ''} cifrada${seeds.length !== 1 ? 's' : ''} de ponta a ponta`}
              </p>
            </div>
            <button onClick={() => { setModal({ type: 'add' }); clearMsgs(); }} className="cv-btn cv-btn-primary" disabled={isOffline} title={isOffline ? 'Sem ligação — ligue-se para guardar seeds' : ''}>
              <Icon.Plus /> Nova Seed
            </button>
          </div>

          {error   && <Alert type="error"   className="cv-alert-float">{error}</Alert>}
          {success && <Alert type="success" className="cv-alert-float">{success}</Alert>}

          {loading && seeds.length === 0 && (
            <div className="cv-state-center"><Spinner /><p>Descriptografando suas seeds no seu navegador…</p></div>
          )}

          {!loading && seeds.length === 0 && (
            <div className="cv-state-center cv-empty">
              <div className="cv-empty-icon"><Icon.Key /></div>
              <h3>Nenhuma seed salva ainda</h3>
              <p>Clique em <strong>Nova Seed</strong> para guardar sua primeira seed phrase com criptografia de ponta a ponta.</p>
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
                      onClick={() => requestReveal(seed)}
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
                <small className="cv-hint">🔒 Cifrada no seu navegador (AES-256) — o servidor só recebe o texto embaralhado</small>
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
              <button type="button" onClick={() => handleDeleteSeed(modal.seed.id)} className="cv-btn cv-btn-danger" disabled={loading || isOffline} title="Apagar seed">
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

        {/* ── Trava por seed: PIN/biometria para revelar ── */}
        {gateSeed && (
          <Modal onClose={() => { setGateSeed(null); setGatePin(''); clearMsgs(); }}>
            <div className="cv-modal-header">
              <h3><Icon.Lock /> Revelar “{gateSeed.title}”</h3>
              <p className="cv-modal-date">Confirme com seu PIN{DeviceLock.hasBiometric() ? ' ou biometria' : ''}</p>
            </div>
            <form onSubmit={handleGatePin}>
              <Field label="PIN">
                <input type="password" inputMode="numeric" autoFocus className="cv-input-pin" placeholder="••••" maxLength={8}
                  value={gatePin}
                  onChange={e => setGatePin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
              </Field>
              {error && <Alert type="error">{error}</Alert>}
              <div className="cv-modal-actions">
                {DeviceLock.hasBiometric() && (
                  <button type="button" onClick={handleGateBio} className="cv-btn cv-btn-ghost" disabled={loading}><Icon.Finger /> Biometria</button>
                )}
                <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                  {loading ? <Spinner /> : <><Icon.Eye /> Revelar</>}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── Configurar desbloqueio rápido ── */}
        {modal?.type === 'devicelock' && (
          <Modal onClose={() => { setModal(null); setPinSetup({ pin: '', confirm: '', useBio: false }); clearMsgs(); }}>
            <div className="cv-modal-header">
              <h3><Icon.Phone /> Desbloqueio rápido</h3>
              <p className="cv-modal-date">Abrir o cofre neste aparelho com PIN ou biometria</p>
            </div>

            {DeviceLock.isEnabled() ? (
              <>
                <Alert type="success">✅ Ativo neste aparelho{DeviceLock.hasBiometric() ? ' (com biometria)' : ''}.</Alert>
                <p className="cv-hint" style={{ marginBottom: 16 }}>
                  As próximas aberturas pedem só o PIN/biometria. A proteção total continua sendo senha + 2FA.
                </p>
                <div className="cv-modal-actions">
                  <button onClick={handleForgetDevice} className="cv-btn cv-btn-danger" disabled={loading}>
                    {loading ? <Spinner /> : 'Desativar neste aparelho'}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleEnableDeviceLock}>
                <Alert type="warning">
                  ⚠️ Guarda uma cópia <strong>cifrada</strong> da chave neste aparelho, protegida pelo PIN. Conveniência com algum risco — ative só em aparelhos seus. Após 5 PINs errados, apaga sozinho.
                </Alert>
                <Field label="Criar PIN (4 a 8 dígitos — 6+ recomendado)">
                  <input type="password" inputMode="numeric" autoFocus className="cv-input-pin" placeholder="••••••" maxLength={8}
                    value={pinSetup.pin}
                    onChange={e => setPinSetup(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 8) }))} />
                </Field>
                <Field label="Confirmar PIN">
                  <input type="password" inputMode="numeric" className="cv-input-pin" placeholder="••••••" maxLength={8}
                    value={pinSetup.confirm}
                    onChange={e => setPinSetup(p => ({ ...p, confirm: e.target.value.replace(/\D/g, '').slice(0, 8) }))} />
                </Field>
                {bioAvailable && (
                  <label className="cv-checkbox">
                    <input type="checkbox" checked={pinSetup.useBio} onChange={e => setPinSetup(p => ({ ...p, useBio: e.target.checked }))} />
                    <span>Também usar biometria (Face ID / digital) neste aparelho</span>
                  </label>
                )}
                {error && <Alert type="error">{error}</Alert>}
                <div className="cv-modal-actions">
                  <button type="button" onClick={() => { setModal(null); setPinSetup({ pin: '', confirm: '', useBio: false }); clearMsgs(); }} className="cv-btn cv-btn-ghost">Cancelar</button>
                  <button type="submit" className="cv-btn cv-btn-primary" disabled={loading}>
                    {loading ? <Spinner /> : <><Icon.Lock /> Ativar</>}
                  </button>
                </div>
              </form>
            )}
          </Modal>
        )}
      </div>
    );
  }

  return null;
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

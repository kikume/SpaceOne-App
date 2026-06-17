/* ============================================================
 * biometricNative.js — Biometria NATIVA (Android/iOS) via Capacitor.
 *
 * Usa o cofre seguro do sistema (Android Keystore / iOS Keychain) para
 * guardar a bioKey que embrulha a DEK. A chave só é liberada após a
 * biometria do aparelho (digital / Face ID). Hardware-backed.
 *
 * Só roda no app nativo. Na web, isAvailable() retorna false (a biometria
 * fica indisponível e o usuário usa o PIN).
 * ============================================================ */
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const SERVER = 'cryptovault.devicelock';

/** Há biometria utilizável neste aparelho? (false na web) */
export async function isAvailable() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const r = await NativeBiometric.isAvailable({ useFallback: false });
    return !!(r && r.isAvailable);
  } catch {
    return false;
  }
}

/** Guarda a bioKey (base64) no cofre seguro do sistema. */
export async function storeKey(email, keyB64) {
  await NativeBiometric.setCredentials({
    username: email || 'cryptovault',
    password: keyB64,
    server: SERVER,
  });
}

/** Pede biometria e devolve a bioKey (base64). Lança se cancelar/falhar. */
export async function getKey() {
  await NativeBiometric.verifyIdentity({
    title: 'CryptoVault',
    subtitle: 'Desbloquear com biometria',
    reason: 'Confirme sua identidade para abrir o cofre',
  });
  const cred = await NativeBiometric.getCredentials({ server: SERVER });
  return cred.password;
}

/** Remove a bioKey do cofre seguro (ao desativar o desbloqueio). */
export async function deleteKey() {
  try { await NativeBiometric.deleteCredentials({ server: SERVER }); } catch { /* ignore */ }
}

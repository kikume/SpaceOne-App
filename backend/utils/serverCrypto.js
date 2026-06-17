const crypto = require('crypto');

/**
 * Criptografia "em repouso" para o segredo do 2FA (TOTP).
 * O servidor PRECISA ler o segredo TOTP para verificar o código, então
 * não dá para ser cego aqui — mas guardamos cifrado com uma chave que
 * fica só no ambiente (TOTP_ENC_KEY), não no banco. Assim, um vazamento
 * SÓ do banco não expõe os segredos 2FA.
 */
function key() {
  const hex = process.env.TOTP_ENC_KEY || '';
  if (hex.length !== 64) {
    throw new Error('TOTP_ENC_KEY ausente ou inválida (esperado 32 bytes em hex = 64 chars)');
  }
  return Buffer.from(hex, 'hex');
}

function encryptAtRest(plaintext) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptAtRest(b64) {
  const data = Buffer.from(b64, 'base64');
  const iv   = data.subarray(0, 12);
  const tag  = data.subarray(12, 28);
  const ct   = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Salt determinístico e não-revelador para emails inexistentes,
 *  evitando que /params permita enumerar quem tem conta. */
function decoySalt(label, email) {
  const pepper = process.env.PARAMS_PEPPER || 'fallback-pepper';
  return crypto.createHmac('sha256', pepper)
    .update(`${label}:${email.toLowerCase().trim()}`)
    .digest()
    .subarray(0, 16)
    .toString('base64');
}

module.exports = { encryptAtRest, decryptAtRest, decoySalt };

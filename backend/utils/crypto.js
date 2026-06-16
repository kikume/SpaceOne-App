const crypto = require('crypto');

/**
 * Deriva uma chave AES-256 determinística a partir do hash da senha + email.
 * Mesmos inputs = mesma chave. Muda a senha = não consegue descriptografar seeds antigas.
 */
function deriveKey(passwordHash, email) {
  return crypto.pbkdf2Sync(
    passwordHash,
    email.toLowerCase(),
    100_000,
    32,
    'sha256'
  );
}

/**
 * Retorna os primeiros 32 chars do SHA-256 do email.
 * Usado como prefixo no título da blockchain para identificar o dono da seed.
 */
function getEmailHash(email) {
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex')
    .substring(0, 32);
}

/**
 * Criptografa um texto com AES-256-CBC.
 * Retorna uma string no formato "iv_base64:dados_base64".
 */
function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Descriptografa uma string no formato "iv_base64:dados_base64".
 */
function decrypt(encryptedData, key) {
  const colonIndex = encryptedData.indexOf(':');
  if (colonIndex === -1) throw new Error('Formato de dado criptografado inválido');

  const iv        = Buffer.from(encryptedData.slice(0, colonIndex), 'base64');
  const encrypted = Buffer.from(encryptedData.slice(colonIndex + 1), 'base64');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { deriveKey, getEmailHash, encrypt, decrypt };

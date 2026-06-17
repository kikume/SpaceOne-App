require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    // Nota: o servidor é "cego" — guarda apenas verificadores e blobs cifrados.
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id              SERIAL PRIMARY KEY,
        email           VARCHAR(255) UNIQUE NOT NULL,
        auth_hash       VARCHAR(255) NOT NULL,   -- bcrypt(authKey derivado da senha)
        rec_auth_hash   VARCHAR(255) NOT NULL,   -- bcrypt(authKey derivado do cód. recuperação)
        kdf_salt        VARCHAR(255) NOT NULL,   -- salt p/ derivar da senha (não-secreto)
        kdf_salt_rc     VARCHAR(255) NOT NULL,   -- salt p/ derivar do cód. recuperação
        wrapped_dek_pw  TEXT NOT NULL,           -- DEK embrulhada pela senha
        wrapped_dek_rc  TEXT NOT NULL,           -- DEK embrulhada pelo cód. recuperação
        totp_secret_enc TEXT NOT NULL,           -- segredo 2FA cifrado em repouso
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS seeds (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blob       TEXT NOT NULL,                -- {title, seedPhrase} cifrado com a DEK
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_seeds_user ON seeds(user_id)`);

    // Refresh tokens por dispositivo (desbloqueio rápido). Guardamos só o HASH.
    await client.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash   VARCHAR(64) NOT NULL UNIQUE,
        label        VARCHAR(100),
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        last_used_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id)`);
    console.log('✅ Banco inicializado (users + seeds + device_tokens)');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };

# CryptoVault — Instruções de Deploy

## PASSO 0 — Pré-requisitos

- Node.js 18+ instalado
- PostgreSQL instalado (para rodar localmente) **OU** conta no Render.com (gratuito)
- Conta no Netlify.com (gratuito, para o frontend)
- Carteira Ethereum/Avalanche com saldo na testnet Fuji

---

## PASSO 1 — Configurar o Backend

### 1.1 — Instalar dependências

```bash
cd backend
npm install
```

### 1.2 — Criar o arquivo .env

Copie o exemplo e preencha os valores:

```bash
cp .env.example .env
```

Abra o `.env` e preencha:

```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:SUASENHA@localhost:5432/cryptovault
JWT_SECRET=GERE_COM_COMANDO_ABAIXO
MASTER_PRIVATE_KEY=0xSUA_CHAVE_PRIVADA
CONTRACT_ADDRESS=0x3Eb2b227d0f7aC2bFf07d3A617b2d9A04e2d91EeE
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
FRONTEND_URL=http://localhost:3000
```

#### Gerar JWT_SECRET seguro:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### Obter AVAX grátis na testnet Fuji:
1. Acesse: https://faucet.avax.network/
2. Cole o endereço da carteira mestre
3. Selecione "C-Chain" e solicite

### 1.3 — Criar banco de dados local (se não usar Render)

```bash
# No psql ou pgAdmin, execute:
CREATE DATABASE cryptovault;
```

O backend cria as tabelas automaticamente na inicialização.

### 1.4 — Rodar localmente

```bash
npm run dev
```

Saída esperada:
```
✅ Banco de dados inicializado
🔗 Blockchain conectada. Carteira mestre: 0x...
╔══════════════════════════════════════════╗
║       🔐  CryptoVault API Online         ║
...
```

---

## PASSO 2 — Configurar o Frontend

### 2.1 — Instalar dependências

```bash
cd frontend
npm install
```

### 2.2 — Criar o arquivo .env

```bash
# Crie o arquivo .env na pasta frontend/:
echo REACT_APP_API_URL=http://localhost:3001 > .env
```

Em produção, mude para a URL do backend no Render.

### 2.3 — Rodar localmente

```bash
npm start
```

Acesse: http://localhost:3000

---

## PASSO 3 — Rodar os Testes

Com o backend rodando (`npm run dev`):

```bash
cd backend
npm test
```

Os testes vão criar um usuário de teste, verificar o 2FA, salvar uma seed na blockchain e verificar a descriptografia.

**Atenção:** O teste de blockchain leva ~15 segundos por precisar aguardar a transação ser minerada na Fuji.

---

## PASSO 4 — Deploy no Render.com (Backend + Banco de Dados)

O Render tem plano gratuito suficiente para o MVP.

### 4.1 — Subir o código para o GitHub

```bash
# Na raiz do projeto CryptoVault:
git init
git add .
git commit -m "feat: CryptoVault MVP"
git remote add origin https://github.com/SEU_USUARIO/cryptovault.git
git push -u origin main
```

### 4.2 — Criar banco PostgreSQL no Render

1. Acesse https://render.com → New → PostgreSQL
2. Nome: `cryptovault-db`
3. Plano: Free
4. Clique em "Create Database"
5. Copie o valor de **"External Database URL"** (começa com `postgresql://...`)

### 4.3 — Criar Web Service no Render (Backend)

1. New → Web Service
2. Conecte o repositório GitHub
3. Configure:
   - **Name:** `cryptovault-api`
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
4. Em **Environment Variables**, adicione:

| Chave                | Valor                                         |
|----------------------|-----------------------------------------------|
| `NODE_ENV`           | `production`                                  |
| `DATABASE_URL`       | (cole a URL do banco criado no passo 4.2)     |
| `JWT_SECRET`         | (use o mesmo gerado no passo 1.2)             |
| `MASTER_PRIVATE_KEY` | `0x...` (sua chave privada)                   |
| `CONTRACT_ADDRESS`   | `0x3Eb2b227d0f7aC2bFf07d3A617b2d9A04e2d91EeE`|
| `RPC_URL`            | `https://api.avax-test.network/ext/bc/C/rpc`  |
| `FRONTEND_URL`       | (URL do seu frontend no Netlify — preencha depois) |

5. Clique em **Create Web Service**
6. Aguarde o deploy (~2 minutos). URL será algo como: `https://cryptovault-api.onrender.com`

---

## PASSO 5 — Deploy no Netlify.com (Frontend)

### 5.1 — Build do frontend

```bash
cd frontend
REACT_APP_API_URL=https://cryptovault-api.onrender.com npm run build
```

Isso gera a pasta `frontend/build/`.

### 5.2 — Deploy manual no Netlify

1. Acesse https://netlify.com → Add new site → Deploy manually
2. Arraste a pasta `frontend/build/` para a área indicada
3. O Netlify vai gerar uma URL como: `https://cryptovault-xyz.netlify.app`

### 5.3 — OU: Deploy automático via GitHub

1. New site → Import an existing project → GitHub
2. Repositório: `cryptovault`
3. Configure:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/build`
4. Em **Environment variables**, adicione:
   - `REACT_APP_API_URL` = `https://cryptovault-api.onrender.com`
5. Deploy

### 5.4 — Atualizar FRONTEND_URL no Render

Volte ao Render → seu backend → Environment → atualize `FRONTEND_URL` com a URL do Netlify → Save → o Render vai redeployar automaticamente.

---

## PASSO 6 — Verificar que tudo funciona

1. Acesse a URL do frontend no Netlify
2. Crie uma conta (email + senha)
3. Escaneie o QR Code com o Google Authenticator
4. Faça login com email + senha + código 6 dígitos
5. Salve uma seed de teste
6. Aguarde ~15 segundos e recarregue — a seed deve aparecer

---

## Arquitetura de Segurança

```
USUÁRIO → Frontend (HTTPS) → Backend → Blockchain Avalanche
                                ↓
                         PostgreSQL (usuários)
                         
Criptografia:
1. Senha → bcrypt (hash no banco)
2. 2FA   → TOTP com Google Authenticator
3. Seed  → AES-256-CBC (chave derivada com PBKDF2 do hash da senha + email)
4. Dados → armazenados na blockchain com prefixo por usuário
```

## Variáveis de Ambiente — Resumo

| Variável             | Onde usar      | Descrição                              |
|----------------------|----------------|----------------------------------------|
| `DATABASE_URL`       | Backend        | PostgreSQL connection string           |
| `JWT_SECRET`         | Backend        | String aleatória (64+ chars)           |
| `MASTER_PRIVATE_KEY` | Backend        | Chave privada da carteira que paga gás |
| `CONTRACT_ADDRESS`   | Backend        | `0x3Eb2b227d0f7aC2bFf07d3A617b2d9A04e2d91EeE` |
| `RPC_URL`            | Backend        | `https://api.avax-test.network/ext/bc/C/rpc` |
| `FRONTEND_URL`       | Backend        | URL do frontend (CORS)                 |
| `REACT_APP_API_URL`  | Frontend       | URL do backend                         |

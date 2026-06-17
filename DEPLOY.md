# Deploy do CryptoVault na nuvem (Render)

Publica o **backend + banco** com HTTPS. O servidor continua **cego** (só guarda
blobs cifrados). Depois disso, eu recompilo o app apontando para a URL pública.

---

## Parte 1 — Subir o código para o GitHub (privado)

> O Render publica a partir de um repositório Git. Use um repositório **privado**
> (é um app de segurança). Os segredos NÃO vão no repositório (estão no `.gitignore`).

1. Crie uma conta/repo em **https://github.com/new**
   - Nome: `cryptovault`  ·  Visibilidade: **Private**  ·  **não** marque "Add README".
2. No seu PC, conecte e envie (troque `SEU-USUARIO`):
   ```bash
   cd "C:/Users/user/Desktop/CryptoVault"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/cryptovault.git
   git push -u origin main
   ```
   - Na primeira vez, abre o navegador pra você logar no GitHub. (Eu posso rodar
     esses comandos por você assim que você me passar a URL do repositório.)

---

## Parte 2 — Deploy no Render

1. Crie conta em **https://render.com** (pode entrar com o GitHub).
2. **New +** → **Blueprint**.
3. Conecte sua conta do GitHub e selecione o repositório **cryptovault**.
4. O Render lê o `render.yaml` e mostra: 1 banco + 1 web service. Ele vai pedir
   **3 segredos** (marcados `sync: false`). Cole os valores que eu te enviei no chat:
   - `JWT_SECRET`
   - `TOTP_ENC_KEY`  ← **guarde este com cuidado**: perdê-lo tranca o 2FA de todos
   - `PARAMS_PEPPER`
5. **Apply / Create** → aguarde o build (~3-5 min). O banco e as tabelas são criados
   sozinhos no primeiro boot (`initDB`).
6. Quando ficar **Live**, copie a URL pública do serviço, algo como:
   `https://cryptovault-api.onrender.com`
7. Teste no navegador: `https://cryptovault-api.onrender.com/health` deve responder
   `{"status":"ok",...}`.

**Me mande essa URL** que eu recompilo o app (Android) apontando pra ela — aí
funciona em qualquer lugar, sem firewall e sem IP da sua casa.

---

## ⚠️ Sobre o tier grátis (importante)

- **Web grátis dorme** após ~15 min sem uso → a 1ª chamada depois disso demora ~30-50s
  (cold start). Normal no plano free.
- **Banco grátis do Render expira** (os dados são apagados depois de um tempo). Para
  uso de verdade — mesmo privado — **suba o banco para um plano pago** (~US$ 7/mês,
  `basic-256mb`) trocando `plan: free` por `plan: basic-256mb` no `render.yaml`. Senão
  você perde as contas/seeds quando o free expirar.

## Trocar segredos depois (NÃO faça com usuários ativos)
Mudar `TOTP_ENC_KEY` invalida o 2FA de todos; mudar `JWT_SECRET` desloga todos.
Defina uma vez e guarde em local seguro.

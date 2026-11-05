<p align="center">
  <img src="frontend/public/logo.png" alt="SpaceOne" width="110" />
</p>

<h1 align="center">SpaceOne</h1>

<p align="center">
  <strong>Suas seeds. Seu aparelho. Mais ninguém.</strong><br/>
  Cofre local de seed phrases com criptografia de ponta a ponta — sem conta, sem servidor, sem rastreamento.
</p>

<p align="center">
  <code>AES-256-GCM</code> · <code>Argon2id</code> · <code>BIP39</code> · <code>100% offline</code> · <code>open source</code>
</p>

---

## O que é

O SpaceOne guarda as seed phrases das suas carteiras cripto **somente no seu dispositivo**. Não existe servidor, conta, nuvem ou telemetria: as palavras são cifradas no próprio navegador e nunca saem dele.

- 🔑 **Senha soberana** — no primeiro uso você cria a senha do cofre. Ela nunca é armazenada: dela deriva-se a chave de criptografia (Argon2id + HKDF). Senha errada não recebe "acesso negado" — ela simplesmente não decifra nada.
- 🔒 **AES-256-GCM** — cada seed é cifrada com o mesmo padrão usado por bancos, com chave de 256 bits e verificação de integridade.
- 🎲 **Gerador BIP39** — crie seeds de 12 palavras no padrão das carteiras (Phantom, MetaMask, Ledger…) ou guarde frases próprias.
- 👁 **Senha para revelar** — ver uma seed exige digitar a senha de novo, mesmo com o cofre aberto.
- 💾 **Backup cifrado** — exporte um arquivo que só abre com a sua senha e leve o cofre para qualquer computador.
- 📴 **Offline por padrão** — funciona sem internet (PWA instalável).

## Como rodar

Pré-requisito: [Node.js 18+](https://nodejs.org)

```bash
cd frontend
npm install
npm start
```

Abra **http://localhost:3000**. No Windows, você também pode usar `.\start.ps1` na raiz do projeto.

Build de produção (arquivos estáticos, servíveis em qualquer hospedagem ou abertos direto do disco):

```bash
cd frontend
npm run build
```

Guia completo em [INSTRUCOES.md](INSTRUCOES.md).

## Como funciona a segurança

```
senha ──Argon2id──▶ chave mestra ──HKDF──▶ KEK ──embrulha──▶ DEK
                                                              │
seeds ◀──────────────── AES-256-GCM ◀─────────────────────────┘
```

1. Sua senha passa pelo **Argon2id** (função memory-hard, parâmetros OWASP) e vira uma chave — processo de mão única, a chave não revela a senha.
2. Essa chave embrulha a **DEK**, a chave aleatória que cifra as seeds com **AES-256-GCM**.
3. No disco ficam apenas o salt, a DEK embrulhada e os blobs cifrados. **A senha e as seeds nunca são gravadas em texto puro.**
4. Senha errada gera uma chave diferente — e a autenticação do GCM falha. É matemática, não cadeado.

### O que o SpaceOne *não* consegue fazer, por design

- Não consegue ver suas seeds
- Não consegue recuperar sua senha (não há "esqueci minha senha" — anote-a bem)
- Não consegue rastrear o que você guarda

> ⚠️ **Avisos importantes:** se você esquecer a senha, não há recuperação. Limpar os dados do navegador apaga o cofre — mantenha um backup exportado. E qualquer pessoa com a sua senha e acesso ao seu aparelho abre o cofre: use o bloqueio de tela do sistema.

## Estrutura do projeto

```
frontend/            o app (React)
  src/App.js         interface e fluxos do cofre
  src/crypto.js      criptografia (Argon2id, HKDF, AES-256-GCM)
  public/            PWA, ícones e logo
start.ps1            inicia o app no Windows
INSTRUCOES.md        guia de uso e build
```

## Verifique você mesmo

Não pedimos a sua confiança — pedimos a sua auditoria. Toda a criptografia está em [`frontend/src/crypto.js`](frontend/src/crypto.js) (~100 linhas), construída sobre as bibliotecas auditadas [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) e [`@scure/bip39`](https://github.com/paulmillr/scure-bip39) e a Web Crypto API do navegador.

## Licença

[MIT](LICENSE) — livre para usar, estudar, modificar e distribuir.

---

<p align="center"><sub><code>trust the math, not the middleman</code></sub></p>

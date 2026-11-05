# SpaceOne — Como rodar

O SpaceOne é um cofre de seed phrases **100% local**: sem conta, sem
servidor e sem banco de dados. No primeiro uso você cria uma **senha do
cofre** (estilo Phantom); depois, o app só abre com ela. As seeds são
cifradas com AES-256-GCM e ficam guardadas apenas no dispositivo.

## Pré-requisito

- Node.js 18+ (https://nodejs.org)

## Rodar (Windows)

```powershell
cd frontend
npm install     # só na primeira vez
```

Depois, na raiz do projeto, clique com o botão direito em `start.ps1` →
"Executar com PowerShell" (ou rode `.\start.ps1`). Em ~30 segundos o app
estará em **http://localhost:3000**.

## Rodar (Mac/Linux)

```bash
cd frontend
npm install     # só na primeira vez
npm start
```

## Build de produção (opcional)

```bash
cd frontend
npm run build
```

Gera a pasta `frontend/build/` — arquivos estáticos que podem ser servidos
por qualquer servidor web (ou hospedados no Netlify/Vercel/GitHub Pages).
Como o app é todo local, não há variáveis de ambiente para configurar.

## Usar em outro computador

O cofre vive só no aparelho onde foi criado — não existe conta nem
servidor. Para levá-lo a outro computador:

1. No computador atual: botão **Backup** (cabeçalho) → **Exportar backup**
2. Leve o arquivo ao outro computador (pendrive, e-mail, nuvem…)
3. No outro computador: abra o SpaceOne, crie uma senha de cofre e use
   **Backup → Importar backup**
4. Digite a senha que o cofre tinha quando o backup foi exportado

## Backup

No botão **Backup** do cabeçalho:

- **Exportar backup** — baixa um arquivo `spaceone-backup-AAAA-MM-DD.json`
  com suas seeds cifradas. O backup **só abre com a senha** que o cofre
  tinha no momento da exportação.
- **Importar backup** — restaura as seeds em outro aparelho ou após limpar
  o navegador (pede a senha do backup).

Há também o botão de **trocar a senha** (engrenagem) e o de **bloquear o
cofre** no cabeçalho.

## Segurança — leia isto

- A senha **não é salva em lugar nenhum**: dela deriva-se uma chave
  (Argon2id + HKDF) que cifra a chave do cofre. Senha errada simplesmente
  não decifra nada (autenticação do AES-256-GCM).
- Se você **esquecer a senha, não há recuperação** — nem nós nem ninguém
  consegue abrir o cofre. Anote-a em local seguro.
- Limpar os dados do navegador **apaga o cofre**. Exporte um backup antes.
- Quem já usava a versão sem senha: ao criar a senha, as seeds existentes
  são migradas automaticamente e a chave antiga desprotegida é apagada.

## Estrutura do projeto

- `frontend/` — o app (React). É tudo que o SpaceOne precisa.
- `start.ps1` / `stop.ps1` — atalhos para rodar no Windows.
- `README.md` — visão geral e arquitetura de segurança.

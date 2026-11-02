# SpaceOne — Como rodar

O SpaceOne é um cofre de seed phrases **100% local**: sem conta, sem login,
sem senha, sem servidor e sem banco de dados. As seeds são cifradas com
AES-256-GCM e ficam guardadas apenas no dispositivo onde você usa o app.

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

## Backup

No cabeçalho do app há dois botões:

- **Exportar backup** — baixa um arquivo `spaceone-backup-AAAA-MM-DD.json`
  com suas seeds cifradas e a chave do cofre. Guarde-o em local seguro:
  quem tiver esse arquivo consegue abrir as seeds.
- **Importar backup** — restaura as seeds de um backup em outro aparelho
  ou após limpar o navegador.

## Segurança — leia isto

- As seeds ficam cifradas (AES-256-GCM) no armazenamento do navegador
  **deste aparelho**. Nada é enviado para servidor algum.
- A chave de criptografia também fica no aparelho, portanto **qualquer
  pessoa com acesso ao seu computador/navegador consegue abrir o app e ver
  as seeds**. Use o bloqueio de tela do sistema operacional.
- Limpar os dados do navegador **apaga o cofre**. Exporte um backup antes.

## Estrutura do projeto

- `frontend/` — o app (React). É tudo que o SpaceOne precisa.
- `backend/` — API da versão antiga (com contas e nuvem). Não é mais
  usada nem necessária; mantida apenas como referência.

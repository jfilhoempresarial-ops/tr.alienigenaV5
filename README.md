# TRA da Estrada

Guia de bolso do caminhoneiro: encontre mecânico, borracharia, elétrica e pontos de apoio perto de você.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com as chaves do Firebase
npm run dev
```

## Regra de ouro da arquitetura

**Cada arquivo tem uma responsabilidade só.**

- `pages/*` → orquestra a tela: chama um `service`, passa o resultado pra um `component`. Nunca fala com Firebase direto.
- `components/*` → só recebe dados e devolve HTML. Nunca busca dado sozinho.
- `services/*` → única camada que fala com Firebase/APIs externas. Se um dia trocar de banco, só mexe aqui.
- `utils/*` → funções puras (sem efeito colateral), fáceis de reaproveitar e testar.

Se um arquivo em `pages/` começar a passar de ~150 linhas, é sinal de que uma parte dele devia virar `component` ou `service` novo.

## Deploy na Vercel

1. Suba este repo pro GitHub.
2. Import na Vercel (framework preset: Vite).
3. Em **Settings > Environment Variables**, adicione as mesmas chaves do `.env`.
4. Build command: `npm run build` / Output: `dist`.

## Próximos passos sugeridos

- [ ] Adicionar ícones reais em `public/icons/` (192x192 e 512x512)
- [ ] Painel admin (`pages/admin.js`) para aprovar empresas pendentes
- [ ] Página de perfil da empresa (`pages/empresa-perfil.js`)
- [ ] Sistema de avaliações
- [ ] Service worker para funcionar offline (PWA completo)

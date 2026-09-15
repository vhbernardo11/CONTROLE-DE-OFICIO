# IntegraRadar Mobile

Painel mobile-first da IntegraInvestimentos para análise disciplinada do mini índice WIN.

## Princípios
- Não envia ordens para corretora.
- Não promete lucro.
- Não apresenta DEMO, atraso ou inferência como dado real.
- Risco padrão: 2 WIN, R$40 por operação e R$80 por dia.
- O motor classifica contexto e oportunidade; a decisão e execução continuam humanas.

## Stack
- Next.js + TypeScript
- Vercel (hospedagem)
- Supabase (Postgres)
- GitHub (código/versionamento)
- Fontes externas futuras para market data e contexto

## Primeiro uso
O app funciona em modo DEMO e MANUAL sem banco. Quando Supabase/Vercel forem conectados, habilita ingestão e histórico de sinais.

## Variáveis de ambiente
Copie `.env.example` e configure as chaves somente no provedor de hospedagem. Nunca commite secrets.

## Banco
Execute `supabase/schema.sql` no projeto Supabase dedicado ao IntegraRadar.

## Endpoint futuro
`POST /api/ingest` com header `x-integraradar-secret`. O corpo deve ser um snapshot de mercado em JSON. O endpoint calcula o radar, grava o estado e salva sinais relevantes.

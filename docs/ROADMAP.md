# IntegraRadar Mobile — Roadmap em 5 etapas

## Etapa 1 — Fundação e segurança ✅
Objetivo: deixar GitHub + Supabase consistentes antes de conectar feed de mercado.

Concluído:
- Supabase ativo e saudável em `sa-east-1`.
- Schema canônico do IntegraRadar sincronizado no GitHub.
- RLS ativo nas tabelas do radar, sem políticas públicas.
- Estruturas: market snapshots, candles, fluxo, contexto, eventos, sinais, trades, risco diário, saúde das fontes, chaves de ingestão e metadados.
- Restrições de integridade: scores 0–100, contratos positivos e limites de risco positivos.
- Índices de consulta para mercado, sinais, trades e saúde das fontes.
- View `integraradar_status` para diagnóstico interno.
- Edge Function `integraradar-health` para health check seguro.
- Contexto externo automático já gravando no banco.
- Regra de integridade: dado DEMO, atrasado ou inferido nunca é rotulado como tempo real.

Observação: o projeto Supabase reutilizado contém tabelas legadas de sistemas antigos. Elas foram preservadas e não fazem parte do schema do IntegraRadar.

## Etapa 2 — Feed WIN/B3 mobile-only
Encontrar e integrar a melhor fonte viável de preço/candles WIN sem computador. Classificar cada fonte como REAL, ATRASADO, MANUAL ou INDISPONÍVEL. Preparar adaptadores para troca de fornecedor sem reescrever o motor.

## Etapa 3 — Motor de decisão e contexto
Fechar CompraScore/VendaScore, regimes TREND/RANGE/EVENTO, Trend Pullback, ORB 15m, falha de rompimento, vetos de notícia e risco. Integrar contexto Brasil/global e calendário econômico.

## Etapa 4 — Aplicativo mobile e publicação
Finalizar PWA/mobile, dashboard, sinais, diário, integrações e publicar em domínio Vercel acessível pelo celular. Configurar variáveis de ambiente e proteção adequada sem plano pago.

## Etapa 5 — Validação e operação assistida
Rodar testes históricos e em tempo real sem execução automática. Medir taxa de acerto, payoff, expectativa, MFE/MAE e comportamento por regime. Só depois liberar uso operacional como copiloto, mantendo a execução das ordens exclusivamente humana na Toro.

# Etapa 2 — Feed WIN/B3 mobile-only

## Resultado

A arquitetura de feed foi construída com separação rígida entre REALTIME, DELAYED_15M e EOD. Nenhuma fonte atrasada ou EOD pode criar sinais ao vivo.

## Fonte já funcionando

- `BRAPI_EOD`: WIN/WDO de fim de dia, sem token para esses ativos. Uso: referência, ajuste, fechamento e histórico. Nunca para decisão intraday ao vivo.
- Coleta automática: `integraradar-brapi-eod`, após o processamento noturno.
- Tabela: `futures_reference`.

## Fontes avaliadas

### BTG Solutions Data Services
Candidato principal para o feed REALTIME por possuir documentação de B3, derivativos, trades, books, candles e WebSocket/REST. Exige API key/contratação; não foi ativado sem autorização de custo.

### Cedro Market Data
Candidato de teste: REST/WebSocket/Socket para B3/BMF, com teste gratuito anunciado de 7 dias. Exige cadastro/credenciais e o preço sustentável não está público.

### B3 UMDF
Feed oficial e adequado para algoritmos, mas acesso direto é comercial/B2B e não combina com o cenário atual de pessoa física + celular.

### TradingView
B3 delayed 15 min é gratuito e B3 real-time pode ser comprado como assinatura de dados. Porém a política atual do TradingView restringe uso não-display/machine processing de market data, incluindo processamento algorítmico e risk management. Portanto não usamos o market data do TradingView como entrada automática do IntegraScore. TradingView pode continuar como tela/alerta humano.

### Toro Trader Mobile
Continua sendo a tela de execução. Não foi encontrada API pública documentada para extrair o feed do aplicativo mobile para nosso backend.

## Proteção de integridade

A tabela `market_data_sources` registra a natureza e elegibilidade de cada fonte. Um trigger do banco impede que `signals` receba sinais de fontes que não estejam ativas, classificadas REALTIME e explicitamente aprovadas para live scoring.

## Estado atual

- Referência EOD de WIN/WDO: funcionando.
- Feed REALTIME automático para o IntegraScore: ainda não ativado porque os candidatos legítimos exigem credencial comercial/API key.
- O sistema não mascara essa ausência: `integraradar-feed-status` reporta `liveFeedReady=false` até que uma fonte REALTIME válida seja conectada.

## Próxima ativação possível

1. Prioridade: BTG Solutions Data Services, se houver acesso individual/freemium ou custo aceitável.
2. Alternativa para prova de conceito: trial Cedro de 7 dias.
3. Nunca contratar/plugar fonte paga sem autorização explícita.

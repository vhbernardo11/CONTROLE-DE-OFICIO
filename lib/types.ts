export type Regime = 'TREND' | 'RANGE' | 'EVENTO/ANORMAL' | 'INDEFINIDO'
export type Status = 'SETUP A' | 'AGUARDAR' | 'OBSERVAÇÃO' | 'SEM OPERAÇÃO' | 'VETO POR NOTÍCIA'
export type Flow = 'COMPRADOR' | 'VENDEDOR' | 'NEUTRO' | 'INDISPONÍVEL'
export type SourceQuality = 'REAL' | 'ATRASADO' | 'EOD' | 'CÁLCULO NOSSO' | 'MANUAL' | 'DEMO' | 'INDISPONÍVEL'
export type SetupSide = 'COMPRA' | 'VENDA' | 'NEUTRO'
export type Absorption = 'COMPRADORA' | 'VENDEDORA' | 'NEUTRA'

export interface MarketSnapshot {
  id?: string
  timestamp: string
  source: string
  dataQuality?: SourceQuality
  sourceDelaySeconds?: number
  asset: string
  price?: number
  open?: number
  high?: number
  low?: number
  prevClose?: number
  settlement?: number
  vwap?: number
  ema9?: number
  sma21?: number
  sma50?: number
  sma200?: number
  hilo11?: number
  atr?: number
  volume?: number
  relativeVolume?: number
  prevHigh?: number
  prevLow?: number
  openingRangeHigh?: number
  openingRangeLow?: number
  minutesSinceOpen?: number
  aggressionDelta?: number
  cumulativeDelta?: number
  bidAskImbalance?: number
  tradeRate?: number
  absorption?: Absorption
  retestBuy?: boolean
  retestSell?: boolean
  wdoChange?: number
  ibovChange?: number
  petr4Change?: number
  vale3Change?: number
  sp500Change?: number
  nasdaqChange?: number
  vixChange?: number
  dxyChange?: number
  oilChange?: number
  us10yChangeBps?: number
  minutesToMacroEvent?: number
  minutesSinceMacroEvent?: number
  macroEventName?: string
  macroEventImpact?: 'low' | 'medium' | 'high'
  dailyPnl?: number
  consecutiveLosses?: number
  tradesCount?: number
  stopPoints?: number
  targetPoints?: number
  triggerBuy?: boolean
  triggerSell?: boolean
  notes?: string
}

export interface BlockScore {
  name: string
  buy: number
  sell: number
  max: number
  reasons: string[]
}

export interface RadarAnalysis {
  modelVersion: string
  timestamp: string
  regime: Regime
  buyScore: number
  sellScore: number
  confidence: number
  status: Status
  preferredSide: SetupSide
  setup: string
  setupSide: SetupSide
  setupConfirmed: boolean
  liveEligible: boolean
  trend: 'ALTA' | 'BAIXA' | 'NEUTRA'
  flow: Flow
  volumeState: 'FORTE' | 'NORMAL' | 'FRACO' | 'INDISPONÍVEL'
  vwapPosition: 'ACIMA' | 'ABAIXO' | 'PRÓXIMO' | 'INDISPONÍVEL'
  riskBRL?: number
  rewardBRL?: number
  riskReward?: number
  blocks: BlockScore[]
  vetoes: string[]
  executionBlocks: string[]
  missing: string[]
  audit: string[]
}

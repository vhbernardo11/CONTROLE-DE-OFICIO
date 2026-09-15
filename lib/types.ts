export type Regime = 'TREND' | 'RANGE' | 'EVENTO/ANORMAL' | 'INDEFINIDO'
export type Status = 'SETUP A' | 'AGUARDAR' | 'OBSERVAÇÃO' | 'SEM OPERAÇÃO' | 'VETO POR NOTÍCIA'
export type Flow = 'COMPRADOR' | 'VENDEDOR' | 'NEUTRO' | 'INDISPONÍVEL'
export type SourceQuality = 'REAL' | 'ATRASADO' | 'CÁLCULO NOSSO' | 'MANUAL' | 'DEMO' | 'INDISPONÍVEL'

export interface MarketSnapshot {
  id?: string
  timestamp: string
  source: SourceQuality
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
  aggressionDelta?: number
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
  macroEventName?: string
  dailyPnl?: number
  consecutiveLosses?: number
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
  timestamp: string
  regime: Regime
  buyScore: number
  sellScore: number
  confidence: number
  status: Status
  preferredSide: 'COMPRA' | 'VENDA' | 'NEUTRO'
  setup: string
  trend: 'ALTA' | 'BAIXA' | 'NEUTRA'
  flow: Flow
  volumeState: 'FORTE' | 'NORMAL' | 'FRACO' | 'INDISPONÍVEL'
  vwapPosition: 'ACIMA' | 'ABAIXO' | 'PRÓXIMO' | 'INDISPONÍVEL'
  riskBRL?: number
  rewardBRL?: number
  riskReward?: number
  blocks: BlockScore[]
  vetoes: string[]
  missing: string[]
  audit: string[]
}

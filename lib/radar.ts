import type { BlockScore, MarketSnapshot, RadarAnalysis, Regime, Status } from './types'

const CONTRACTS = 2
const POINT_VALUE = 0.2
const MAX_TRADE_RISK = 40
const MAX_DAILY_LOSS = 80

const defined = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const near = (a?: number, b?: number, tolerance = 0.0015) => defined(a) && defined(b) && Math.abs(a-b) / Math.max(Math.abs(b),1) <= tolerance
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

function detectRegime(s: MarketSnapshot): Regime {
  if (defined(s.minutesToMacroEvent) && s.minutesToMacroEvent <= 10) return 'EVENTO/ANORMAL'
  if (!defined(s.price) || !defined(s.vwap) || !defined(s.ema9) || !defined(s.sma21) || !defined(s.sma50)) return 'INDEFINIDO'
  const alignedUp = s.price > s.vwap && s.ema9 > s.sma21 && s.sma21 > s.sma50
  const alignedDown = s.price < s.vwap && s.ema9 < s.sma21 && s.sma21 < s.sma50
  const spread = Math.abs(s.ema9 - s.sma50) / Math.max(Math.abs(s.price),1)
  if ((alignedUp || alignedDown) && spread > 0.0008) return 'TREND'
  if (near(s.price, s.vwap, 0.0012) || spread < 0.0006) return 'RANGE'
  return 'INDEFINIDO'
}

function scoreMacro(s: MarketSnapshot): BlockScore {
  let buy=0, sell=0
  const reasons:string[]=[]
  const positives = [s.sp500Change, s.nasdaqChange].filter(defined)
  const negatives = [s.vixChange, s.dxyChange, s.us10yChangeBps].filter(defined)
  for (const v of positives) { if (v > 0) buy += 3; if (v < 0) sell += 3 }
  for (const v of negatives) { if (v < 0) buy += 2; if (v > 0) sell += 2 }
  if (defined(s.oilChange)) reasons.push(`Petróleo ${s.oilChange >= 0 ? '+' : ''}${s.oilChange.toFixed(2)}%`)
  reasons.push('Macro é filtro de contexto, não gatilho isolado')
  return {name:'Macro/global', buy:clamp(buy,0,15), sell:clamp(sell,0,15), max:15, reasons}
}

function scoreBrazil(s: MarketSnapshot): BlockScore {
  let buy=0, sell=0
  const reasons:string[]=[]
  for (const v of [s.ibovChange,s.petr4Change,s.vale3Change].filter(defined)) { if (v>0) buy += 3; if (v<0) sell += 3 }
  if (defined(s.wdoChange)) { if (s.wdoChange < 0) buy += 3; if (s.wdoChange > 0) sell += 3; reasons.push(`WDO ${s.wdoChange>=0?'+':''}${s.wdoChange.toFixed(2)}%`) }
  return {name:'Brasil/intermarket', buy:clamp(buy,0,15), sell:clamp(sell,0,15), max:15, reasons}
}

function scoreStructure(s: MarketSnapshot): BlockScore {
  let buy=0, sell=0
  const reasons:string[]=[]
  if (defined(s.price) && defined(s.vwap)) { if (s.price > s.vwap) buy+=5; else sell+=5 }
  if (defined(s.ema9) && defined(s.sma21)) { if (s.ema9 > s.sma21) buy+=4; else sell+=4 }
  if (defined(s.sma21) && defined(s.sma50)) { if (s.sma21 > s.sma50) buy+=4; else sell+=4 }
  if (defined(s.sma50) && defined(s.sma200)) { if (s.sma50 > s.sma200) buy+=4; else sell+=4 }
  if (defined(s.price) && defined(s.sma200)) { if (s.price > s.sma200) buy+=3; else sell+=3 }
  reasons.push('Alinhamento de VWAP e médias define estrutura, não ordem automática')
  return {name:'Estrutura WIN', buy:clamp(buy,0,20), sell:clamp(sell,0,20), max:20, reasons}
}

function scoreLocation(s: MarketSnapshot, regime: Regime): BlockScore {
  let buy=0, sell=0
  const reasons:string[]=[]
  if (!defined(s.price)) return {name:'Localização',buy:0,sell:0,max:15,reasons:['Preço indisponível']}
  const supports = [s.vwap,s.sma21,s.sma50,s.prevHigh,s.prevLow,s.openingRangeHigh,s.openingRangeLow].filter(defined)
  const nearest = supports.length ? Math.min(...supports.map(x=>Math.abs(s.price!-x!))) : undefined
  if (defined(nearest) && defined(s.atr) && s.atr>0 && nearest <= s.atr*0.35) { buy+=4; sell+=4; reasons.push('Preço próximo de região técnica') }
  if (regime==='TREND' && defined(s.vwap)) { if (s.price>s.vwap && near(s.price,s.sma21,0.0015)) buy+=6; if (s.price<s.vwap && near(s.price,s.sma21,0.0015)) sell+=6 }
  if (defined(s.openingRangeHigh) && s.price > s.openingRangeHigh) buy+=3
  if (defined(s.openingRangeLow) && s.price < s.openingRangeLow) sell+=3
  return {name:'Localização',buy:clamp(buy,0,15),sell:clamp(sell,0,15),max:15,reasons}
}

function scoreFlow(s: MarketSnapshot): BlockScore {
  let buy=0,sell=0
  const reasons:string[]=[]
  if (defined(s.aggressionDelta)) {
    if (s.aggressionDelta>0) buy+=12
    if (s.aggressionDelta<0) sell+=12
    reasons.push(`Delta informado: ${s.aggressionDelta.toFixed(0)}`)
  }
  if (defined(s.relativeVolume)) {
    if (s.relativeVolume>=1.3) { buy+=4; sell+=4; reasons.push('Volume relativo forte') }
    else if (s.relativeVolume<0.7) reasons.push('Volume relativo fraco')
  }
  if (!defined(s.aggressionDelta)) reasons.push('Fluxo/agressão indisponível: confiança reduzida')
  return {name:'Fluxo/volume',buy:clamp(buy,0,20),sell:clamp(sell,0,20),max:20,reasons}
}

function scoreTrigger(s: MarketSnapshot): BlockScore {
  return {name:'Gatilho',buy:s.triggerBuy?10:0,sell:s.triggerSell?10:0,max:10,reasons:[s.triggerBuy?'Gatilho comprador confirmado':s.triggerSell?'Gatilho vendedor confirmado':'Sem gatilho confirmado']}
}

function scoreRisk(s: MarketSnapshot): {block:BlockScore;riskBRL?:number;rewardBRL?:number;rr?:number;vetoes:string[]} {
  const vetoes:string[]=[]
  let buy=0,sell=0
  let riskBRL:number|undefined,rewardBRL:number|undefined,rr:number|undefined
  if (defined(s.stopPoints)) riskBRL = s.stopPoints * POINT_VALUE * CONTRACTS
  if (defined(s.targetPoints)) rewardBRL = s.targetPoints * POINT_VALUE * CONTRACTS
  if (defined(riskBRL) && defined(rewardBRL) && riskBRL>0) rr = rewardBRL/riskBRL
  if (defined(riskBRL) && riskBRL > MAX_TRADE_RISK) vetoes.push(`Stop técnico implica risco de R$${riskBRL.toFixed(2)}, acima do limite de R$${MAX_TRADE_RISK.toFixed(2)}`)
  if (defined(rr)) { if (rr>=2) {buy=5;sell=5} else if (rr>=1.5) {buy=4;sell=4} else vetoes.push(`R:R ${rr.toFixed(2)} abaixo de 1,5`)}
  if (defined(s.dailyPnl) && s.dailyPnl <= -MAX_DAILY_LOSS) vetoes.push('Limite diário de perda atingido')
  if ((s.consecutiveLosses ?? 0)>=2) vetoes.push('Duas perdas consecutivas: dia encerrado')
  return {block:{name:'Risco/retorno',buy,sell,max:5,reasons:[defined(rr)?`R:R ${rr.toFixed(2)}`:'R:R não informado']},riskBRL,rewardBRL,rr,vetoes}
}

function missingFields(s: MarketSnapshot): string[] {
  const required: [keyof MarketSnapshot,string][] = [
    ['price','Preço'],['vwap','VWAP'],['ema9','MME9'],['sma21','MMA21'],['sma50','MMA50'],['sma200','MMA200'],['relativeVolume','Volume relativo'],['stopPoints','Stop técnico'],['targetPoints','Alvo']
  ]
  return required.filter(([k])=>!defined(s[k])).map(([,label])=>label)
}

export function analyzeSnapshot(s: MarketSnapshot): RadarAnalysis {
  const regime=detectRegime(s)
  const macro=scoreMacro(s), br=scoreBrazil(s), structure=scoreStructure(s), location=scoreLocation(s,regime), flow=scoreFlow(s), trigger=scoreTrigger(s), risk=scoreRisk(s)
  const blocks=[macro,br,structure,location,flow,trigger,risk.block]
  const buyScore=Math.round(blocks.reduce((a,b)=>a+b.buy,0))
  const sellScore=Math.round(blocks.reduce((a,b)=>a+b.sell,0))
  const missing=missingFields(s)
  const confidence=clamp(Math.round(100-(missing.length*7)-(s.source==='DEMO'?20:0)-(s.source==='ATRASADO'?15:0)),10,100)
  const vetoes=[...risk.vetoes]
  if (defined(s.minutesToMacroEvent) && s.minutesToMacroEvent<=10) vetoes.push(`Evento macro em ${s.minutesToMacroEvent} min${s.macroEventName?`: ${s.macroEventName}`:''}`)
  const preferredSide = buyScore >= sellScore+8 ? 'COMPRA' : sellScore >= buyScore+8 ? 'VENDA' : 'NEUTRO'
  const top=Math.max(buyScore,sellScore)
  let status:Status = top>=85?'SETUP A':top>=75?'AGUARDAR':top>=65?'OBSERVAÇÃO':'SEM OPERAÇÃO'
  if (vetoes.some(v=>v.toLowerCase().includes('evento macro'))) status='VETO POR NOTÍCIA'
  else if (vetoes.length) status='SEM OPERAÇÃO'
  const trend = structure.buy>=structure.sell+4?'ALTA':structure.sell>=structure.buy+4?'BAIXA':'NEUTRA'
  const flowState = !defined(s.aggressionDelta)?'INDISPONÍVEL':s.aggressionDelta>0?'COMPRADOR':s.aggressionDelta<0?'VENDEDOR':'NEUTRO'
  const volumeState = !defined(s.relativeVolume)?'INDISPONÍVEL':s.relativeVolume>=1.3?'FORTE':s.relativeVolume<0.7?'FRACO':'NORMAL'
  const vwapPosition = !defined(s.price)||!defined(s.vwap)?'INDISPONÍVEL':near(s.price,s.vwap,0.0005)?'PRÓXIMO':s.price>s.vwap?'ACIMA':'ABAIXO'
  const setup = regime==='TREND'?'Trend Pullback':regime==='RANGE'?'Falha de Rompimento/Reversão':regime==='EVENTO/ANORMAL'?'Nenhum — evento':'Aguardando regime'
  const audit = blocks.flatMap(b=>b.reasons.map(r=>`${b.name}: ${r}`))
  return {timestamp:s.timestamp,regime,buyScore,sellScore,confidence,status,preferredSide,setup,trend,flow:flowState,volumeState,vwapPosition,riskBRL:risk.riskBRL,rewardBRL:risk.rewardBRL,riskReward:risk.rr,blocks,vetoes,missing,audit}
}

export const riskDefaults={contracts:CONTRACTS,pointValue:POINT_VALUE,maxTradeRisk:MAX_TRADE_RISK,maxDailyLoss:MAX_DAILY_LOSS}

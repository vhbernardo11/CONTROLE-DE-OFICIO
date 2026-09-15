import type { BlockScore, MarketSnapshot, RadarAnalysis, Regime, SetupSide, Status } from './types'

export const MODEL_VERSION = 'v3.0.0'
const CONTRACTS = 2
const POINT_VALUE = 0.2
const MAX_TRADE_RISK = 40
const MAX_DAILY_LOSS = 80
const MAX_TRADES_DAY = 3

const defined = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const nearPct = (a?: number, b?: number, tolerance = 0.0015) => defined(a) && defined(b) && Math.abs(a-b) / Math.max(Math.abs(b),1) <= tolerance
const nearAtr = (a?: number, b?: number, atr?: number, multiple = 0.35) => defined(a) && defined(b) && defined(atr) && atr > 0 ? Math.abs(a-b) <= atr*multiple : nearPct(a,b)

function newsWindowActive(s: MarketSnapshot): boolean {
  const highImpact = !s.macroEventImpact || s.macroEventImpact === 'high'
  if (!highImpact) return false
  if (defined(s.minutesToMacroEvent) && s.minutesToMacroEvent >= 0 && s.minutesToMacroEvent <= 5) return true
  if (defined(s.minutesSinceMacroEvent) && s.minutesSinceMacroEvent >= 0 && s.minutesSinceMacroEvent <= 10) return true
  return false
}

function inferTrend(s: MarketSnapshot): 'ALTA'|'BAIXA'|'NEUTRA' {
  let bull=0,bear=0
  const compare=(a?:number,b?:number)=>{if(!defined(a)||!defined(b))return;if(a>b)bull++;else if(a<b)bear++}
  compare(s.price,s.vwap); compare(s.ema9,s.sma21); compare(s.sma21,s.sma50); compare(s.sma50,s.sma200); compare(s.price,s.sma200)
  return bull>=4?'ALTA':bear>=4?'BAIXA':'NEUTRA'
}

function detectRegime(s: MarketSnapshot, trend: 'ALTA'|'BAIXA'|'NEUTRA'): Regime {
  if (newsWindowActive(s)) return 'EVENTO/ANORMAL'
  if (!defined(s.price) || !defined(s.vwap) || !defined(s.ema9) || !defined(s.sma21) || !defined(s.sma50)) return 'INDEFINIDO'
  const spread = Math.abs(s.ema9-s.sma50)/Math.max(Math.abs(s.price),1)
  if (trend!=='NEUTRA' && spread>=0.0007) return 'TREND'
  const compression = Math.abs(s.sma21-s.sma50)/Math.max(Math.abs(s.price),1)
  if (nearPct(s.price,s.vwap,0.0012) || compression<=0.0007) return 'RANGE'
  return 'INDEFINIDO'
}

function scoreMacro(s: MarketSnapshot): BlockScore {
  let buy=0,sell=0; const reasons:string[]=[]
  const addRisk=(v:number|undefined, bullWhenPositive=true, strong=0.15, pts=3)=>{
    if(!defined(v))return
    if(Math.abs(v)<strong)return
    const bullish=bullWhenPositive?v>0:v<0
    if(bullish)buy+=pts; else sell+=pts
  }
  addRisk(s.sp500Change,true,0.15,4)
  addRisk(s.nasdaqChange,true,0.15,4)
  addRisk(s.vixChange,false,1,2)
  addRisk(s.dxyChange,false,0.15,2)
  if(defined(s.us10yChangeBps) && Math.abs(s.us10yChangeBps)>=2){ if(s.us10yChangeBps<0)buy+=2; else sell+=2 }
  if(defined(s.oilChange)) reasons.push(`Petróleo ${s.oilChange>=0?'+':''}${s.oilChange.toFixed(2)}% é contexto, não gatilho isolado`)
  reasons.push('Macro/global só reforça ou contradiz o contexto do WIN')
  return {name:'Macro/global',buy:clamp(buy,0,15),sell:clamp(sell,0,15),max:15,reasons}
}

function scoreBrazil(s: MarketSnapshot): BlockScore {
  let buy=0,sell=0; const reasons:string[]=[]
  const add=(v:number|undefined,threshold:number,pts:number,bullPositive=true)=>{
    if(!defined(v)||Math.abs(v)<threshold)return
    const bullish=bullPositive?v>0:v<0
    if(bullish)buy+=pts;else sell+=pts
  }
  add(s.ibovChange,0.2,4,true); add(s.petr4Change,0.3,3,true); add(s.vale3Change,0.3,3,true); add(s.wdoChange,0.2,5,false)
  if(defined(s.wdoChange)) reasons.push(`WDO ${s.wdoChange>=0?'+':''}${s.wdoChange.toFixed(2)}%`)
  reasons.push('Brasil/intermarket nunca substitui a estrutura do próprio WIN')
  return {name:'Brasil/intermarket',buy:clamp(buy,0,15),sell:clamp(sell,0,15),max:15,reasons}
}

function scoreStructure(s: MarketSnapshot): BlockScore {
  let buy=0,sell=0; const reasons:string[]=[]
  const cmp=(a:number|undefined,b:number|undefined,pts:number,label:string)=>{
    if(!defined(a)||!defined(b))return
    if(a>b){buy+=pts;reasons.push(`${label}: comprador`)} else if(a<b){sell+=pts;reasons.push(`${label}: vendedor`)}
  }
  cmp(s.price,s.vwap,4,'Preço x VWAP')
  cmp(s.ema9,s.sma21,4,'MME9 x MMA21')
  cmp(s.sma21,s.sma50,4,'MMA21 x MMA50')
  cmp(s.sma50,s.sma200,4,'MMA50 x MMA200')
  cmp(s.price,s.sma200,4,'Preço x MMA200')
  return {name:'Estrutura WIN',buy:clamp(buy,0,20),sell:clamp(sell,0,20),max:20,reasons}
}

type SetupDetection={name:string;side:SetupSide;confirmed:boolean;reasons:string[]}
function detectSetup(s:MarketSnapshot,regime:Regime,trend:'ALTA'|'BAIXA'|'NEUTRA'):SetupDetection{
  const reasons:string[]=[]
  if(regime==='EVENTO/ANORMAL') return {name:'Nenhum — evento',side:'NEUTRO',confirmed:false,reasons:['Janela de notícia de alto impacto']}
  const price=s.price,atr=s.atr
  if(!defined(price)) return {name:'Aguardando dados',side:'NEUTRO',confirmed:false,reasons:['Preço indisponível']}
  const buffer=defined(atr)&&atr>0?Math.max(5,atr*0.10):20
  const failedHigh = ([s.openingRangeHigh,s.prevHigh] as Array<number|undefined>).some(level=>defined(level)&&defined(s.high)&&s.high>level+buffer&&price<level)
  const failedLow = ([s.openingRangeLow,s.prevLow] as Array<number|undefined>).some(level=>defined(level)&&defined(s.low)&&s.low<level-buffer&&price>level)
  if(regime==='RANGE' && failedHigh){
    reasons.push('Rompimento superior falhou e preço voltou para dentro da região')
    return {name:'Falha de Rompimento',side:'VENDA',confirmed:!!s.triggerSell,reasons}
  }
  if(regime==='RANGE' && failedLow){
    reasons.push('Rompimento inferior falhou e preço voltou para dentro da região')
    return {name:'Falha de Rompimento',side:'COMPRA',confirmed:!!s.triggerBuy,reasons}
  }
  const orReady=defined(s.minutesSinceOpen)&&s.minutesSinceOpen>=15&&defined(s.openingRangeHigh)&&defined(s.openingRangeLow)
  if(orReady && defined(s.openingRangeHigh) && price>s.openingRangeHigh+buffer*0.5){
    const confirmed=!!s.retestBuy&&!!s.triggerBuy
    reasons.push(confirmed?'Rompimento da OR15 com reteste e gatilho comprador':'Rompimento da OR15 sem reteste/gatilho completo')
    return {name:confirmed?'ORB com Reteste':'ORB aguardando reteste',side:'COMPRA',confirmed,reasons}
  }
  if(orReady && defined(s.openingRangeLow) && price<s.openingRangeLow-buffer*0.5){
    const confirmed=!!s.retestSell&&!!s.triggerSell
    reasons.push(confirmed?'Rompimento da OR15 com reteste e gatilho vendedor':'Rompimento da OR15 sem reteste/gatilho completo')
    return {name:confirmed?'ORB com Reteste':'ORB aguardando reteste',side:'VENDA',confirmed,reasons}
  }
  if(regime==='TREND'&&trend==='ALTA'&&defined(s.vwap)&&price>s.vwap){
    const pullback=nearAtr(price,s.ema9,atr,.35)||nearAtr(price,s.sma21,atr,.35)||nearAtr(price,s.vwap,atr,.35)
    if(pullback){reasons.push('Tendência de alta com correção para MME9/MMA21/VWAP');return {name:'Trend Pullback',side:'COMPRA',confirmed:!!s.triggerBuy,reasons}}
  }
  if(regime==='TREND'&&trend==='BAIXA'&&defined(s.vwap)&&price<s.vwap){
    const pullback=nearAtr(price,s.ema9,atr,.35)||nearAtr(price,s.sma21,atr,.35)||nearAtr(price,s.vwap,atr,.35)
    if(pullback){reasons.push('Tendência de baixa com correção para MME9/MMA21/VWAP');return {name:'Trend Pullback',side:'VENDA',confirmed:!!s.triggerSell,reasons}}
  }
  return {name:regime==='RANGE'?'Range sem falha confirmada':'Aguardando setup',side:'NEUTRO',confirmed:false,reasons:['Nenhum dos três setups está completo']}
}

function scoreLocation(s:MarketSnapshot,setup:SetupDetection):BlockScore{
  let buy=0,sell=0; const reasons=[...setup.reasons]
  const base=setup.side==='NEUTRO'?0:setup.confirmed?12:8
  if(setup.side==='COMPRA')buy+=base
  if(setup.side==='VENDA')sell+=base
  if(setup.side==='COMPRA'&&defined(s.price)&&defined(s.vwap)&&s.price>s.vwap&&!nearAtr(s.price,s.vwap,s.atr,1.25)) buy+=2
  if(setup.side==='VENDA'&&defined(s.price)&&defined(s.vwap)&&s.price<s.vwap&&!nearAtr(s.price,s.vwap,s.atr,1.25)) sell+=2
  return {name:'Localização',buy:clamp(buy,0,15),sell:clamp(sell,0,15),max:15,reasons}
}

function scoreFlow(s:MarketSnapshot):BlockScore{
  let buy=0,sell=0; const reasons:string[]=[]
  if(defined(s.aggressionDelta)){if(s.aggressionDelta>0)buy+=7;else if(s.aggressionDelta<0)sell+=7;reasons.push(`Delta agressão ${s.aggressionDelta.toFixed(0)}`)}
  if(defined(s.cumulativeDelta)){if(s.cumulativeDelta>0)buy+=4;else if(s.cumulativeDelta<0)sell+=4;reasons.push(`Delta acumulado ${s.cumulativeDelta.toFixed(0)}`)}
  if(defined(s.bidAskImbalance)&&Math.abs(s.bidAskImbalance)>=0.15){if(s.bidAskImbalance>0)buy+=5;else sell+=5;reasons.push(`Imbalance ${(s.bidAskImbalance*100).toFixed(0)}%`)}
  if(s.absorption==='COMPRADORA'){buy+=4;reasons.push('Absorção compradora')}else if(s.absorption==='VENDEDORA'){sell+=4;reasons.push('Absorção vendedora')}
  if(defined(s.relativeVolume)){
    if(s.relativeVolume>=1.3){if(buy>sell)buy+=4;else if(sell>buy)sell+=4;reasons.push('Volume relativo forte confirma apenas o lado dominante')}
    else if(s.relativeVolume<0.7)reasons.push('Volume relativo fraco: não confirma fluxo')
  }
  if(!defined(s.aggressionDelta)&&!defined(s.cumulativeDelta)&&!defined(s.bidAskImbalance)&&!s.absorption)reasons.push('Fluxo indisponível')
  return {name:'Fluxo/volume',buy:clamp(buy,0,20),sell:clamp(sell,0,20),max:20,reasons}
}

function scoreTrigger(s:MarketSnapshot):BlockScore{
  let buy=0,sell=0; const reasons:string[]=[]
  if(s.triggerBuy){buy+=6;reasons.push('Gatilho comprador confirmado')}
  if(s.triggerSell){sell+=6;reasons.push('Gatilho vendedor confirmado')}
  if(defined(s.price)&&defined(s.hilo11)){if(s.price>s.hilo11)buy+=2;else if(s.price<s.hilo11)sell+=2}
  if(s.retestBuy)buy+=2
  if(s.retestSell)sell+=2
  if(!s.triggerBuy&&!s.triggerSell)reasons.push('Sem gatilho de preço confirmado')
  return {name:'Gatilho',buy:clamp(buy,0,10),sell:clamp(sell,0,10),max:10,reasons}
}

function scoreRisk(s:MarketSnapshot){
  const vetoes:string[]=[]; const executionBlocks:string[]=[]; let buy=0,sell=0
  let riskBRL:number|undefined,rewardBRL:number|undefined,rr:number|undefined
  if(defined(s.stopPoints)&&s.stopPoints>0)riskBRL=s.stopPoints*POINT_VALUE*CONTRACTS
  if(defined(s.targetPoints)&&s.targetPoints>0)rewardBRL=s.targetPoints*POINT_VALUE*CONTRACTS
  if(defined(riskBRL)&&defined(rewardBRL)&&riskBRL>0)rr=rewardBRL/riskBRL
  if(defined(riskBRL)&&riskBRL>MAX_TRADE_RISK)vetoes.push(`Stop técnico implica R$${riskBRL.toFixed(2)}, acima do limite de R$${MAX_TRADE_RISK.toFixed(2)}`)
  if(defined(rr)){if(rr>=2){buy=5;sell=5}else if(rr>=1.5){buy=4;sell=4}else vetoes.push(`R:R ${rr.toFixed(2)} abaixo de 1,5`)}else executionBlocks.push('R:R não calculável')
  if(defined(s.dailyPnl)&&s.dailyPnl<=-MAX_DAILY_LOSS)vetoes.push('Limite diário de perda atingido')
  if((s.consecutiveLosses??0)>=2)vetoes.push('Duas perdas consecutivas: dia encerrado')
  if((s.tradesCount??0)>=MAX_TRADES_DAY)vetoes.push('Limite de 3 operações no dia atingido')
  return {block:{name:'Risco/retorno',buy,sell,max:5,reasons:[defined(rr)?`R:R ${rr.toFixed(2)}`:'R:R não informado']},riskBRL,rewardBRL,rr,vetoes,executionBlocks}
}

function missingFields(s:MarketSnapshot):string[]{
  const required:[keyof MarketSnapshot,string][]=[['price','Preço'],['vwap','VWAP'],['ema9','MME9'],['sma21','MMA21'],['sma50','MMA50'],['sma200','MMA200'],['relativeVolume','Volume relativo'],['stopPoints','Stop técnico'],['targetPoints','Alvo']]
  return required.filter(([k])=>!defined(s[k])).map(([,label])=>label)
}

function sourceGate(s:MarketSnapshot,missing:string[]):{liveEligible:boolean;blocks:string[];confidencePenalty:number}{
  const blocks:string[]=[]; let penalty=0
  const age=Math.max(0,(Date.now()-new Date(s.timestamp).getTime())/1000)
  if(s.source!=='REAL'){blocks.push(`Fonte ${s.source} não é elegível para sinal ao vivo`);penalty+=s.source==='MANUAL'?15:s.source==='DEMO'?35:30}
  if(s.source==='REAL'&&age>30){blocks.push(`Snapshot com ${Math.round(age)}s de idade`);penalty+=20}
  if(defined(s.sourceDelaySeconds)&&s.sourceDelaySeconds>15){blocks.push(`Fonte informa atraso de ${s.sourceDelaySeconds}s`);penalty+=20}
  if(missing.length){blocks.push(`Campos críticos ausentes: ${missing.join(', ')}`);penalty+=Math.min(35,missing.length*5)}
  return {liveEligible:blocks.length===0,blocks,confidencePenalty:penalty}
}

export function analyzeSnapshot(s:MarketSnapshot):RadarAnalysis{
  const trend=inferTrend(s),regime=detectRegime(s,trend),setup=detectSetup(s,regime,trend)
  const macro=scoreMacro(s),br=scoreBrazil(s),structure=scoreStructure(s),location=scoreLocation(s,setup),flow=scoreFlow(s),trigger=scoreTrigger(s),risk=scoreRisk(s)
  const blocks=[macro,br,structure,location,flow,trigger,risk.block]
  const buyScore=Math.round(clamp(blocks.reduce((a,b)=>a+b.buy,0),0,100)),sellScore=Math.round(clamp(blocks.reduce((a,b)=>a+b.sell,0),0,100))
  const preferredSide:SetupSide=buyScore>=sellScore+8?'COMPRA':sellScore>=buyScore+8?'VENDA':'NEUTRO'
  const missing=missingFields(s),gate=sourceGate(s,missing),executionBlocks=[...risk.executionBlocks,...gate.blocks],vetoes=[...risk.vetoes]
  if(newsWindowActive(s))vetoes.push(`Janela de notícia de alto impacto${s.macroEventName?`: ${s.macroEventName}`:''}`)
  if(s.triggerBuy&&s.triggerSell)executionBlocks.push('Gatilhos comprador e vendedor simultâneos')
  if(!setup.confirmed)executionBlocks.push(`${setup.name}: confirmação incompleta`)
  if(setup.side!=='NEUTRO'&&preferredSide!=='NEUTRO'&&setup.side!==preferredSide)executionBlocks.push(`Setup ${setup.side} contradiz o score dominante ${preferredSide}`)
  if(preferredSide==='COMPRA'&&flow.sell>=12&&defined(s.relativeVolume)&&s.relativeVolume>=1.3)vetoes.push('Fluxo vendedor forte contradiz compra')
  if(preferredSide==='VENDA'&&flow.buy>=12&&defined(s.relativeVolume)&&s.relativeVolume>=1.3)vetoes.push('Fluxo comprador forte contradiz venda')
  if(regime==='RANGE'&&setup.name!=='Falha de Rompimento')executionBlocks.push('Range sem falha de rompimento confirmada')
  const liveEligible=gate.liveEligible
  const confidence=clamp(Math.round(100-gate.confidencePenalty-(!defined(s.aggressionDelta)&&!defined(s.cumulativeDelta)?10:0)-(!defined(s.sp500Change)&&!defined(s.ibovChange)?5:0)),10,100)
  const top=Math.max(buyScore,sellScore);let status:Status
  if(newsWindowActive(s))status='VETO POR NOTÍCIA'
  else if(vetoes.length)status='SEM OPERAÇÃO'
  else if(liveEligible&&setup.confirmed&&setup.side===preferredSide&&top>=85&&confidence>=70)status='SETUP A'
  else if(liveEligible&&setup.side!== 'NEUTRO'&&top>=75)status='AGUARDAR'
  else if(top>=65)status='OBSERVAÇÃO'
  else status='SEM OPERAÇÃO'
  const flowState=!defined(s.aggressionDelta)&&!defined(s.cumulativeDelta)&&!defined(s.bidAskImbalance)&&!s.absorption?'INDISPONÍVEL':flow.buy>=flow.sell+4?'COMPRADOR':flow.sell>=flow.buy+4?'VENDEDOR':'NEUTRO'
  const volumeState=!defined(s.relativeVolume)?'INDISPONÍVEL':s.relativeVolume>=1.3?'FORTE':s.relativeVolume<0.7?'FRACO':'NORMAL'
  const vwapPosition=!defined(s.price)||!defined(s.vwap)?'INDISPONÍVEL':nearAtr(s.price,s.vwap,s.atr,.15)?'PRÓXIMO':s.price>s.vwap?'ACIMA':'ABAIXO'
  const audit=[...blocks.flatMap(b=>b.reasons.map(r=>`${b.name}: ${r}`)),...setup.reasons.map(r=>`Setup: ${r}`),...executionBlocks.map(r=>`Bloqueio: ${r}`),...vetoes.map(r=>`Veto: ${r}`)]
  return {modelVersion:MODEL_VERSION,timestamp:s.timestamp,regime,buyScore,sellScore,confidence,status,preferredSide,setup:setup.name,setupSide:setup.side,setupConfirmed:setup.confirmed,liveEligible,trend,flow:flowState,volumeState,vwapPosition,riskBRL:risk.riskBRL,rewardBRL:risk.rewardBRL,riskReward:risk.rr,blocks,vetoes,executionBlocks,missing,audit}
}

export const riskDefaults={contracts:CONTRACTS,pointValue:POINT_VALUE,maxTradeRisk:MAX_TRADE_RISK,maxDailyLoss:MAX_DAILY_LOSS,maxTradesDay:MAX_TRADES_DAY}

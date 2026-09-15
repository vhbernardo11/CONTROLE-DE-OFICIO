import type { MarketSnapshot } from './types'

const base=():MarketSnapshot=>({
  timestamp:new Date().toISOString(),source:'REAL',sourceDelaySeconds:2,asset:'WINV26',price:188000,open:187300,high:188120,low:187250,prevClose:187100,settlement:187180,
  vwap:187900,ema9:187950,sma21:187920,sma50:187700,sma200:186900,hilo11:187880,atr:250,relativeVolume:1.6,prevHigh:188500,prevLow:186900,
  openingRangeHigh:187650,openingRangeLow:187250,minutesSinceOpen:60,aggressionDelta:5500,cumulativeDelta:12000,bidAskImbalance:.24,absorption:'COMPRADORA',retestBuy:true,
  wdoChange:-.35,ibovChange:.55,petr4Change:.6,vale3Change:.45,sp500Change:.3,nasdaqChange:.4,vixChange:-1.4,dxyChange:-.2,us10yChangeBps:-3,
  minutesToMacroEvent:45,macroEventName:'Sem evento próximo',macroEventImpact:'high',dailyPnl:0,consecutiveLosses:0,tradesCount:0,stopPoints:80,targetPoints:180,triggerBuy:true,triggerSell:false
})

export const radarFixtures=[
  {name:'trend_pullback_compra',snapshot:base(),expect:(a:any)=>a.setup==='Trend Pullback'&&a.setupSide==='COMPRA'&&a.liveEligible&&a.status==='SETUP A'},
  {name:'veto_noticia',snapshot:{...base(),minutesToMacroEvent:3,macroEventName:'Payroll'},expect:(a:any)=>a.status==='VETO POR NOTÍCIA'&&a.vetoes.length>0},
  {name:'trava_perda_diaria',snapshot:{...base(),dailyPnl:-80},expect:(a:any)=>a.status==='SEM OPERAÇÃO'&&a.vetoes.some((v:string)=>v.includes('Limite diário'))},
  {name:'orb_sem_reteste',snapshot:{...base(),price:188300,high:188330,ema9:188150,sma21:188000,retestBuy:false},expect:(a:any)=>a.setup.includes('ORB')&&!a.setupConfirmed&&a.status!=='SETUP A'},
  {name:'demo_nunca_live',snapshot:{...base(),source:'DEMO' as const},expect:(a:any)=>!a.liveEligible&&a.status!=='SETUP A'},
  {name:'fluxo_contra_bloqueia',snapshot:{...base(),aggressionDelta:-6000,cumulativeDelta:-14000,bidAskImbalance:-.3,absorption:'VENDEDORA' as const},expect:(a:any)=>a.status!=='SETUP A'&&a.vetoes.some((v:string)=>v.includes('Fluxo vendedor forte'))},
]

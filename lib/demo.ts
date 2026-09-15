import type { MarketSnapshot } from './types'

export const demoSnapshot:MarketSnapshot={
  timestamp:new Date().toISOString(),source:'DEMO',asset:'WINV26',price:187850,open:187420,high:188020,low:187190,prevClose:187300,settlement:187360,
  vwap:187710,ema9:187820,sma21:187760,sma50:187630,sma200:186980,hilo11:187690,atr:145,relativeVolume:1.42,prevHigh:188260,prevLow:187250,
  openingRangeHigh:187620,openingRangeLow:187310,aggressionDelta:4200,wdoChange:-0.32,ibovChange:0.44,petr4Change:0.72,vale3Change:0.38,
  sp500Change:0.28,nasdaqChange:0.35,vixChange:-1.2,dxyChange:-0.18,oilChange:0.45,us10yChangeBps:-1.5,minutesToMacroEvent:38,macroEventName:'Exemplo DEMO',
  dailyPnl:0,consecutiveLosses:0,stopPoints:80,targetPoints:180,triggerBuy:true,triggerSell:false,notes:'Dados fictícios somente para demonstração.'
}

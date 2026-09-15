import { analyzeSnapshot, MODEL_VERSION } from '../_shared/radar-v3.ts'

const base=()=>({timestamp:new Date().toISOString(),source:'REAL',provider:'SELFTEST_RT',sourceDelaySeconds:2,asset:'WINV26',price:188000,open:187300,high:188120,low:187250,prevClose:187100,settlement:187180,vwap:187900,ema9:187950,sma21:187920,sma50:187700,sma200:186900,hilo11:187880,atr:250,relativeVolume:1.6,prevHigh:188500,prevLow:186900,openingRangeHigh:187650,openingRangeLow:187250,minutesSinceOpen:60,aggressionDelta:5500,cumulativeDelta:12000,bidAskImbalance:.24,absorption:'COMPRADORA',retestBuy:true,wdoChange:-.35,ibovChange:.55,petr4Change:.6,vale3Change:.45,sp500Change:.3,nasdaqChange:.4,vixChange:-1.4,dxyChange:-.2,us10yChangeBps:-3,minutesToMacroEvent:45,macroEventName:'Sem evento próximo',macroEventImpact:'high',dailyPnl:0,consecutiveLosses:0,tradesCount:0,stopPoints:80,targetPoints:180,triggerBuy:true,triggerSell:false})

Deno.serve(()=>{
  const cases=[
    ['trend_pullback_compra',base(),(a:any)=>a.setup==='Trend Pullback'&&a.setupSide==='COMPRA'&&a.liveEligible&&a.status==='SETUP A'],
    ['veto_noticia',{...base(),minutesToMacroEvent:3,macroEventName:'Payroll'},(a:any)=>a.status==='VETO POR NOTÍCIA'],
    ['trava_perda_diaria',{...base(),dailyPnl:-80},(a:any)=>a.status==='SEM OPERAÇÃO'&&a.vetoes.some((v:string)=>v.includes('Limite diário'))],
    ['orb_sem_reteste',{...base(),price:188300,high:188330,ema9:188150,sma21:188000,retestBuy:false},(a:any)=>a.setup.includes('ORB')&&!a.setupConfirmed&&a.status!=='SETUP A'],
    ['demo_nunca_live',{...base(),source:'DEMO'},(a:any)=>!a.liveEligible&&a.status!=='SETUP A'],
    ['fluxo_contra_bloqueia',{...base(),aggressionDelta:-6000,cumulativeDelta:-14000,bidAskImbalance:-.3,absorption:'VENDEDORA'},(a:any)=>a.status!=='SETUP A'&&a.vetoes.some((v:string)=>v.includes('Fluxo vendedor forte'))],
  ] as any[]
  const results=cases.map(([name,snapshot,expect])=>{const a=analyzeSnapshot({...snapshot,timestamp:new Date().toISOString()});let pass=false;try{pass=!!expect(a)}catch{}return{name,pass,status:a.status,setup:a.setup,side:a.setupSide,buyScore:a.buyScore,sellScore:a.sellScore,liveEligible:a.liveEligible,vetoes:a.vetoes}})
  return new Response(JSON.stringify({ok:results.every((r:any)=>r.pass),modelVersion:MODEL_VERSION,passed:results.filter((r:any)=>r.pass).length,total:results.length,results}),{headers:{'content-type':'application/json','cache-control':'no-store','Access-Control-Allow-Origin':'*'}})
})

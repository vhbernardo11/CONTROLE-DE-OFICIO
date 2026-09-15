'use client'
import { useEffect, useMemo, useState } from 'react'
import { analyzeSnapshot, riskDefaults } from '@/lib/radar'
import { demoSnapshot } from '@/lib/demo'
import type { MarketSnapshot, RadarAnalysis } from '@/lib/types'

type Tab='Radar'|'Entrada'|'Sinais'|'Diário'|'Integrações'
const n=(v?:number,d=2)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(d):'—'
const money=(v?:number)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—'

function ScoreRing({label,value}:{label:string,value:number}){return <div className="score"><div className="scoreValue">{value}</div><div className="scoreLabel">{label}</div></div>}
function Badge({children,tone='neutral'}:{children:React.ReactNode,tone?:string}){return <span className={`badge ${tone}`}>{children}</span>}

export default function RadarApp(){
  const [tab,setTab]=useState<Tab>('Radar')
  const [snapshot,setSnapshot]=useState<MarketSnapshot>(demoSnapshot)
  const [mode,setMode]=useState<'DEMO'|'MANUAL'|'LIVE'>('DEMO')
  const [remote,setRemote]=useState<RadarAnalysis|null>(null)
  const [liveAge,setLiveAge]=useState<number|null>(null)
  const [loading,setLoading]=useState(false)
  const analysis=useMemo(()=>analyzeSnapshot(snapshot),[snapshot])
  const active=mode==='LIVE'&&remote?remote:analysis

  useEffect(()=>{
    const saved=localStorage.getItem('integraradar-manual')
    if(saved){try{setSnapshot(JSON.parse(saved))}catch{}}
  },[])

  useEffect(()=>{
    if(mode!=='LIVE') return
    const id=setInterval(()=>loadLive(true),30000)
    return()=>clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[mode])

  async function loadLive(silent=false){
    if(!silent)setLoading(true)
    try{
      await fetch('/api/context',{cache:'no-store'}).catch(()=>null)
      const r=await fetch('/api/state',{cache:'no-store'})
      const j=await r.json()
      if(j?.snapshot?.analysis&&j?.snapshot?.snapshot){
        setRemote(j.snapshot.analysis)
        setSnapshot(j.snapshot.snapshot)
        setLiveAge(typeof j.ageSeconds==='number'?j.ageSeconds:null)
        setMode('LIVE')
        if(!silent)setTab('Radar')
      }else if(!silent){
        alert('Backend conectado, mas ainda não há feed WIN recebido. O contexto externo já está ativo; o WIN continua em DEMO/MANUAL até ligarmos a fonte em tempo real.')
      }
    }catch{
      if(!silent)alert('Não foi possível consultar o backend do IntegraRadar.')
    }finally{if(!silent)setLoading(false)}
  }

  function saveManual(next:MarketSnapshot){
    const s={...next,source:'MANUAL' as const,timestamp:new Date().toISOString()}
    setSnapshot(s);localStorage.setItem('integraradar-manual',JSON.stringify(s));setMode('MANUAL');setRemote(null);setTab('Radar')
  }

  return <main className="shell">
    <header className="topbar">
      <div><div className="brand">IntegraRadar <span>Mobile</span></div><div className="sub">IntegraInvestimentos · análise, não execução</div></div>
      <button className="tiny" onClick={()=>loadLive(false)} disabled={loading}>{loading?'Buscando…':'Atualizar'}</button>
    </header>

    <section className="modebar">
      <Badge tone={mode==='DEMO'?'warn':mode==='LIVE'?'good':'info'}>{mode}</Badge>
      <span>{snapshot.asset}</span><span>•</span><span>{new Date(active.timestamp||snapshot.timestamp).toLocaleString('pt-BR')}</span>
      {mode==='LIVE'&&liveAge!==null&&<><span>•</span><span>{liveAge}s atrás</span></>}
    </section>

    {tab==='Radar'&&<>
      <section className={`statusCard ${active.status.includes('VETO')||active.status==='SEM OPERAÇÃO'?'bad':active.status==='SETUP A'?'good':'wait'}`}>
        <div className="eyebrow">STATUS</div><div className="statusText">{active.status}</div>
        <div className="statusMeta">{active.regime} · {active.setup} · confiança {active.confidence}%</div>
      </section>
      <section className="scoreRow"><ScoreRing label="CompraScore" value={active.buyScore}/><ScoreRing label="VendaScore" value={active.sellScore}/></section>
      <section className="grid2">
        <div className="card"><span>Tendência</span><b>{active.trend}</b></div>
        <div className="card"><span>VWAP</span><b>{active.vwapPosition}</b></div>
        <div className="card"><span>Fluxo</span><b>{active.flow}</b></div>
        <div className="card"><span>Volume</span><b>{active.volumeState}</b></div>
      </section>
      <section className="card riskCard"><div><span>Stop técnico</span><b>{n(snapshot.stopPoints,0)} pts · {money(active.riskBRL)}</b></div><div><span>Alvo</span><b>{n(snapshot.targetPoints,0)} pts · {money(active.rewardBRL)}</b></div><div><span>R:R</span><b>{n(active.riskReward,2)}</b></div></section>
      <section className="card"><span>Qualidade/origem</span><b>{snapshot.source}</b><small className="muted">REAL só deve ser usado quando a fonte WIN for realmente em tempo real. Contexto externo pode estar atrasado e é tratado apenas como filtro.</small></section>
      {active.vetoes.length>0&&<section className="card alert"><h3>VETOS</h3>{active.vetoes.map(v=><p key={v}>• {v}</p>)}</section>}
      <section className="card"><h3>Auditoria do score</h3>{active.blocks.map(b=><div className="block" key={b.name}><div><b>{b.name}</b><span>C {b.buy}/{b.max} · V {b.sell}/{b.max}</span></div><div className="meter"><i style={{width:`${Math.max(b.buy,b.sell)/b.max*100}%`}}/></div></div>)}</section>
      {active.missing.length>0&&<section className="card missing"><h3>Dados ausentes</h3><p>{active.missing.join(' · ')}</p><small>A confiança é reduzida quando faltam dados.</small></section>}
      <section className="disclaimer">O IntegraRadar é apoio à decisão e gestão de risco. Não envia ordens, não prevê o mercado com certeza e não garante resultado.</section>
    </>}

    {tab==='Entrada'&&<ManualForm initial={snapshot} onSave={saveManual} onDemo={()=>{setSnapshot({...demoSnapshot,timestamp:new Date().toISOString()});setMode('DEMO');setRemote(null);setTab('Radar')}}/>}
    {tab==='Sinais'&&<Signals/>}
    {tab==='Diário'&&<Journal/>}
    {tab==='Integrações'&&<Integrations/>}

    <nav className="bottomNav">{(['Radar','Entrada','Sinais','Diário','Integrações'] as Tab[]).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</nav>
  </main>
}

function ManualForm({initial,onSave,onDemo}:{initial:MarketSnapshot,onSave:(s:MarketSnapshot)=>void,onDemo:()=>void}){
  const [f,setF]=useState<MarketSnapshot>(initial)
  useEffect(()=>setF(initial),[initial])
  const fields:[keyof MarketSnapshot,string,string][]=[['price','Preço','number'],['vwap','VWAP','number'],['ema9','MME 9','number'],['sma21','MMA 21','number'],['sma50','MMA 50','number'],['sma200','MMA 200','number'],['hilo11','HiLo 11','number'],['atr','ATR','number'],['relativeVolume','Volume relativo','number'],['prevHigh','Máx. anterior','number'],['prevLow','Mín. anterior','number'],['openingRangeHigh','OR15 máxima','number'],['openingRangeLow','OR15 mínima','number'],['aggressionDelta','Delta agressão','number'],['wdoChange','WDO %','number'],['ibovChange','IBOV %','number'],['petr4Change','PETR4 %','number'],['vale3Change','VALE3 %','number'],['sp500Change','S&P futuro %','number'],['nasdaqChange','Nasdaq futuro %','number'],['vixChange','VIX %','number'],['dxyChange','DXY %','number'],['oilChange','Petróleo %','number'],['us10yChangeBps','US10Y bps','number'],['minutesToMacroEvent','Min. até evento','number'],['stopPoints','Stop pts','number'],['targetPoints','Alvo pts','number'],['dailyPnl','P&L dia R$','number'],['consecutiveLosses','Perdas seguidas','number']]
  function upd(k:keyof MarketSnapshot,v:string){setF({...f,[k]:v===''?undefined:Number(v)})}
  return <section className="panel"><div className="sectionTitle"><h2>Entrada manual</h2><button className="tiny" onClick={onDemo}>Carregar DEMO</button></div><p className="hint">Fallback para quando o feed WIN não estiver conectado. Campos vazios reduzem a confiança.</p><div className="formGrid">{fields.map(([k,l])=><label key={String(k)}><span>{l}</span><input inputMode="decimal" value={(f[k] as number|undefined)??''} onChange={e=>upd(k,e.target.value)}/></label>)}</div><label className="switch"><input type="checkbox" checked={!!f.triggerBuy} onChange={e=>setF({...f,triggerBuy:e.target.checked,triggerSell:e.target.checked?false:f.triggerSell})}/> Gatilho comprador confirmado</label><label className="switch"><input type="checkbox" checked={!!f.triggerSell} onChange={e=>setF({...f,triggerSell:e.target.checked,triggerBuy:e.target.checked?false:f.triggerBuy})}/> Gatilho vendedor confirmado</label><label><span>Próximo evento macro</span><input value={f.macroEventName??''} onChange={e=>setF({...f,macroEventName:e.target.value})}/></label><button className="primary" onClick={()=>onSave(f)}>Analisar agora</button></section>
}

function Signals(){
  const [signals,setSignals]=useState<any[]>([]);const [configured,setConfigured]=useState<boolean|null>(null)
  useEffect(()=>{fetch('/api/signals',{cache:'no-store'}).then(r=>r.json()).then(j=>{setSignals(j.signals||[]);setConfigured(j.configured)}).catch(()=>setConfigured(false))},[])
  return <section className="panel"><h2>Sinais</h2>{configured===false&&<p className="hint">Backend temporariamente indisponível.</p>}{signals.length===0?<div className="empty">Nenhum Setup A/Veto salvo ainda.</div>:signals.map((s:any)=><div className="signal" key={s.id}><b>{s.status} · {s.asset}</b><span>{new Date(s.ts).toLocaleString('pt-BR')}</span><span>C {s.buy_score} · V {s.sell_score}</span></div>)}</section>
}

function Journal(){const [pnl,setPnl]=useState(0);const [losses,setLosses]=useState(0);const locked=pnl<=-riskDefaults.maxDailyLoss||losses>=2;return <section className="panel"><h2>Diário operacional</h2><div className={`statusCard ${locked?'bad':'wait'}`}><div className="eyebrow">TRAVA DO DIA</div><div className="statusText">{locked?'ENCERRAR OPERAÇÕES':'ATIVO'}</div></div><div className="formGrid"><label><span>Resultado do dia (R$)</span><input inputMode="decimal" value={pnl} onChange={e=>setPnl(Number(e.target.value))}/></label><label><span>Perdas consecutivas</span><input inputMode="numeric" value={losses} onChange={e=>setLosses(Number(e.target.value))}/></label></div><div className="card"><p>Limite diário: <b>-R$ {riskDefaults.maxDailyLoss}</b></p><p>Duas perdas consecutivas encerram o dia.</p><p>Proibido aumentar mão para recuperar e fazer preço médio contra a posição.</p></div></section>}

function Integrations(){return <section className="panel"><h2>Integrações</h2>{[
  ['Toro Trader Mobile','Execução manual','REAL'],
  ['Supabase','Banco + motor + Edge Functions','CONECTADO'],
  ['Contexto externo','Coleta automática rotulada como atrasada','ATIVO'],
  ['GitHub','Código-fonte e histórico','CONECTADO'],
  ['Vercel','Hospedagem mobile','PRONTO P/ DEPLOY'],
  ['TradingView / feed WIN','Adaptador Pine preparado; transporte ao vivo ainda depende do recurso de alerta/feed','PENDENTE'],
  ['Massive','Contexto internacional quando houver entitlement','CONECTADO'],
  ['Hugging Face','Modelos experimentais futuros','DISPONÍVEL']
].map(([a,b,c])=><div className="integration" key={a}><div><b>{a}</b><span>{b}</span></div><Badge tone={['REAL','CONECTADO','ATIVO'].includes(c)?'good':c.includes('PRONTO')?'info':c==='PENDENTE'?'warn':'neutral'}>{c}</Badge></div>)}<div className="card missing"><b>Regra de integridade</b><p>Nunca converter dado atrasado, DEMO ou ausente em “tempo real”. A origem é sempre exibida e o feed WIN é separado do contexto externo.</p></div></section>}

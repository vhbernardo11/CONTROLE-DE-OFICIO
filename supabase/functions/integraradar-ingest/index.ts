import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { analyzeSnapshot, MODEL_VERSION } from '../_shared/radar-v3.ts'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}})
async function sha256(value:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('')}
const num=(v:any)=>typeof v==='number'&&Number.isFinite(v)

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  try{
    const body=await req.json(),rawToken=String(body?.token??'')
    if(!rawToken)return json({error:'missing_ingest_token'},401)
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),tokenHash=await sha256(rawToken)
    const {data:key}=await db.from('ingest_keys').select('id,name').eq('token_hash',tokenHash).eq('active',true).maybeSingle()
    if(!key)return json({error:'invalid_ingest_token'},401)

    const snapshot={...(body.snapshot??body)};delete snapshot.token
    if(!snapshot.asset||!snapshot.timestamp)return json({error:'asset_timestamp_required'},422)
    snapshot.provider=snapshot.provider??key.name
    snapshot.source=snapshot.source??'INDISPONÍVEL'
    const ts=new Date(snapshot.timestamp);if(Number.isNaN(ts.getTime()))return json({error:'invalid_timestamp'},422)
    snapshot.sourceDelaySeconds=Math.max(0,Math.round((Date.now()-ts.getTime())/1000))

    const {data:ctx}=await db.from('context_snapshots').select('ts,payload').order('ts',{ascending:false}).limit(1).maybeSingle()
    if(ctx?.ts&&Date.now()-new Date(ctx.ts).getTime()<20*60*1000){
      const q=ctx?.payload?.quotes??{},fill=(k:string,v:any)=>{if(!num(snapshot[k])&&num(v))snapshot[k]=v}
      fill('sp500Change',q?.sp500?.changePct);fill('nasdaqChange',q?.nasdaq?.changePct);fill('vixChange',q?.vix?.changePct);fill('dxyChange',q?.dxy?.changePct);fill('oilChange',q?.oil?.changePct);fill('ibovChange',q?.ibov?.changePct);fill('petr4Change',q?.petr4?.changePct);fill('vale3Change',q?.vale3?.changePct)
      if(!num(snapshot.us10yChangeBps)&&num(q?.us10y?.price)&&num(q?.us10y?.changePct)){const prev=q.us10y.price/(1+q.us10y.changePct/100);snapshot.us10yChangeBps=(q.us10y.price-prev)*100}
      snapshot.contextSource='YAHOO_CONTEXT_DELAYED';snapshot.contextTimestamp=ctx.ts
    }

    const now=new Date(),nowIso=now.toISOString()
    const {data:nextEv}=await db.from('economic_events').select('event_ts,title,impact').eq('impact','high').gte('event_ts',nowIso).order('event_ts',{ascending:true}).limit(1).maybeSingle()
    const {data:prevEv}=await db.from('economic_events').select('event_ts,title,impact').eq('impact','high').lte('event_ts',nowIso).order('event_ts',{ascending:false}).limit(1).maybeSingle()
    if(nextEv?.event_ts){snapshot.minutesToMacroEvent=Math.max(0,Math.round((new Date(nextEv.event_ts).getTime()-Date.now())/60000));snapshot.macroEventName=nextEv.title;snapshot.macroEventImpact='high'}
    if(prevEv?.event_ts){snapshot.minutesSinceMacroEvent=Math.max(0,Math.round((Date.now()-new Date(prevEv.event_ts).getTime())/60000));if(snapshot.minutesSinceMacroEvent<=10){snapshot.macroEventName=prevEv.title;snapshot.macroEventImpact='high'}}

    const spDate=now.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})
    const {data:risk}=await db.from('daily_risk').select('realized_pnl_brl,consecutive_losses,trades_count,locked,lock_reason').eq('trade_date',spDate).maybeSingle()
    if(risk){snapshot.dailyPnl=Number(risk.realized_pnl_brl??0);snapshot.consecutiveLosses=Number(risk.consecutive_losses??0);snapshot.tradesCount=Number(risk.trades_count??0);snapshot.riskLedgerLocked=!!risk.locked;snapshot.riskLockReason=risk.lock_reason??null}

    const analysis=analyzeSnapshot(snapshot)
    const provider=String(snapshot.provider||key.name)
    const {error:snapErr}=await db.from('market_snapshots').insert({ts:snapshot.timestamp,asset:snapshot.asset,source:provider,source_delay_seconds:snapshot.sourceDelaySeconds,price:snapshot.price??null,snapshot,analysis,model_version:MODEL_VERSION})
    if(snapErr)throw snapErr

    if(analysis.status==='SETUP A'||analysis.status==='VETO POR NOTÍCIA'){
      const {error:sigErr}=await db.from('signals').insert({ts:snapshot.timestamp,asset:snapshot.asset,price:snapshot.price??null,regime:analysis.regime,buy_score:analysis.buyScore,sell_score:analysis.sellScore,status:analysis.status,setup:analysis.setup,setup_side:analysis.setupSide,live_eligible:analysis.liveEligible,stop_points:snapshot.stopPoints??null,target_points:snapshot.targetPoints??null,rr:analysis.riskReward??null,payload:snapshot,analysis,model_version:MODEL_VERSION})
      if(sigErr)throw sigErr
    }

    await db.from('source_health').upsert({source:provider,last_seen_at:new Date().toISOString(),status:snapshot.source==='REAL'&&snapshot.sourceDelaySeconds<=15?'ok':snapshot.source==='REAL'?'delayed':'non_realtime',delay_seconds:snapshot.sourceDelaySeconds,message:`${snapshot.asset} recebido · ${snapshot.source} · ${MODEL_VERSION}`,metadata:{quality:snapshot.source,modelVersion:MODEL_VERSION},updated_at:new Date().toISOString()},{onConflict:'source'})
    await db.from('ingest_keys').update({last_used_at:new Date().toISOString()}).eq('id',key.id)
    return json({ok:true,modelVersion:MODEL_VERSION,provider,analysis})
  }catch(e){return json({error:'internal_error',message:String((e as Error)?.message??e)},500)}
})

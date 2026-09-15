import { createClient } from 'jsr:@supabase/supabase-js@2'
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
Deno.serve(async()=>{
  const [{data:sources,error:e1},{data:refs,error:e2},{data:health,error:e3}]=await Promise.all([
    db.from('integraradar_feed_candidates').select('*'),
    db.from('futures_reference').select('ref_date,symbol,underlying_asset,expiration_date,close,settlement,oscillation_pct,volume,source,latency_class').order('ref_date',{ascending:false}).limit(10),
    db.from('source_health').select('source,last_seen_at,status,delay_seconds,message,metadata,updated_at').order('updated_at',{ascending:false})
  ])
  if(e1||e2||e3)return new Response(JSON.stringify({ok:false,error:e1?.message||e2?.message||e3?.message}),{status:500,headers})
  const live=(sources??[]).filter((s:any)=>s.active&&s.usable_for_live_scoring&&s.latency_class==='REALTIME'&&(!s.requires_credentials||s.credentials_configured))
  return new Response(JSON.stringify({ok:true,stage:2,liveFeedReady:live.length>0,liveSources:live,sources,latestFuturesReference:refs,health,policy:{realtimeRequiredForLiveScoring:true,delayedOrEodMayBeStoredButCannotCreateLiveSignals:true,tradingViewDataForMachineScoring:false}}),{headers})
})

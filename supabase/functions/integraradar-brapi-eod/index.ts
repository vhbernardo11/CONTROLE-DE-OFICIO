import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
const num=(v:unknown)=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:null}
const dateOf=(v:unknown)=>{const n=num(v);return n===null?null:new Date(n*1000).toISOString().slice(0,10)}
function front(contracts:any[]){const today=new Date().toISOString().slice(0,10);const live=contracts.filter(c=>!c?.expirationDate||String(c.expirationDate)>=today);return [...(live.length?live:contracts)].sort((a,b)=>String(a?.expirationDate??'9999-12-31').localeCompare(String(b?.expirationDate??'9999-12-31')))[0]??null}

Deno.serve(async()=>{
  const out:any[]=[]
  try{
    for(const asset of ['WIN','WDO'] as const){
      const url=`https://brapi.dev/api/v2/futures/term-structure?asset=${asset}`
      const r=await fetch(url,{headers:{accept:'application/json'}});if(!r.ok)throw new Error(`brapi ${asset}: HTTP ${r.status}`)
      const data=await r.json(),c=front(data?.contracts??[]);if(!c){out.push({asset,ok:false});continue}
      const refDate=dateOf(c.date)??new Date().toISOString().slice(0,10)
      const row={ref_date:refDate,symbol:String(c.symbol),underlying_asset:asset,expiration_date:c.expirationDate??null,close:num(c.close),high:num(c.high),low:num(c.low),average:num(c.average),settlement:num(c.settlement),oscillation_pct:num(c.oscillationPct),trades:num(c.trades),volume:num(c.volume),financial_volume:num(c.financialVolume),source:'BRAPI_EOD',latency_class:'EOD',payload:{endpoint:url,requestedAt:data?.requestedAt??null,contract:c}}
      const {error}=await supabase.from('futures_reference').upsert(row,{onConflict:'ref_date,symbol,source'});if(error)throw error
      await supabase.from('source_health').upsert({source:'BRAPI_EOD',last_seen_at:new Date().toISOString(),status:'HEALTHY',message:`EOD ${asset} ${c.symbol} ref ${refDate}`,metadata:{asset,symbol:c.symbol,refDate,settlement:c.settlement??null,close:c.close??null},updated_at:new Date().toISOString()},{onConflict:'source'})
      out.push({asset,ok:true,symbol:c.symbol,refDate,settlement:c.settlement??null,close:c.close??null})
    }
    return new Response(JSON.stringify({ok:true,source:'BRAPI_EOD',realtime:false,results:out}),{headers})
  }catch(e){return new Response(JSON.stringify({ok:false,realtime:false,error:e instanceof Error?e.message:String(e)}),{status:502,headers})}
})

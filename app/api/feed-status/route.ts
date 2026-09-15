import { NextResponse } from 'next/server'
const EDGE='https://ovfuiwvnzuodbtcnoqor.supabase.co/functions/v1'
export async function GET(){
  try{
    const r=await fetch(`${EDGE}/integraradar-feed-status`,{cache:'no-store'})
    const text=await r.text()
    return new NextResponse(text,{status:r.status,headers:{'content-type':'application/json','cache-control':'no-store'}})
  }catch(e){
    return NextResponse.json({ok:false,error:'feed_status_unavailable',message:String((e as Error)?.message??e)},{status:503})
  }
}

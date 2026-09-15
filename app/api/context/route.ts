import { NextResponse } from 'next/server'

const EDGE='https://ovfuiwvnzuodbtcnoqor.supabase.co/functions/v1'

export async function GET(){
  try{
    const r=await fetch(`${EDGE}/integraradar-context-refresh`,{cache:'no-store'})
    const text=await r.text()
    return new NextResponse(text,{status:r.status,headers:{'content-type':'application/json','cache-control':'no-store'}})
  }catch(e){
    return NextResponse.json({ok:false,error:'context_unavailable',message:String((e as Error)?.message??e)},{status:503})
  }
}

import { NextRequest, NextResponse } from 'next/server'

const EDGE='https://ovfuiwvnzuodbtcnoqor.supabase.co/functions/v1'

export async function POST(req:NextRequest){
  try{
    const body=await req.text()
    const r=await fetch(`${EDGE}/integraradar-ingest`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body,
      cache:'no-store'
    })
    const text=await r.text()
    return new NextResponse(text,{status:r.status,headers:{'content-type':'application/json','cache-control':'no-store'}})
  }catch(e){
    return NextResponse.json({ok:false,error:'ingest_unavailable',message:String((e as Error)?.message??e)},{status:503})
  }
}

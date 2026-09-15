import { NextResponse } from 'next/server'

const EDGE='https://ovfuiwvnzuodbtcnoqor.supabase.co/functions/v1'

export async function GET(){
  try{
    const r=await fetch(`${EDGE}/integraradar-signals?asset=WINV26&limit=50`,{cache:'no-store'})
    const j=await r.json()
    return NextResponse.json({configured:r.ok,signals:j?.signals??[],error:r.ok?undefined:j?.error},{status:r.status})
  }catch(e){
    return NextResponse.json({configured:false,signals:[],error:'signals_unavailable',message:String((e as Error)?.message??e)},{status:503})
  }
}

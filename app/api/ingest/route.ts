import { NextRequest, NextResponse } from 'next/server'
import { analyzeSnapshot } from '@/lib/radar'
import type { MarketSnapshot } from '@/lib/types'
import { getServerSupabase } from '@/lib/supabase-server'

export async function POST(req:NextRequest){
  const secret=process.env.INGEST_WEBHOOK_SECRET
  if(!secret) return NextResponse.json({error:'Webhook não configurado'},{status:503})
  const provided=req.headers.get('x-integraradar-secret')
  if(provided!==secret) return NextResponse.json({error:'Não autorizado'},{status:401})
  let body:MarketSnapshot
  try{ body=await req.json() }catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
  if(!body.asset||!body.timestamp||!body.source) return NextResponse.json({error:'asset, timestamp e source são obrigatórios'},{status:422})
  const analysis=analyzeSnapshot(body)
  const supabase=getServerSupabase()
  if(!supabase) return NextResponse.json({error:'Supabase não configurado',analysis},{status:503})
  const {error:snapError}=await supabase.from('market_snapshots').insert({snapshot:body,analysis,asset:body.asset,source:body.source,ts:body.timestamp})
  if(snapError) return NextResponse.json({error:snapError.message},{status:500})
  if(analysis.status==='SETUP A'||analysis.status==='VETO POR NOTÍCIA'){
    await supabase.from('signals').insert({asset:body.asset,ts:body.timestamp,price:body.price??null,regime:analysis.regime,buy_score:analysis.buyScore,sell_score:analysis.sellScore,status:analysis.status,setup:analysis.setup,payload:body,analysis})
  }
  return NextResponse.json({ok:true,analysis})
}

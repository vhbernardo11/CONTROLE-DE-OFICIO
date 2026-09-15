import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
export async function GET(){
  const supabase=getServerSupabase()
  if(!supabase) return NextResponse.json({configured:false,state:null})
  const {data,error}=await supabase.from('market_snapshots').select('*').order('ts',{ascending:false}).limit(1).maybeSingle()
  if(error) return NextResponse.json({configured:true,error:error.message,state:null},{status:500})
  return NextResponse.json({configured:true,state:data})
}

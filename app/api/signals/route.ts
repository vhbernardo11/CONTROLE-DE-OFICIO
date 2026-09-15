import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
export async function GET(){
  const supabase=getServerSupabase()
  if(!supabase) return NextResponse.json({configured:false,signals:[]})
  const {data,error}=await supabase.from('signals').select('*').order('ts',{ascending:false}).limit(100)
  if(error) return NextResponse.json({configured:true,error:error.message,signals:[]},{status:500})
  return NextResponse.json({configured:true,signals:data??[]})
}

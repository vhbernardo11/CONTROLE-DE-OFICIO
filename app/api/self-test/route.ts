import { NextResponse } from 'next/server'
import { analyzeSnapshot, MODEL_VERSION } from '@/lib/radar'
import { radarFixtures } from '@/lib/radar-fixtures'

export async function GET(){
  const results=radarFixtures.map(t=>{
    const analysis=analyzeSnapshot({...t.snapshot,timestamp:new Date().toISOString()})
    let pass=false
    try{pass=!!t.expect(analysis)}catch{pass=false}
    return {name:t.name,pass,status:analysis.status,setup:analysis.setup,side:analysis.setupSide,buyScore:analysis.buyScore,sellScore:analysis.sellScore,liveEligible:analysis.liveEligible,vetoes:analysis.vetoes}
  })
  return NextResponse.json({ok:results.every(r=>r.pass),modelVersion:MODEL_VERSION,passed:results.filter(r=>r.pass).length,total:results.length,results},{headers:{'cache-control':'no-store'}})
}

import {settings,error,hash} from '@/lib/server';
import {drainRefunds} from '@/lib/refunds';
export async function POST(req:Request){const secret=settings().REFUND_JOB_KEY;if(!secret||await hash(req.headers.get('authorization')??'')!==await hash(`Bearer ${secret}`))return error('Unauthorized.',401);try{await drainRefunds();return Response.json({ok:true});}catch{return error('Refunds remain pending. Check the Dodo ledger and retry.',503);}}

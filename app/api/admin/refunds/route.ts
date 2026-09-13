import {bearerMatches,settings,error} from '@/lib/server';
import {drainRefunds} from '@/lib/refunds';
export const dynamic='force-dynamic';
// Vercel Cron calls GET with `Authorization: Bearer CRON_SECRET`; operators may POST with REFUND_JOB_KEY.
async function run(req:Request){if(!await bearerMatches(req,settings().REFUND_JOB_KEY,settings().CRON_SECRET))return error('Unauthorized.',401);try{await drainRefunds();return Response.json({ok:true});}catch{return error('Refunds remain pending. Check the Dodo ledger and retry.',503);}}
export const GET=run;
export const POST=run;

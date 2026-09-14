import {bearerMatches,settings,error} from '@/lib/server';
import {drainRefunds} from '@/lib/refunds';
import {settlePendingBaseOrders} from '@/lib/base-orders';
export const dynamic='force-dynamic';
// Vercel Cron calls GET with `Authorization: Bearer CRON_SECRET`; operators may POST with REFUND_JOB_KEY.
// Settles Base payments that were still confirming, then works the refund queue (including Base refund sends and confirmations).
async function run(req:Request){if(!await bearerMatches(req,settings().REFUND_JOB_KEY,settings().CRON_SECRET))return error('Unauthorized.',401);let failed=false;try{await settlePendingBaseOrders();}catch{failed=true;}try{await drainRefunds();}catch{failed=true;}return failed?error('Some payments or refunds remain pending. Check the Dodo ledger and Base payouts, then retry.',503):Response.json({ok:true});}
export const GET=run;
export const POST=run;

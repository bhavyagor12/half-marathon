import {CLOSE_DATE} from './config';
import {checkBasePayment} from './base';
import {drainRefunds} from './refunds';
import {db} from './server';

type BaseOrder={id:string;status:string;pay_with:string;base_payment_id:string|null;base_amount:number|null};

/**
 * Settles a pending Base order whose payment id is known: verify onchain, then award atomically.
 * Returns the order's resulting state: 'paid', 'pending', 'retry' (the payment failed or didn't match; the sponsor can pay again), or another status.
 */
export async function settleBaseOrder(orderId:string){const {data:order,error:loadError}=await db().from('slowrun_orders').select('id,status,pay_with,base_payment_id,base_amount').eq('id',orderId).maybeSingle<BaseOrder>();if(loadError)throw loadError;
if(!order||order.pay_with!=='base')return 'unknown';if(order.status!=='pending'||!order.base_payment_id||!order.base_amount)return order.status;
const check=await checkBasePayment(order.base_payment_id,BigInt(order.base_amount));
if(check.state==='pending')return 'pending';
if(check.state!=='completed'){const {error:detachError}=await db().rpc('slowrun_detach_base_payment',{p_order_id:order.id,p_payment_id:order.base_payment_id});if(detachError)throw detachError;return 'retry';}
const {data:outcome,error:awardError}=await db().rpc('slowrun_award_base_payment',{p_order_id:order.id,p_payment_id:order.base_payment_id,p_payer:check.payer,p_now:Date.now(),p_close:Date.parse(CLOSE_DATE)});if(awardError)throw awardError;
// A takeover queues the previous sponsor's refund; send it now if possible, otherwise the scheduled run retries.
try{await drainRefunds();}catch{/* Refunds stay queued. */}
return outcome==='paid'||outcome==='replay'?'paid':String(outcome);}

/** Settles recent pending Base orders that have a payment id (e.g. the sponsor closed the tab while it was confirming). */
export async function settlePendingBaseOrders(){const since=Date.now()-3*24*60*60*1000;const {data,error:loadError}=await db().from('slowrun_orders').select('id').eq('pay_with','base').eq('status','pending').not('base_payment_id','is',null).gte('created',since).limit(25);if(loadError)throw loadError;
let failure:unknown;for(const order of data??[]){try{await settleBaseOrder(order.id);}catch(e){failure??=e;}}if(failure)throw failure;}

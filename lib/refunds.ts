import {refundAfterFees,type PaymentFee} from './refund-math';
import {db,dodo,settings} from './server';
import {baseSettings,baseTransactionStatus,sendBaseRefund} from './base';
import {isStablecoinPayment} from './wallet';
type RefundJob={payment:string;order_id:string;mode:string;status:string;amount:number|null;fee:number|null;refund_id:string|null;rail:string|null;payout_address:string|null;payout_reference:string|null};
// Jobs in these states are finished, with Dodo, or waiting on a person or the chain; the automatic queue leaves them alone.
const PARKED=['succeeded','submitted','awaiting_wallet','awaiting_payout','broadcasting'];
const isBasePayment=(payment:string)=>payment.startsWith('base:');
export async function processRefund(paymentId:string){const {data:job,error:loadError}=await db().from('slowrun_refund_jobs').select('*').eq('payment',paymentId).maybeSingle<RefundJob>();if(loadError)throw loadError;if(!job||PARKED.includes(job.status))return;if(job.status==='failed')throw new Error('Refund requires operator review');
// Base Pay: no processor, so the full amount goes back to the wallet that paid (recorded on the order when it was verified).
if(isBasePayment(paymentId)){if(job.amount===null){const {data:order,error:orderError}=await db().from('slowrun_orders').select('amount').eq('id',job.order_id).single<{amount:number}>();if(orderError)throw orderError;
const {error:freezeError}=await db().from('slowrun_refund_jobs').update({amount:order.amount,fee:0,rail:'base'}).eq('payment',paymentId).is('amount',null);if(freezeError)throw freezeError;}
const {error:routeError}=await db().rpc('slowrun_route_stablecoin_refund',{p_payment:paymentId});if(routeError)throw routeError;await sendQueuedBaseRefund(paymentId);return;}
const client=dodo();
if(job.amount===null){const payment=await client.payments.retrieve(paymentId,{timeout:10000,maxRetries:1});if(payment.currency!=='USD')throw new Error('Refund currency mismatch');if(payment.refunds.length)throw new Error('Existing refund requires reconciliation');let fee=0;if(job.mode==='outbid'){const entries:PaymentFee[]=[];for await(const entry of client.balances.retrieveLedger({reference_object_id:paymentId,event_type:'payment_fees',page_size:100},{timeout:10000,maxRetries:1})){entries.push(entry);}fee=refundAfterFees(payment.total_amount,paymentId,entries).fee;}const amount=payment.total_amount-fee;const rail=isStablecoinPayment(payment)?'stablecoin':'card';
// Freeze the amount once; a concurrent run that got here first keeps its value.
const {error:freezeError}=await db().from('slowrun_refund_jobs').update({amount,fee,rail}).eq('payment',paymentId).is('amount',null);if(freezeError)throw freezeError;}
const {data:fixed,error:fixedError}=await db().from('slowrun_refund_jobs').select('amount,fee,rail').eq('payment',paymentId).single<{amount:number;fee:number;rail:string|null}>();if(fixedError||!fixed)throw fixedError??new Error('Missing refund');const metadata:Record<string,string>={project:'slow-club',payment:paymentId};
if(fixed.rail==='stablecoin'){
// Dodo's refund API cannot take a destination wallet. Unless Dodo has confirmed it pays stablecoin refunds through the API
// (DODO_STABLECOIN_API_REFUNDS=true), park the refund with the payer's wallet for an operator payout, or until they add one.
const {data:order,error:orderError}=await db().from('slowrun_orders').select('refund_network,refund_address').eq('id',job.order_id).single<{refund_network:string|null;refund_address:string|null}>();if(orderError)throw orderError;
if(!order.refund_address||settings().DODO_STABLECOIN_API_REFUNDS!=='true'){const {error:routeError}=await db().rpc('slowrun_route_stablecoin_refund',{p_payment:paymentId});if(routeError)throw routeError;return;}
metadata.refund_network=order.refund_network??'';metadata.refund_address=order.refund_address;}
const refund=await client.refunds.create({payment_id:paymentId,items:[{item_id:settings().DODO_PAYMENTS_PRODUCT_ID,amount:fixed.amount,tax_inclusive:true}],reason:job.mode==='outbid'?'Outbid on a Slow Club placement. Original payment refunded minus the actual Dodo payment-processing fees.':'Checkout could not be fulfilled; full refund.',metadata},{idempotencyKey:`slow_refund_${paymentId}`,timeout:10000,maxRetries:1});
const {error:idError}=await db().from('slowrun_refund_jobs').update({refund_id:refund.refund_id}).eq('payment',paymentId);if(idError)throw idError;
// A refund webhook may already have marked it succeeded; never downgrade that.
const {error:statusError}=await db().from('slowrun_refund_jobs').update({status:'submitted'}).eq('payment',paymentId).neq('status','succeeded');if(statusError)throw statusError;}

/**
 * Sends a queued Base refund from the CDP server wallet, when automatic refunds are configured.
 * The job is claimed before sending and a send is never repeated: an error after claiming parks the job as failed for review.
 */
async function sendQueuedBaseRefund(paymentId:string){if(!baseSettings().autoRefunds)return;
const {data:claimed,error:claimError}=await db().rpc('slowrun_claim_base_refund',{p_payment:paymentId,p_now:Date.now()});if(claimError)throw claimError;if(claimed!=='claimed')return;
const {data:job,error:loadError}=await db().from('slowrun_refund_jobs').select('payout_address,slowrun_orders(base_amount)').eq('payment',paymentId).single<{payout_address:string|null;slowrun_orders:{base_amount:number|null}|null}>();if(loadError)throw loadError;
const units=job.slowrun_orders?.base_amount;
let hash:string;try{if(!job.payout_address||!units)throw new Error('Missing Base refund details');hash=await sendBaseRefund(job.payout_address,BigInt(units));}
catch(e){await db().rpc('slowrun_fail_base_refund',{p_payment:paymentId});throw e;}
const {error:recordError}=await db().rpc('slowrun_record_base_refund',{p_payment:paymentId,p_reference:hash});if(recordError)throw recordError;
await confirmBaseRefund(paymentId,hash);}

async function confirmBaseRefund(paymentId:string,hash:string){const status=await baseTransactionStatus(hash);
if(status==='succeeded'){const {error}=await db().rpc('slowrun_complete_payout',{p_payment:paymentId,p_reference:hash,p_now:Date.now()});if(error)throw error;}
else if(status==='failed'){const {error}=await db().rpc('slowrun_fail_base_refund',{p_payment:paymentId});if(error)throw error;}}

/** Finishes Base refunds already broadcast (confirm receipts) and sends queued ones once automatic refunds are enabled. */
async function progressBaseRefunds(){const {data:sent,error:sentError}=await db().from('slowrun_refund_jobs').select('payment,payout_reference').eq('status','broadcasting').not('payout_reference','is',null).limit(20);if(sentError)throw sentError;
for(const job of sent??[])await confirmBaseRefund(job.payment,job.payout_reference as string);
if(!baseSettings().autoRefunds)return;const {data:queued,error:queuedError}=await db().from('slowrun_refund_jobs').select('payment').eq('status','awaiting_payout').eq('rail','base').limit(10);if(queuedError)throw queuedError;
for(const job of queued??[])await sendQueuedBaseRefund(job.payment);}

// One stuck refund must not block the rest of the queue; the first failure is reported after every job has been tried.
export async function drainRefunds(){const {data,error:loadError}=await db().from('slowrun_refund_jobs').select('payment').eq('status','pending').order('created').limit(10);if(loadError)throw loadError;let failure:unknown;for(const job of data??[]){try{await processRefund(job.payment);}catch(e){failure??=e;}}try{await progressBaseRefunds();}catch(e){failure??=e;}if(failure)throw failure;}

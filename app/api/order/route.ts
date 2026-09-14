import {authorized,db,error} from '@/lib/server';
import {settleBaseOrder} from '@/lib/base-orders';
import {explorerUrl,isStablecoinPayment,shortAddress} from '@/lib/wallet';
export const dynamic='force-dynamic';
type RefundRow={status:string;amount:number|null;fee:number|null;payout_network:string|null;payout_address:string|null;payout_reference:string|null};
export async function GET(req:Request){try{let order=await authorized(req);if(!order)return error('No sponsorship found for this browser.',401);
// A Base payment still confirming is re-checked on each poll, so the sponsor sees the result without waiting for the scheduled run.
if(order.pay_with==='base'&&order.status==='pending'&&order.base_payment_id){try{await settleBaseOrder(order.id);order=await authorized(req)??order;}catch{/* Try again on the next poll. */}}
let refund=null;if(order.payment){const {data,error:refundError}=await db().from('slowrun_refund_jobs').select('status,amount,fee,payout_network,payout_address,payout_reference').eq('payment',order.payment).maybeSingle<RefundRow>();if(refundError)throw refundError;if(data)refund={status:data.status,amount:data.amount,fee:data.fee,network:data.payout_network,address:data.payout_address&&shortAddress(data.payout_address),reference:data.payout_reference,referenceUrl:explorerUrl(data.payout_network,data.payout_reference)};}
return Response.json({status:order.status,brand:order.brand,slot:order.slot,logo:order.logo,payWith:order.pay_with,confirming:order.pay_with==='base'&&order.status==='pending'&&!!order.base_payment_id,stablecoin:order.pay_with==='stablecoin'||isStablecoinPayment({payment_method:order.payment_method}),refundWallet:order.refund_address?{network:order.refund_network,address:shortAddress(order.refund_address)}:null,refund},{headers:{'Cache-Control':'no-store'}});}catch{return error('Unable to check payment status.',503);}}

import {authorized,db,error,limited,readJson,sameOrigin} from '@/lib/server';
import {settleBaseOrder} from '@/lib/base-orders';
export const dynamic='force-dynamic';
// Called right after Base Pay succeeds in the browser: link the payment id to this browser's order, verify it onchain, award the spot.
// {cancel:true} releases the spot hold when the sponsor closes Base Pay without paying.
export async function POST(req:Request){if(!sameOrigin(req))return error('Invalid origin',403);try{if(await limited(req,'base-payment',20))return error('Please wait a moment before trying again.',429);const order=await authorized(req);if(!order||order.pay_with!=='base')return error('No Base checkout found for this browser.',401);const body=await readJson(req,1000) as {id?:unknown;cancel?:unknown};
if(body.cancel===true){if(order.status==='pending'&&!order.base_payment_id){const {error:releaseError}=await db().from('slowrun_slots').update({reserved_until:0}).eq('order_id',order.id);if(releaseError)throw releaseError;}return Response.json({status:'cancelled'});}
if(typeof body.id!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(body.id))return error('Invalid Base payment id.');
const {data:attached,error:attachError}=await db().rpc('slowrun_attach_base_payment',{p_order_id:order.id,p_payment_id:body.id});if(attachError)throw attachError;
if(attached==='taken'||attached==='conflict')return error('This payment is already linked to another checkout. Contact Bhavya if you were charged.',409);if(attached!=='attached'&&attached!=='same')return error('No Base checkout found for this browser.',401);
const status=await settleBaseOrder(order.id);
if(status==='retry')return error('That payment did not match this checkout or failed onchain. No spot was awarded; you can try paying again.',409);
return Response.json({status});}catch{return error('Payment received. We could not confirm it on Base yet; it will update shortly.',202);}}

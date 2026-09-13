import {authorized,db,error,limited,readJson,sameOrigin} from '@/lib/server';
import {processRefund} from '@/lib/refunds';
import {parseRefundWallet} from '@/lib/wallet';
export const dynamic='force-dynamic';
// A sponsor adds the wallet their stablecoin refund goes to. The browser's checkout token proves which order it is.
export async function POST(req:Request){if(!sameOrigin(req))return error('Invalid origin',403);try{if(await limited(req,'refund-wallet',5))return error('Please wait a minute before trying again.',429);const order=await authorized(req);if(!order)return error('No sponsorship found for this browser.',401);const body=await readJson(req,1000) as {network?:unknown;address?:unknown;confirmed?:unknown};const wallet=parseRefundWallet(body.network,body.address);if(!wallet||body.confirmed!==true)return error('Enter a valid wallet address for the selected network and confirm you control it.');
const {data:outcome,error:saveError}=await db().rpc('slowrun_set_refund_wallet',{p_order_id:order.id,p_network:wallet.network,p_address:wallet.address});if(saveError)throw saveError;if(outcome==='locked')return error('This refund is already on its way. Contact Bhavya to change the wallet.',409);if(outcome==='unknown')return error('No sponsorship found for this browser.',401);
if(outcome==='queued'&&order.payment){try{await processRefund(order.payment);}catch{/* The refund stays queued for the next scheduled run. */}}return Response.json({status:outcome});}catch{return error('Unable to save the refund wallet. Please try again.',503);}}

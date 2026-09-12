import {db,ready,settings} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(){try{const {data:slots,error:slotError}=await db().from('slowrun_slots').select('id,version,owner_id').not('owner_id','is',null);if(slotError)throw slotError;const owners=(slots??[]).map(s=>s.owner_id as string);
const {data:orders,error:orderError}=owners.length?await db().from('slowrun_orders').select('id,slot,brand,tagline,website,logo,amount').in('id',owners).eq('status','paid'):{data:[],error:null};if(orderError)throw orderError;
const sponsors=(orders??[]).map(o=>({slot:o.slot,brand:o.brand,tagline:o.tagline,website:o.website,logo:o.logo,amount:o.amount,version:slots!.find(s=>s.owner_id===o.id)!.version})).sort((a,b)=>a.slot-b.slot);
return Response.json({sponsors,paymentsEnabled:ready(),contact:settings().SPONSOR_CONTACT||null},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Sponsor details are temporarily unavailable.'},{status:503});}}

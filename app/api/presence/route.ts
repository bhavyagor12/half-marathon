import {db,error,readJson,sameOrigin,settings} from '@/lib/server';
import {ONLINE_WINDOW_MS,toStats,verifySession} from '@/lib/stats';
export const dynamic='force-dynamic';
// Heartbeat from a visible tab, or {leave:true} when it is hidden or closed. Requires the signed token from /api/visit.
export async function POST(req:Request){if(!sameOrigin(req))return error('Invalid origin',403);try{const body=await readJson(req,500) as {token?:unknown;leave?:unknown};const session=await verifySession(body.token,settings().SUPABASE_SERVICE_ROLE_KEY??'');if(!session)return error('Invalid session.',401);
const {data,error:beatError}=await db().rpc('slowrun_heartbeat',{p_session:session,p_now:Date.now(),p_window:ONLINE_WINDOW_MS,p_leave:body.leave===true});if(beatError)throw beatError;
return Response.json({stats:toStats(data)},{headers:{'Cache-Control':'no-store'}});}catch{return error('Stats are unavailable.',503);}}

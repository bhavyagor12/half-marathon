import {db,error,hash,limited,readJson,sameOrigin,settings} from '@/lib/server';
import {ONLINE_WINDOW_MS,isLikelyBot,signSession,toStats} from '@/lib/stats';
export const dynamic='force-dynamic';
// One page view per load from a real browser. Returns the totals and a signed session token for heartbeats.
// Bots and anyone over the per-IP limit get the totals without counting.
export async function POST(req:Request){if(!sameOrigin(req))return error('Invalid origin',403);try{const secret=settings().SUPABASE_SERVICE_ROLE_KEY;if(!secret)return error('Stats are unavailable.',503);const body=await readJson(req,500) as {visitor?:unknown};if(typeof body.visitor!=='string'||!/^[a-f0-9]{64}$/.test(body.visitor))return error('Invalid visitor.');const now=Date.now();
if(isLikelyBot(req.headers.get('user-agent'))||await limited(req,'visit',20)){const {data,error:statsError}=await db().rpc('slowrun_site_stats',{p_now:now,p_window:ONLINE_WINDOW_MS});if(statsError)throw statsError;return Response.json({stats:toStats(data),token:null},{headers:{'Cache-Control':'no-store'}});}
const session=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const {data,error:visitError}=await db().rpc('slowrun_record_visit',{p_visitor:await hash(`visitor:${body.visitor}`),p_session:session,p_now:now,p_window:ONLINE_WINDOW_MS});if(visitError)throw visitError;
return Response.json({stats:toStats(data),token:await signSession(session,secret)},{headers:{'Cache-Control':'no-store'}});}catch{return error('Stats are unavailable.',503);}}

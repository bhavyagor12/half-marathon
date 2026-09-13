import {db,error} from '@/lib/server';
import {ONLINE_WINDOW_MS,toStats} from '@/lib/stats';
export const dynamic='force-dynamic';
// Read-only totals for views that must not count (local development, capture renders, automated browsers).
export async function GET(){try{const {data,error:statsError}=await db().rpc('slowrun_site_stats',{p_now:Date.now(),p_window:ONLINE_WINDOW_MS});if(statsError)throw statsError;return Response.json({stats:toStats(data)},{headers:{'Cache-Control':'public, s-maxage=15, stale-while-revalidate=30'}});}catch{return error('Stats are unavailable.',503);}}

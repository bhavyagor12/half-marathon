import DodoPayments from 'dodopayments';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
export const settings=()=>process.env as Record<string,string>;
let supabase:SupabaseClient|null=null;
/** Server-only Supabase client. The service role key bypasses row-level security, so never import this from client components. */
export function db(){const e=settings();if(!e.NEXT_PUBLIC_SUPABASE_URL||!e.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Supabase is not configured');supabase??=createClient(e.NEXT_PUBLIC_SUPABASE_URL,e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});return supabase;}
export function ready(){const e=settings();return e.PAYMENTS_ENABLED==='true' && !!(e.DODO_PAYMENTS_API_KEY&&e.DODO_PAYMENTS_PRODUCT_ID&&e.DODO_PAYMENTS_WEBHOOK_KEY&&e.SITE_URL&&e.SPONSOR_CONTACT&&e.NEXT_PUBLIC_SUPABASE_URL&&e.SUPABASE_SERVICE_ROLE_KEY);}
export function dodo(){const e=settings();return new DodoPayments({bearerToken:e.DODO_PAYMENTS_API_KEY,webhookKey:e.DODO_PAYMENTS_WEBHOOK_KEY,environment:e.DODO_PAYMENTS_ENVIRONMENT==='live_mode'?'live_mode':'test_mode'});}
export async function hash(value:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');}
export function error(message:string,status=400){return Response.json({error:message},{status});}
export function sameOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
export async function limited(req:Request,scope:string,max=8){const ip=req.headers.get('x-real-ip')??req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'local';const now=Date.now();const key=await hash(`${scope}:${ip}:${Math.floor(now/60000)}`);const {data,error:failure}=await db().rpc('slowrun_hit_rate_limit',{p_key:key,p_now:now});if(failure)throw failure;return (typeof data==='number'?data:max+1)>max;}
export async function readJson(req:Request,max=6000){const raw=await readBody(req,max);return JSON.parse(new TextDecoder().decode(raw));}
export async function readBody(req:Request,max:number){const reader=req.body?.getReader();if(!reader)throw new Error('Empty body');const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('Too large');}chunks.push(value);}const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;}
export async function authorized(req:Request){const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!token||!/^[a-f0-9]{64}$/.test(token))return null;const {data,error:failure}=await db().from('slowrun_orders').select('*').eq('token_hash',await hash(token)).maybeSingle<Order>();if(failure)throw failure;return data;}
export type Order={id:string;slot:number;amount:number;status:string;session:string|null;payment:string|null;brand:string;tagline:string;website:string;logo:string|null;checkout_url:string|null;expires:number;expected_version:number;previous_id:string|null};

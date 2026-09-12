import {env} from 'cloudflare:workers';
import DodoPayments from 'dodopayments';
export const db=()=>env.DB;
export const settings=()=>env as unknown as Record<string,string>;
export function ready(){const e=settings();return e.PAYMENTS_ENABLED==='true' && !!(e.DODO_PAYMENTS_API_KEY&&e.DODO_PAYMENTS_PRODUCT_ID&&e.DODO_PAYMENTS_WEBHOOK_KEY&&e.SITE_URL&&e.SPONSOR_CONTACT);}
export function dodo(){const e=settings();return new DodoPayments({bearerToken:e.DODO_PAYMENTS_API_KEY,webhookKey:e.DODO_PAYMENTS_WEBHOOK_KEY,environment:e.DODO_PAYMENTS_ENVIRONMENT==='live_mode'?'live_mode':'test_mode'});}
export async function hash(value:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');}
export function error(message:string,status=400){return Response.json({error:message},{status});}
export function sameOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
export async function limited(req:Request,scope:string,max=8){const now=Date.now();const key=await hash(`${scope}:${req.headers.get('cf-connecting-ip')??'local'}:${Math.floor(now/60000)}`);const result=await db().prepare('INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+120000).first<{count:number}>();await db().prepare('DELETE FROM rate_limits WHERE expires < ?').bind(now).run();return (result?.count??max+1)>max;}
export async function readJson(req:Request,max=6000){const raw=await readBody(req,max);return JSON.parse(new TextDecoder().decode(raw));}
export async function readBody(req:Request,max:number){const reader=req.body?.getReader();if(!reader)throw new Error('Empty body');const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('Too large');}chunks.push(value);}const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;}
export async function authorized(req:Request){const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return db().prepare('SELECT * FROM orders WHERE token_hash=?').bind(await hash(token)).first<Order>();}
export type Order={id:string;slot:number;amount:number;status:string;session:string;payment:string;brand:string;tagline:string;website:string;logo:string;checkout_url:string;expires:number;expected_version:number;previous_id:string|null};

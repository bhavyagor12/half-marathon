import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';

// Run the real Supabase migration in an in-memory Postgres and exercise its auction functions directly.
const migration=readFileSync(new URL('../supabase/migrations/20260912000000_slowrun_auction.sql',import.meta.url),'utf8');
// Supabase provides these roles and the storage schema; recreate the minimum so the migration runs unchanged.
const SUPABASE_STUBS='create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);';
async function setup(){const db=new PGlite();await db.exec(SUPABASE_STUBS);await db.exec(migration);return db;}
const call=async(db,fn,args)=>(await db.query(`select public.${fn}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args)).rows[0].result;
const reserve=(db,id,version,{slot=0,amount=1000,now=1,expires=1000}={})=>call(db,'slowrun_reserve_slot',[id,slot,version,amount,'Brand','Tagline','https://example.com',id,now,expires]);
const award=(db,id,payment,{now=2,close=10000}={})=>call(db,'slowrun_award_payment',[id,payment,now,close]);
const row=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0];

test('first paid bid owns a spot; a replayed webhook changes nothing',async()=>{const db=await setup();assert.equal(await reserve(db,'a',0),'reserved');assert.equal(await award(db,'a','pay_a'),'paid');assert.equal(await award(db,'a','pay_a'),'replay');const slot=await row(db,'select owner_id,version,reserved_until from slowrun_slots where id=0');assert.deepEqual([slot.owner_id,slot.version,Number(slot.reserved_until)],['a',1,0]);assert.equal((await row(db,"select status from slowrun_orders where id='a'")).status,'paid');assert.equal((await row(db,'select count(*)::int n from slowrun_refund_jobs')).n,0);});

test('takeover changes owner atomically and queues exactly one outbid refund',async()=>{const db=await setup();await reserve(db,'a',0);await award(db,'a','pay_a');assert.equal(await reserve(db,'b',1,{amount:2000,now:3}),'reserved');assert.equal(await award(db,'b','pay_b',{now:4}),'paid');assert.equal(await award(db,'b','pay_b',{now:5}),'replay');assert.equal((await row(db,'select owner_id from slowrun_slots where id=0')).owner_id,'b');assert.equal((await row(db,"select status from slowrun_orders where id='a'")).status,'outbid');assert.equal((await row(db,"select previous_id from slowrun_orders where id='b'")).previous_id,'a');const jobs=(await db.query('select payment,mode,status from slowrun_refund_jobs')).rows;assert.deepEqual(jobs,[{payment:'pay_a',mode:'outbid',status:'pending'}]);});

test('reservations lock a version: a live hold is busy, an old version is stale',async()=>{const db=await setup();assert.equal(await reserve(db,'a',0,{now:1,expires:100}),'reserved');assert.equal(await reserve(db,'b',0,{now:2}),'busy');assert.equal(await reserve(db,'c',1,{now:2}),'stale');});

test('an expired checkout cannot take a spot another buyer reserved; it is refunded in full',async()=>{const db=await setup();await reserve(db,'a',0,{now:1,expires:5});assert.equal(await reserve(db,'b',0,{now:6,expires:100}),'reserved');assert.equal(await award(db,'a','pay_a',{now:7}),'unfulfilled');assert.equal((await row(db,'select owner_id from slowrun_slots where id=0')).owner_id,null);assert.equal((await row(db,"select status from slowrun_orders where id='a'")).status,'unfulfilled');assert.deepEqual((await db.query('select payment,mode from slowrun_refund_jobs')).rows,[{payment:'pay_a',mode:'unfulfilled'}]);assert.equal(await award(db,'b','pay_b',{now:8}),'paid');});

test('a stale version or a payment after bidding closes cannot win',async()=>{const late=await setup();await reserve(late,'a',0);assert.equal(await award(late,'a','pay_a',{now:10001,close:10000}),'unfulfilled');assert.equal((await row(late,'select owner_id from slowrun_slots where id=0')).owner_id,null);
const stale=await setup();await reserve(stale,'a',0,{now:1,expires:5});await reserve(stale,'b',0,{now:6,expires:100});await award(stale,'b','pay_b',{now:7});assert.equal(await award(stale,'a','pay_a',{now:8}),'unfulfilled');assert.equal((await row(stale,'select owner_id,version from slowrun_slots where id=0')).owner_id,'b');});

test('a second payment for a settled order is queued for a full refund and a payment id is unique',async()=>{const db=await setup();await reserve(db,'a',0);await award(db,'a','pay_a');assert.equal(await award(db,'a','pay_again'),'duplicate');assert.deepEqual((await db.query("select payment,mode from slowrun_refund_jobs where payment='pay_again'")).rows,[{payment:'pay_again',mode:'unfulfilled'}]);await reserve(db,'b',0,{slot:1});await assert.rejects(db.query("update slowrun_orders set payment='pay_a' where id='b'"));assert.equal(await award(db,'missing','pay_x'),'unknown');});

test('rate limit counts requests in a window and expires old keys',async()=>{const db=await setup();assert.equal(await call(db,'slowrun_hit_rate_limit',['k',1000]),1);assert.equal(await call(db,'slowrun_hit_rate_limit',['k',1001]),2);assert.equal(await call(db,'slowrun_hit_rate_limit',['k',200000]),1);});

test('the public anon role cannot read or write auction tables',async()=>{const db=await setup();await db.exec('set role anon');await assert.rejects(db.query('select * from slowrun_orders'));await assert.rejects(db.query('update slowrun_slots set owner_id=null'));await assert.rejects(db.query("select public.slowrun_award_payment('a','p',1,2)"));});

async function sourceModule(path){const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
const {nextPrice}=await sourceModule('../lib/config.ts');
const {refundAfterFees}=await sourceModule('../lib/refund-math.ts');
test('regular spots open at $10, butt at $20, and both double',()=>{for(let n=0;n<8;n++)assert.equal(nextPrice(n),1000);assert.equal(nextPrice(8),2000);assert.equal(nextPrice(0,1000),2000);assert.equal(nextPrice(8,2000),4000);assert.equal(nextPrice(8,4000),8000);});
test('refund uses actual USD fees, includes original tax in refund base, and nets fee credits',()=>{assert.deepEqual(refundAfterFees(1180,'pay_a',[{amount:85,is_credit:false,currency:'USD',reference_object_id:'pay_a'},{amount:10,is_credit:true,currency:'USD',reference_object_id:'pay_a'}]),{amount:1105,fee:75});});
test('missing, mismatched, and impossible fees cannot produce a guessed refund',()=>{assert.throws(()=>refundAfterFees(1000,'pay_a',[]));for(const extra of [{currency:'INR'},{reference_object_id:'pay_other'},{amount:1001},{amount:5,is_credit:true}])assert.throws(()=>refundAfterFees(1000,'pay_a',[{amount:85,is_credit:false,currency:'USD',reference_object_id:'pay_a',...extra}]));});

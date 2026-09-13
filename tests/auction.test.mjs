import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';

// Run the real Supabase migration in an in-memory Postgres and exercise its auction functions directly.
const migration=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort().map(name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).join('\n');
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
test('regular spots open at $50, the butt at $100, and takeovers double paid amounts',()=>{
  assert.deepEqual(Array.from({length:10},(_,n)=>nextPrice(n)),[5000,5000,5000,5000,5000,5000,5000,5000,10000,5000]);
  assert.equal(nextPrice(3,5000),10000);
  assert.equal(nextPrice(8,10000),20000);
  assert.equal(nextPrice(8,20000),40000);
  // Existing paid ownership keeps its established doubling rule.
  assert.equal(nextPrice(3,500),1000);
});
test('refund uses actual USD fees, includes original tax in refund base, and nets fee credits',()=>{assert.deepEqual(refundAfterFees(1180,'pay_a',[{amount:85,is_credit:false,currency:'USD',reference_object_id:'pay_a'},{amount:10,is_credit:true,currency:'USD',reference_object_id:'pay_a'}]),{amount:1105,fee:75});});
test('missing, mismatched, and impossible fees cannot produce a guessed refund',()=>{assert.throws(()=>refundAfterFees(1000,'pay_a',[]));for(const extra of [{currency:'INR'},{reference_object_id:'pay_other'},{amount:1001},{amount:5,is_credit:true}])assert.throws(()=>refundAfterFees(1000,'pay_a',[{amount:85,is_credit:false,currency:'USD',reference_object_id:'pay_a',...extra}]));});

test('the other quad is reservable without renumbering existing spots',async()=>{const db=await setup();assert.equal((await row(db,'select count(*)::int n from slowrun_slots')).n,10);assert.equal(await reserve(db,'quad',0,{slot:9,amount:nextPrice(9)}),'reserved');assert.equal(await award(db,'quad','pay_quad'),'paid');assert.equal((await row(db,'select owner_id from slowrun_slots where id=9')).owner_id,'quad');assert.equal((await row(db,'select owner_id from slowrun_slots where id=8')).owner_id,null);await db.close();});

const BASE_WALLET='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',SOLANA_WALLET='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',TX='0x'+'ab'.repeat(32);
const reserveWith=(db,id,version,{slot=0,amount=5000,now=1,expires=1000,payWith='card',network=null,address=null}={})=>call(db,'slowrun_reserve_slot',[id,slot,version,amount,'Brand','Tagline','https://example.com',id,now,expires,payWith,network,address]);

test('a stablecoin bid stores its refund wallet; stablecoin bids without a valid wallet are rejected and release nothing',async()=>{const db=await setup();assert.equal(await reserveWith(db,'a',0,{payWith:'stablecoin',network:'base',address:BASE_WALLET}),'reserved');assert.deepEqual(await row(db,"select pay_with,refund_network,refund_address from slowrun_orders where id='a'"),{pay_with:'stablecoin',refund_network:'base',refund_address:BASE_WALLET});
await assert.rejects(reserveWith(db,'b',0,{slot:1,payWith:'stablecoin'}));await assert.rejects(reserveWith(db,'c',0,{slot:2,payWith:'stablecoin',network:'solana',address:BASE_WALLET}));await assert.rejects(reserveWith(db,'d',0,{slot:3,network:'base',address:'0x123'}));
assert.equal(Number((await row(db,'select reserved_until from slowrun_slots where id=1')).reserved_until),0);assert.equal((await row(db,"select count(*)::int n from slowrun_orders where id in ('b','c','d')")).n,0);await db.close();});

test('a stablecoin refund waits for a wallet, then for an operator payout; the wallet locks once a payout is queued',async()=>{const db=await setup();await reserveWith(db,'a',0);await award(db,'a','pay_a');await reserveWith(db,'b',1,{amount:10000,now:3});await award(db,'b','pay_b',{now:4});
assert.equal(await call(db,'slowrun_route_stablecoin_refund',['pay_a']),'skipped');await db.query("update slowrun_refund_jobs set amount=4800,fee=200 where payment='pay_a'");
assert.equal(await call(db,'slowrun_route_stablecoin_refund',['pay_a']),'awaiting_wallet');assert.deepEqual(await row(db,"select status,rail from slowrun_refund_jobs where payment='pay_a'"),{status:'awaiting_wallet',rail:'stablecoin'});
assert.equal(await call(db,'slowrun_set_refund_wallet',['a','solana',SOLANA_WALLET]),'queued');assert.equal((await row(db,"select status from slowrun_refund_jobs where payment='pay_a'")).status,'pending');
assert.equal(await call(db,'slowrun_route_stablecoin_refund',['pay_a']),'awaiting_payout');assert.deepEqual(await row(db,"select status,payout_network,payout_address from slowrun_refund_jobs where payment='pay_a'"),{status:'awaiting_payout',payout_network:'solana',payout_address:SOLANA_WALLET});
assert.equal(await call(db,'slowrun_set_refund_wallet',['a','base',BASE_WALLET]),'locked');assert.equal((await row(db,"select refund_address from slowrun_orders where id='a'")).refund_address,SOLANA_WALLET);
assert.equal(await call(db,'slowrun_complete_payout',['pay_b',TX,9]),'not_awaiting');assert.equal(await call(db,'slowrun_complete_payout',['pay_a',TX,9]),'succeeded');assert.equal(await call(db,'slowrun_complete_payout',['pay_a',TX,10]),'already');
const paid=await row(db,"select status,payout_reference,completed from slowrun_refund_jobs where payment='pay_a'");assert.deepEqual([paid.status,paid.payout_reference,Number(paid.completed)],['succeeded',TX,9]);
assert.equal(await call(db,'slowrun_set_refund_wallet',['b','base',BASE_WALLET]),'saved');assert.equal(await call(db,'slowrun_set_refund_wallet',['missing','base',BASE_WALLET]),'unknown');await db.close();});

test('the public anon role cannot change refund wallets, route refunds, or record payouts',async()=>{const db=await setup();await db.exec('set role anon');await assert.rejects(db.query(`select public.slowrun_set_refund_wallet('a','base','${BASE_WALLET}')`));await assert.rejects(db.query("select public.slowrun_route_stablecoin_refund('pay_a')"));await assert.rejects(db.query(`select public.slowrun_complete_payout('pay_a','${TX}',1)`));await db.close();});

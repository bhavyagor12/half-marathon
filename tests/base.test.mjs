import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';

const migration=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort().map(name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).join('\n');
const SUPABASE_STUBS='create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);';
async function setup(){const db=new PGlite();await db.exec(SUPABASE_STUBS);await db.exec(migration);return db;}
const call=async(db,fn,args)=>(await db.query(`select public.${fn}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args)).rows[0].result;
const row=async(db,sql,args=[])=>(await db.query(sql,args)).rows[0];
const reserveBase=(db,id,version,{slot=0,amount=25000,now=1,expires=100000,units=250004321}={})=>call(db,'slowrun_reserve_slot',[id,slot,version,amount,'Brand','Tagline','https://example.com',id,now,expires,'base',null,null]).then(async result=>{if(result==='reserved')await db.query('update slowrun_orders set base_amount=$1 where id=$2',[units,id]);return result;});
const PAYER='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',PAY_A='0x'+'aa'.repeat(32),PAY_B='0x'+'bb'.repeat(32),TX='0x'+'cd'.repeat(32);

test('a Base Pay payment id links to exactly one order, and a failed payment can be detached and retried',async()=>{const db=await setup();
  assert.equal(await reserveBase(db,'a',0),'reserved');
  assert.equal(await call(db,'slowrun_attach_base_payment',['a',PAY_A]),'attached');
  assert.equal(await call(db,'slowrun_attach_base_payment',['a',PAY_A]),'same');
  assert.equal(await call(db,'slowrun_attach_base_payment',['a',PAY_B]),'conflict');
  assert.equal(await reserveBase(db,'b',0,{slot:1,units:150000777}),'reserved');
  assert.equal(await call(db,'slowrun_attach_base_payment',['b',PAY_A]),'taken');
  assert.equal(await call(db,'slowrun_detach_base_payment',['a',PAY_A]),'detached');
  assert.equal(await call(db,'slowrun_attach_base_payment',['b',PAY_A]),'attached');
  await db.query("insert into slowrun_slots (id) values (1) on conflict do nothing");
  assert.equal(await call(db,'slowrun_attach_base_payment',['missing',PAY_B]),'unknown');
  await db.close();
});

test('two pending Base orders cannot share an exact USDC amount',async()=>{const db=await setup();
  assert.equal(await reserveBase(db,'a',0,{units:250004321}),'reserved');
  await assert.rejects(reserveBase(db,'b',0,{slot:1,units:250004321}));
  await db.close();
});

test('a verified Base payment wins the spot, records the payer for refunds, and a takeover queues the refund to that wallet',async()=>{const db=await setup();
  await reserveBase(db,'a',0);await call(db,'slowrun_attach_base_payment',['a',PAY_A]);
  assert.equal(await call(db,'slowrun_award_base_payment',['a',PAY_B,PAYER,2,10000]),'mismatch');
  assert.equal(await call(db,'slowrun_award_base_payment',['a',PAY_A,PAYER,2,10000]),'paid');
  assert.deepEqual(await row(db,"select status,payment,base_payer,refund_network,refund_address from slowrun_orders where id='a'"),{status:'paid',payment:`base:${PAY_A}`,base_payer:PAYER,refund_network:'base',refund_address:PAYER});
  assert.equal(await call(db,'slowrun_award_base_payment',['a',PAY_A,PAYER,3,10000]),'replay');
  // A card sponsor takes the spot over; the Base sponsor's refund is queued.
  await call(db,'slowrun_reserve_slot',['b',0,1,50000,'Brand','Tagline','https://example.com','b',4,100000,'card',null,null]);
  assert.equal(await call(db,'slowrun_award_payment',['b','pay_card',5,10000]),'paid');
  const payment=`base:${PAY_A}`;
  assert.equal((await row(db,'select status from slowrun_refund_jobs where payment=$1',[payment])).status,'pending');
  await db.query("update slowrun_refund_jobs set amount=25000,fee=0,rail='base' where payment=$1",[payment]);
  assert.equal(await call(db,'slowrun_route_stablecoin_refund',[payment]),'awaiting_payout');
  assert.deepEqual(await row(db,'select status,rail,payout_network,payout_address from slowrun_refund_jobs where payment=$1',[payment]),{status:'awaiting_payout',rail:'base',payout_network:'base',payout_address:PAYER});
  await db.close();
});

test('an automatic Base refund is claimed once, records its transaction, and completes or fails for review',async()=>{const db=await setup();
  await reserveBase(db,'a',0);await call(db,'slowrun_attach_base_payment',['a',PAY_A]);await call(db,'slowrun_award_base_payment',['a',PAY_A,PAYER,2,10000]);
  await call(db,'slowrun_reserve_slot',['b',0,1,50000,'Brand','Tagline','https://example.com','b',4,100000,'card',null,null]);await call(db,'slowrun_award_payment',['b','pay_card',5,10000]);
  const payment=`base:${PAY_A}`;await db.query("update slowrun_refund_jobs set amount=25000,fee=0,rail='base' where payment=$1",[payment]);await call(db,'slowrun_route_stablecoin_refund',[payment]);
  assert.equal(await call(db,'slowrun_claim_base_refund',[payment,6]),'claimed');
  assert.equal(await call(db,'slowrun_claim_base_refund',[payment,7]),'skipped');
  assert.equal(await call(db,'slowrun_record_base_refund',[payment,TX]),'recorded');
  assert.equal(await call(db,'slowrun_record_base_refund',[payment,'0x'+'ee'.repeat(32)]),'skipped');
  assert.equal(await call(db,'slowrun_complete_payout',[payment,TX,8]),'succeeded');
  assert.equal(await call(db,'slowrun_fail_base_refund',[payment]),'skipped');
  assert.equal((await row(db,'select status,payout_reference from slowrun_refund_jobs where payment=$1',[payment])).payout_reference,TX);
  // A card refund job can never be claimed for a Base send.
  await db.query("insert into slowrun_refund_jobs (payment,order_id,mode,status,amount,fee,rail,payout_address,created) values ('pay_x','b','outbid','awaiting_payout',100,0,'stablecoin',$1,9)",[PAYER]);
  assert.equal(await call(db,'slowrun_claim_base_refund',['pay_x',10]),'skipped');
  await db.close();
});

test('the public anon role cannot link, award or refund Base payments',async()=>{const db=await setup();await db.exec('set role anon');
  await assert.rejects(db.query(`select public.slowrun_attach_base_payment('a','${PAY_A}')`));
  await assert.rejects(db.query(`select public.slowrun_award_base_payment('a','${PAY_A}','${PAYER}',1,2)`));
  await assert.rejects(db.query("select public.slowrun_claim_base_refund('base:x',1)"));
  await db.close();
});

async function sourceModule(path){const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
const {usdcUnits,formatUsdc,randomTag}=await sourceModule('../lib/usdc.ts');

test('Base amounts are the price in USDC plus a sub-cent tag, formatted to six decimals',()=>{
  assert.equal(usdcUnits(25000,4321),250004321n);
  assert.equal(formatUsdc(250004321n),'250.004321');
  assert.equal(formatUsdc(usdcUnits(12000,1)),'120.000001');
  assert.equal(formatUsdc(usdcUnits(50000,9999)),'500.009999');
  for(const bad of [[0,1],[25000,0],[25000,10000],[1.5,1]])assert.throws(()=>usdcUnits(...bad));
  for(let i=0;i<200;i++){const tag=randomTag();assert.ok(tag>=1&&tag<=9999);}
});

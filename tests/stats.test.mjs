import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';

// Run every Supabase migration in an in-memory Postgres, as tests/auction.test.mjs does.
const migration=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort().map(name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).join('\n');
const SUPABASE_STUBS='create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);';
async function setup(){const db=new PGlite();await db.exec(SUPABASE_STUBS);await db.exec(migration);return db;}
const call=async(db,fn,args)=>(await db.query(`select public.${fn}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args)).rows[0].result;
const WINDOW=75000;

test('a first visit counts a view and a visitor, a return visit only a view, and online counts recent sessions',async()=>{const db=await setup();
  assert.deepEqual(await call(db,'slowrun_record_visit',['v1','s1',1000,WINDOW]),{views:1,visitors:1,online:1});
  assert.deepEqual(await call(db,'slowrun_record_visit',['v1','s2',2000,WINDOW]),{views:2,visitors:1,online:2});
  assert.deepEqual(await call(db,'slowrun_record_visit',['v2','s3',3000,WINDOW]),{views:3,visitors:2,online:3});
  // At 80s only s1 has sent a heartbeat inside the 75s window.
  assert.deepEqual(await call(db,'slowrun_heartbeat',['s1',80000,WINDOW,false]),{views:3,visitors:2,online:1});
  assert.deepEqual(await call(db,'slowrun_site_stats',[80000,WINDOW]),{views:3,visitors:2,online:1});
  assert.equal((await call(db,'slowrun_heartbeat',['s1',81000,WINDOW,true])).online,0);
  // Sessions silent for two windows are pruned.
  await call(db,'slowrun_heartbeat',['s4',400000,WINDOW,false]);
  assert.equal((await db.query('select count(*)::int n from slowrun_presence')).rows[0].n,1);
  await db.close();
});

test('the public anon role cannot read stats tables or count visits',async()=>{const db=await setup();await db.exec('set role anon');
  await assert.rejects(db.query('select * from slowrun_stats'));
  await assert.rejects(db.query("select public.slowrun_record_visit('v','s',1,75000)"));
  await assert.rejects(db.query("select public.slowrun_heartbeat('s',1,75000,false)"));
  await db.close();
});

async function sourceModule(path){const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
const {signSession,verifySession,isLikelyBot,toStats,formatCount}=await sourceModule('../lib/stats.ts');
const SESSION='ab'.repeat(32);

test('only server-signed session tokens are accepted for heartbeats',async()=>{
  const token=await signSession(SESSION,'secret');
  assert.equal(await verifySession(token,'secret'),SESSION);
  assert.equal(await verifySession(token,'other-secret'),null);
  assert.equal(await verifySession(`${'cd'.repeat(32)}${token.slice(64)}`,'secret'),null);
  assert.equal(await verifySession(`${token.slice(0,-1)}${token.endsWith('0')?'1':'0'}`,'secret'),null);
  for(const bad of [undefined,42,'',SESSION,`${SESSION}.`,`${SESSION}.xyz`])assert.equal(await verifySession(bad,'secret'),null);
  assert.equal(await verifySession(token,''),null);
});

test('crawlers do not count; totals are parsed and formatted for the page',()=>{
  for(const ua of [null,'','Twitterbot/1.0','facebookexternalhit/1.1','Slackbot-LinkExpanding 1.0','WhatsApp/2.23','curl/8.4.0','Mozilla/5.0 HeadlessChrome/126.0'])assert.equal(isLikelyBot(ua),true,String(ua));
  assert.equal(isLikelyBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'),false);
  assert.deepEqual(toStats({views:'12',visitors:5,online:1}),{views:12,visitors:5,online:1});
  assert.equal(toStats({views:1,visitors:'x',online:0}),null);
  assert.equal(toStats(null),null);
  assert.equal(formatCount(9876),'9,876');
  assert.equal(formatCount(12345),'12.3K');
});

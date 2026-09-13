'use client';
import {useEffect,useState} from 'react';
import {HEARTBEAT_MS,formatCount,type SiteStats} from '@/lib/stats';
const VISITOR_KEY='slowrun-visitor';
const randomHex=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
function visitorId(){try{let id=localStorage.getItem(VISITOR_KEY);if(!id||!/^[a-f0-9]{64}$/.test(id)){id=randomHex();localStorage.setItem(VISITOR_KEY,id);}return id;}catch{return randomHex();}}
// Local development, capture renders and automated browsers read the numbers without adding to them.
const readOnly=()=>['localhost','127.0.0.1'].includes(location.hostname)||new URLSearchParams(location.search).has('capture')||navigator.webdriver;
async function post(url:string,body:unknown){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error('Stats unavailable');return await r.json() as {stats:SiteStats|null;token?:string|null};}
/** Views, unique visitors and people online now. Decorative: the page works the same if stats are unavailable. */
export default function VisitorStats(){const [stats,setStats]=useState<SiteStats|null>(null);
useEffect(()=>{let token:string|null=null,timer:number|undefined,stopped=false;
const show=(next:SiteStats|null|undefined)=>{if(!stopped&&next)setStats(next);};
const beat=async()=>{try{if(token)show((await post('/api/presence',{token})).stats);else{const r=await fetch('/api/stats');if(r.ok)show((await r.json() as {stats:SiteStats|null}).stats);}}catch{/* The next beat retries. */}};
const schedule=()=>{window.clearInterval(timer);timer=document.hidden?undefined:window.setInterval(()=>void beat(),HEARTBEAT_MS);};
// A hidden or closed tab is not "online"; sendBeacon survives the page unloading.
const leave=()=>{if(token)navigator.sendBeacon('/api/presence',JSON.stringify({token,leave:true}));};
const visibility=()=>{schedule();if(document.hidden)leave();else void beat();};
const start=async()=>{try{if(readOnly())await beat();else{const data=await post('/api/visit',{visitor:visitorId()});token=data.token??null;show(data.stats);}}catch{/* Stats stay hidden. */}schedule();};
void start();document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);
return()=>{stopped=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);};},[]);
if(!stats)return null;
return <div className="visitor-stats hud"><span>{formatCount(stats.views)} views</span><span className="stat-visitors">{formatCount(stats.visitors)} visitors</span><span className="stat-online"><i aria-hidden="true"/>{formatCount(stats.online)} online</span></div>;}

'use client';
import {useEffect,useState} from 'react';
import {CLOSE_DATE,CLOSE_LABEL,FUNDING_GOAL,SPOTS,type Sponsor} from '@/lib/config';
const usd=(cents:number)=>`$${Math.round(cents/100).toLocaleString('en-US')}`;
function timeLeft(ms:number){const t=Math.max(0,Math.floor(ms/1000));return `${Math.floor(t/86400)}d ${Math.floor(t%86400/3600)}h ${String(Math.floor(t%3600/60)).padStart(2,'0')}m ${String(t%60).padStart(2,'0')}s`;}
/** Raised so far (current sponsors' paid bids) against the goal, with the bidding deadline and open spots. */
export default function GoalProgress({sponsors,loaded,variant='hud'}:{sponsors:Sponsor[];loaded:boolean;variant?:'hud'|'panel'}){const [now,setNow]=useState<number|null>(null);
// The clock starts after mount so the server render and the first client render match.
useEffect(()=>{const tick=()=>setNow(Date.now());const first=setTimeout(tick,0);const timer=setInterval(tick,1000);return()=>{clearTimeout(first);clearInterval(timer);};},[]);
const raised=sponsors.reduce((sum,sponsor)=>sum+sponsor.amount,0),percent=Math.floor(raised/FUNDING_GOAL*100),fill=Math.min(100,raised/FUNDING_GOAL*100),open=SPOTS.length-sponsors.length;const ended=now!==null&&now>=Date.parse(CLOSE_DATE);
return <section className={`goal ${variant==='hud'?'goal-hud hud':'goal-panel'}`} aria-label="Sponsorship goal"><div className="goal-head"><strong>{loaded?usd(raised):'—'}</strong><span>raised of {usd(FUNDING_GOAL)}</span>{loaded&&<em>{percent}% achieved</em>}</div><div className="goal-bar" role="progressbar" aria-label="Raised toward the goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loaded?Math.round(fill):0}><span style={{width:`${loaded?fill:0}%`}}/></div><p>{ended?<span>Bidding ended</span>:<span>Bidding ends <b>{now===null?'—':timeLeft(Date.parse(CLOSE_DATE)-now)}</b></span>}<span className="goal-date"> · {CLOSE_LABEL}</span>{loaded&&<span className="goal-open"> · {open} of {SPOTS.length} spots open</span>}</p></section>;}

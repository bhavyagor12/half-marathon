'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import Arena from './Arena';
import KitDiagram from './KitDiagram';
import MusicToggle from './MusicToggle';
import SponsorForm from './SponsorForm';
import {RACE_DATE, SPOTS, nextPrice, type Sponsor} from '@/lib/config';

type Panel = 'spots' | 'detail' | 'story' | 'shoes' | 'rules';
const EMAIL = 'bhavya.gor9999@gmail.com';
const RACE_URL = 'https://timesofindia.indiatimes.com/times-events/marathon/bengaluru/2026';
const spotNumber = (n: number) => String(n + 1).padStart(2, '0');
function FullscreenIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>;
}
export default function Home() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]), [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(false), [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(-1), [panel, setPanel] = useState<Panel | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front'), [closeUp, setCloseUp] = useState(false);
  const [frameKey, setFrameKey] = useState(0), [capture, setCapture] = useState(false);
  const [showSpots, setShowSpots] = useState(true), [remaining, setRemaining] = useState<number[] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const reload = useCallback(() => {
    fetch('/api/sponsors').then(r => {if (!r.ok) throw new Error(); return r.json() as Promise<{sponsors: Sponsor[]; paymentsEnabled: boolean}>;})
      .then(data => {setSponsors(data.sponsors); setEnabled(data.paymentsEnabled); setError(false); setLoaded(true);})
      .catch(() => {setError(true); setEnabled(false);});
  }, []);
  useEffect(() => {
    reload(); const refresh = setInterval(reload, 60000);
    const tick = () => {
      const t = Math.max(0, Math.floor((Date.parse(RACE_DATE) - Date.now()) / 1000));
      setRemaining([Math.floor(t / 86400), Math.floor(t % 86400 / 3600), Math.floor(t % 3600 / 60), t % 60]);
    };
    const initial = setTimeout(() => {
      tick(); const params = new URLSearchParams(location.search);
      // ?capture hides the HUD so scripts/capture-scene.mjs can photograph the bare scene.
      setCapture(params.has('capture'));
      if (params.has('checkout')) {setSelected(0); setPanel('detail');}
    }, 0);
    const timer = setInterval(tick, 1000);
    return () => {clearInterval(refresh); clearInterval(timer); clearTimeout(initial);};
  }, [reload]);
  const open = (next: Panel) => {
    if (!panel) returnFocus.current = document.activeElement as HTMLElement;
    setPanel(next);
  };
  const close = () => {setPanel(null); returnFocus.current?.focus();};
  useEffect(() => {
    const node = dialog.current;
    if (!panel || !node) return;
    node.scrollTop = 0;
    node.querySelector<HTMLElement>('[data-panel-focus]')?.focus({preventScroll: true});
  }, [panel, selected]);
  useEffect(() => {
    if (!panel) return;
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {setPanel(null); returnFocus.current?.focus();}};
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [panel]);
  // Bumping frameKey makes the scene reframe even when the pressed option is already active.
  const reframe = (change: () => void) => {change(); setFrameKey(key => key + 1);};
  const choose = (n: number) => {setSelected(n); setView(n >= 5 ? 'back' : 'front'); setCloseUp(n !== 8); setShowSpots(true); setFrameKey(key => key + 1); open('detail');};
  const openCount = 9 - sponsors.length;
  const headings: Record<Panel, [string, string]> = {
    spots: ['9 spots on the race kit', 'Choose your spot.'],
    detail: [`Spot ${spotNumber(selected)} · ${selected >= 5 ? 'back' : 'front'} of the kit`, SPOTS[selected] ?? 'Choose your spot.'],
    story: ['How it works', 'Slow runner. Long exposure.'],
    shoes: ['Footwear partnership', 'Put your shoes on the start line.'],
    rules: ['Terms & privacy', 'The small print.'],
  };
  const [eyebrow, title] = panel ? headings[panel] : ['', ''];
  return <main className={`experience ${panel ? 'has-panel' : ''} ${capture ? 'capture' : ''}`}>
    <Arena sponsors={sponsors} selected={selected} onSelect={choose} onBrowse={() => open('spots')} view={view} onViewChange={setView} closeUp={closeUp} showSpots={showSpots} panelOpen={!!panel} frameKey={frameKey} capture={capture}/>
    <div className="vignette"/>
    <header className="identity hud">
      <button className="title" onClick={() => open('story')}>Sponsor my slow run</button>
      <p className="tagline">Slow runner. <em>Long exposure.</em></p>
      <div className="subline"><a href={RACE_URL} target="_blank" rel="noopener noreferrer">Bengaluru · 20 December ↗</a><button onClick={() => open('story')}>How it works</button></div>
    </header>
    <div className="countdown hud" aria-label={remaining ? `${remaining[0]} days until race day` : 'Race day is December 20, 2026'}>
      <span>Race day in</span><strong>{['d','h','m','s'].map((unit, i) => <span key={unit}>{remaining ? String(remaining[i]).padStart(2, '0') : '—'}<small>{unit}</small></span>)}</strong>
    </div>
    <div className="scene-controls hud" role="toolbar" aria-label="3D view controls">
      <div className="segmented" role="group" aria-label="Runner side"><button aria-pressed={view === 'front'} title="View the front of the race kit" onClick={() => reframe(() => setView('front'))}>Front</button><button aria-pressed={view === 'back'} title="View the back of the race kit" onClick={() => reframe(() => setView('back'))}>Back</button></div>
      <div className="segmented" role="group" aria-label="Camera distance"><button aria-pressed={!closeUp} title="Show the whole race kit" onClick={() => reframe(() => setCloseUp(false))}>Full kit</button><button aria-pressed={closeUp} title="See Bhavya and the tee up close" onClick={() => reframe(() => setCloseUp(true))}>Close-up</button></div>
      <button className="switch" role="switch" aria-checked={showSpots} title="Show or hide the numbered sponsorship spots" onClick={() => setShowSpots(!showSpots)}><span className="switch-track" aria-hidden="true"/>Spots</button>
      <MusicToggle/>
      <button className="control fullscreen" aria-label="Toggle full screen" title="Full screen" onClick={() => {if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.();}}><FullscreenIcon/></button>
    </div>
    <div className="main-action hud">
      <button className="primary" onClick={() => open('spots')}>{error ? 'Explore sponsorship spots' : !loaded ? 'View spots · from $10 USD' : openCount ? `View ${openCount} open spots · from $10 USD` : 'View sponsors · take over a spot'}<span aria-hidden="true">→</span></button>
      <small><span className="desktop-hint">Drag to rotate · Scroll to zoom</span><span className="touch-hint"><span className="rotate-hint">Drag to rotate · </span>Pinch to zoom</span><span className="mobile-shoes"> · <button className="hint-shoes" onClick={() => open('shoes')}>Sponsor my shoes →</button></span></small>
    </div>
    <button className="shoe-cta hud" onClick={() => open('shoes')}><small>Make running shoes?</small>Sponsor my shoes →</button>
    <a className="creator hud" href="https://x.com/bhavya_gor" target="_blank" rel="noopener noreferrer" aria-label="Bhavya Gor on X, opens in a new tab"><span className="creator-photo"><img src="/bhavya-x-avatar.jpg" alt="" width="44" height="44"/><span className="x-badge" aria-hidden="true">𝕏</span></span><span className="creator-handle">@bhavya_gor ↗</span></a>
    {panel && <dialog open ref={dialog} className={`panel ${panel === 'spots' || panel === 'detail' ? 'spots-panel' : ''} ${panel === 'detail' ? 'detail-panel' : ''}`} aria-labelledby="panel-title" aria-modal="false">
      <div className="panel-heading"><div><span className="eyebrow">{eyebrow}</span><h1 id="panel-title" tabIndex={-1} data-panel-focus>{title}</h1></div><button className="close" aria-label="Close panel" title="Close (Esc)" onClick={close}>×</button></div>
      <div className="panel-content">
        {panel === 'spots' && <>
          <p className="panel-intro">Your logo on my race kit. Tee spots from $10 USD; the premium butt spot from $20. Each takeover doubles the price.</p>
          {error && <p role="status">Live availability is unavailable. <button className="text-button" onClick={reload}>Try again</button></p>}
          <div className="spot-list">{SPOTS.map((name,n) => {
            const sponsor = sponsors.find(s => s.slot === n), price = nextPrice(n, sponsor?.amount) / 100;
            return <button key={name} className="spot" aria-label={`${name}, ${sponsor ? `held by ${sponsor.brand}, next takeover` : 'open'}, $${price} USD`} onClick={() => choose(n)}>
              <span className="spot-number">{spotNumber(n)}</span><span className="spot-name">{name}<small>{sponsor?.brand || (n === 8 ? 'Premium placement' : 'Open spot')}</small></span><b>${price}<small>USD</small></b><span className="row-arrow" aria-hidden="true">→</span>
            </button>;
          })}</div>
          <section className="shoe-partnership"><h2>Footwear partnerships</h2><p>Make running shoes? Send a pair and join the run.</p><button className="secondary" onClick={() => open('shoes')}>Sponsor my shoes →</button></section>
          <button className="text-button terms-link" onClick={() => open('rules')}>Sponsorship terms & privacy</button>
        </>}
        {panel === 'detail' && selected >= 0 && <>
          <button className="text-button back-link" onClick={() => open('spots')}>← All 9 spots</button>
          <KitDiagram selected={selected}/>
          <SponsorForm key={selected} selected={selected} sponsors={sponsors} enabled={enabled && !error} reload={reload}/>
          <button className="text-button terms-link" onClick={() => open('rules')}>Sponsorship terms & privacy</button>
        </>}
        {panel === 'shoes' && <>
          <p>Make running shoes? Send me a pair to train in and run the Bengaluru half marathon.</p><p>Let’s talk fit, training time, and race-day plans. A footwear partnership, arranged directly with me.</p>
          <a className="primary" href={`mailto:${EMAIL}?subject=Footwear%20partnership%20%E2%80%94%20Bengaluru%20half%20marathon&body=Hi%20Bhavya%2C%0A%0ABrand%3A%0AShoe%20model%3A%0AWebsite%3A%0AWhat%20we%20have%20in%20mind%3A%0A`}>Email me about shoes</a>
          <p className="fine">For footwear brands. We’ll agree on the pair and partnership before anything ships.</p>
        </>}
        {panel === 'story' && <>
          <p>I’m Bhavya. I run slow. On <b>December 20, 2026</b>, I’m running 21.1 km in Bengaluru—with your logo on my race kit.</p>
          <p>No six-pack. No elite pace. Just showing up. The slower I go, the longer your logo’s out there.</p>
          <ul className="benefits"><li>Your logo on my race tee or shorts.</li><li>Your brand and website on this page.</li><li>A mention in my race recap on X.</li></ul>
          <p>Your support goes toward running gear, nutrition, supplements, and recovery. I’ll share the purchases and progress along the way.</p>
          <button className="primary" onClick={() => open('spots')}>Find your spot · from $10 USD →</button>
          <a className="contact" href={`mailto:${EMAIL}`}>Email me</a><button className="text-button terms-link" onClick={() => open('rules')}>Sponsorship terms & privacy</button>
        </>}
        {panel === 'rules' && <div id="rules">
          <h2>The auction</h2><p>Eight tee spots start at $10 USD. The premium butt spot on the back of the shorts starts at $20 USD. Each takeover doubles that spot’s price. Any checkout taxes are shown before payment. The sponsor holding the spot when bidding closes gets the race-day placement.</p>
          <h2>Takeovers & refunds</h2><p>If another sponsor takes over your spot, your payment is refunded minus the actual payment-processing fees charged by Dodo Payments. Any additional refund-processing fees are covered by Bhavya. This is not a full-refund auction.</p>
          <p>Payment confirmation updates ownership. Overlapping payments that cannot be fulfilled are submitted for a full refund. If I can’t race or fulfil your placement, I’ll arrange a full refund.</p>
          <h2>Race-day placement</h2><p>Logos lock on December 10, 2026 (India time), for printing. Placement dimensions will be confirmed before printing. Contact me before printing for any other change or refund request. Upload only logos you have permission to use.</p>
          <h2>An independent project</h2><p>This is my personal sponsorship project, not an official race partnership. The start-line setting is illustrative. The organizer will announce the exact venue and route closer to race day. There are no guaranteed audience numbers, clicks, sales, or race times.</p>
          <a href={RACE_URL} target="_blank" rel="noopener noreferrer">Official race information ↗</a>
          <h2>Privacy</h2><p>Your brand and logo are public. Dodo Payments handles payment details; this site never stores your card details. Logo editing is available in your checkout browser tab. Email me for access recovery or data requests.</p><a href={`mailto:${EMAIL}`}>Email me</a>
        </div>}
      </div>
    </dialog>}
  </main>;
}

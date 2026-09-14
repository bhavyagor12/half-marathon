import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import './fonts';
import {BUTT_CLICK, FOOTAGE_CUTS, SPOTS_TRIM, STICKERS, type Cut} from './shots';
import {APP_BEAT, DURATION, FPS, beat} from './timeline';

export type LaunchProps = {
  footage: string | null;
  audio: string | null;
  audioStart: number;
  daysToRace: number;
  closeup: string | null;
  scene: string | null;
  app: Record<'landscape' | 'portrait', {orbit: string | null; spots: string | null}>;
};

const INK = '#27352e', PAPER = '#f7f2e8', ACCENT = '#a8371e', MUTED = '#505c52';
const SANS = "Geist, 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Geist Mono', Menlo, monospace";
const SERIF = "Baskerville, 'Hoefler Text', Georgia, serif";
const GRADE = 'grayscale(1) contrast(1.12) brightness(.95)';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const usePortrait = () => { const {width, height} = useVideoConfig(); return height > width; };
const useEase = (from: number, to: number, start: number, frames: number, easing = Easing.out(Easing.cubic)) =>
  interpolate(useCurrentFrame(), [start, start + frames], [from, to], {...clamp, easing});

/** A section that starts and ends on the beat grid. */
function Beats({from, beats, children}: {from: number; beats: number; children: ReactNode}) {
  return <Sequence from={beat(from)} durationInFrames={beat(from + beats) - beat(from)}>{children}</Sequence>;
}

function Flash({frames = 6}: {frames?: number}) {
  return <AbsoluteFill style={{background: '#fff', opacity: useEase(.85, 0, 0, frames)}}/>;
}

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
function Grain() {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{backgroundImage: NOISE, backgroundPosition: `${Math.floor(random(`x${f}`) * 256)}px ${Math.floor(random(`y${f}`) * 256)}px`, opacity: .12, mixBlendMode: 'overlay'}}/>;
}

function Placeholder({label, dark = false}: {label: string; dark?: boolean}) {
  return <AbsoluteFill style={{background: dark ? '#0b0b0b' : PAPER, alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 28, color: dark ? '#fff8' : '#27352e88'}}>MISSING · {label}</AbsoluteFill>;
}

/** A cut from the motivational footage. Portrait keeps the centre of the 16:9 frame (where the captions are) over a blurred fill. */
function FootageCut({src, cut, hideCaption = false, children}: {src: string | null; cut: Cut; hideCaption?: boolean; children?: ReactNode}) {
  const {width} = useVideoConfig();
  const portrait = usePortrait();
  const f = useCurrentFrame();
  const frames = beat(cut.beats);
  const drift = interpolate(f, [0, frames], [1.02, 1.08]);
  const punch = useEase(1.06, 1, 0, 7);
  if (!src) return <Placeholder dark label="footage/outwork.mp4"/>;
  const rate = Math.min(1.6, Math.max(.5, (cut.to - cut.from) / (frames / FPS)));
  const video = (filter = GRADE) => <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(cut.from * FPS)} playbackRate={rate} muted
    style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter}}/>;
  // Their caption sits in a band across the middle; blur it out when our own line goes there.
  const band = hideCaption && <div style={{position: 'absolute', left: 0, right: 0, top: '41%', height: '18%', backdropFilter: 'blur(18px) brightness(.55)',
    WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent)'}}/>;
  const text = children && <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '0 80px', textAlign: 'center'}}>{children}</AbsoluteFill>;
  if (!portrait) return <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
    <AbsoluteFill style={{transform: `scale(${drift * punch})`}}>{video()}{band}</AbsoluteFill>{text}
  </AbsoluteFill>;
  const boxHeight = Math.round(width / (.65 * 16 / 9));
  return <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
    <AbsoluteFill style={{transform: `scale(${1.25 * drift})`}}>{video(`${GRADE} blur(36px) brightness(.45)`)}</AbsoluteFill>
    <div style={{position: 'absolute', left: 0, right: 0, top: '50%', height: boxHeight, marginTop: -boxHeight / 2, overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,.7)'}}>
      <AbsoluteFill style={{transform: `scale(${drift * punch})`}}>{video()}{band}</AbsoluteFill>{text}
    </div>
  </AbsoluteFill>;
}

function Line({children, title = false}: {children: ReactNode; title?: boolean}) {
  const portrait = usePortrait();
  const p = useEase(0, 1, 0, 9);
  const style: CSSProperties = title
    ? {fontFamily: SANS, fontWeight: 700, textTransform: 'uppercase', letterSpacing: portrait ? 2 : 6, fontSize: portrait ? 104 : 150, lineHeight: .95}
    : {fontFamily: SERIF, fontSize: portrait ? 58 : 76, lineHeight: 1.15};
  return <div style={{...style, color: '#fff', textShadow: '0 4px 30px rgba(0,0,0,.8)', opacity: p, filter: `blur(${(1 - p) * 10}px)`, transform: `translateY(${(1 - p) * 14}px) scale(${title ? 1.08 - p * .08 : 1})`}}>{children}</div>;
}

function AppClip({src, trim, label}: {src: string | null; trim: number; label: string}) {
  const scale = useEase(1.06, 1, 0, 10);
  if (!src) return <Placeholder label={label}/>;
  return <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
    <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(trim * FPS)} muted style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`}}/>
  </AbsoluteFill>;
}

function StickerZoom({src, sticker}: {src: string | null; sticker: typeof STICKERS[number]}) {
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const zoom = sticker.zoom[portrait ? 'portrait' : 'landscape'];
  const z = interpolate(useCurrentFrame(), [0, beat(2)], [zoom * .9, zoom]) * useEase(1.08, 1, 0, 8);
  const chip = useEase(0, 1, 3, 10, Easing.out(Easing.back(1.5)));
  if (!src) return <Placeholder label={`sticker ${sticker.number}`}/>;
  // Map the sticker's position on the 16:9 still to the frame after object-fit: cover.
  const shownWidth = Math.max(width, height * 16 / 9), shownHeight = shownWidth * 9 / 16;
  const x = (sticker.x * shownWidth - (shownWidth - width) / 2) / width, y = (sticker.y * shownHeight - (shownHeight - height) / 2) / height;
  return <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
    <Img src={staticFile(src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transformOrigin: `${x * 100}% ${y * 100}%`, transform: `translate(${(.5 - x) * 100}%, ${(.5 - y) * 100}%) scale(${z})`}}/>
    <div style={{position: 'absolute', left: '50%', bottom: portrait ? 320 : 110, transform: `translateX(-50%) scale(${.8 + chip * .2})`, opacity: chip, display: 'flex', alignItems: 'center', gap: 22,
      padding: portrait ? '24px 38px' : '20px 34px', background: PAPER, borderRadius: 999, boxShadow: '0 18px 50px rgba(39,53,46,.28)', fontFamily: SANS, fontSize: portrait ? 46 : 42, color: INK, whiteSpace: 'nowrap'}}>
      <span style={{fontFamily: MONO, fontSize: '.8em', color: ACCENT}}>{sticker.number}</span>
      <span style={{fontWeight: 600}}>{sticker.name}</span>
      <b style={{fontWeight: 700}}>{sticker.price}</b>
    </div>
  </AbsoluteFill>;
}

function SpotsScene({src}: {src: string | null}) {
  const f = useCurrentFrame();
  const portrait = usePortrait();
  const pop = (start: number) => interpolate(f, [start, start + 8], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.4))});
  const first = pop(22) * interpolate(f, [BUTT_CLICK - 12, BUTT_CLICK - 4], [1, 0], clamp), second = pop(BUTT_CLICK + 3);
  const card = (p: number, content: ReactNode) => <div style={{position: 'absolute', ...(portrait ? {left: 0, right: 0, top: 270, display: 'flex', justifyContent: 'center'} : {left: 120, top: 110}),
    opacity: p, transform: `translateY(${(1 - p) * 24}px) scale(${.92 + p * .08})`, transformOrigin: portrait ? '50% 0' : '0 0'}}>
    <div style={{background: PAPER, borderRadius: 26, padding: portrait ? '30px 42px' : '28px 40px', boxShadow: '0 24px 70px rgba(39,53,46,.3)', fontFamily: SANS, color: INK, textAlign: portrait ? 'center' : 'left'}}>{content}</div>
  </div>;
  const big: CSSProperties = {fontSize: portrait ? 82 : 92, fontWeight: 700, letterSpacing: -3, lineHeight: 1};
  return <AbsoluteFill>
    <AppClip src={src} trim={SPOTS_TRIM} label="app spots.mp4"/>
    {card(first, <div style={big}>From <span style={{color: ACCENT}}>$120</span>.</div>)}
    {card(second, <><div style={big}>The butt spot: <span style={{color: ACCENT}}>$500</span>.</div><div style={{fontSize: portrait ? 38 : 36, color: MUTED, marginTop: 14}}>Every takeover doubles the price.</div></>)}
  </AbsoluteFill>;
}

function CountdownScene({days}: {days: number}) {
  const portrait = usePortrait();
  const n = Math.round(useEase(0, days, 0, 16));
  const sub = useEase(0, 1, 10, 10);
  return <AbsoluteFill style={{background: PAPER, alignItems: 'center', justifyContent: 'center', fontFamily: SANS, color: INK}}>
    <div style={{fontFamily: MONO, fontSize: portrait ? 320 : 300, fontWeight: 500, letterSpacing: -12, lineHeight: 1, fontVariantNumeric: 'tabular-nums'}}>{n}</div>
    <div style={{fontSize: portrait ? 60 : 56, fontWeight: 650, letterSpacing: -1.5, marginTop: 18}}>days to race day</div>
    <div style={{fontSize: portrait ? 38 : 34, color: ACCENT, marginTop: 22, opacity: sub, transform: `translateY(${(1 - sub) * 12}px)`}}>Bidding closes 21 September</div>
  </AbsoluteFill>;
}

function EndCard({scene}: {scene: string | null}) {
  const f = useCurrentFrame();
  const portrait = usePortrait();
  const reveal = (i: number) => interpolate(f, [beat(i * .5), beat(i * .5) + 9], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const line = (i: number, children: ReactNode, style: CSSProperties = {}) => <div style={{opacity: reveal(i), transform: `translateY(${(1 - reveal(i)) * 20}px)`, ...style}}>{children}</div>;
  const drift = interpolate(f, [0, beat(8)], [1.06, 1]);
  return <AbsoluteFill style={{background: PAPER, fontFamily: SANS, color: INK, overflow: 'hidden'}}>
    {scene && <Img src={staticFile(scene)} style={{position: 'absolute', objectFit: 'cover', transform: `scale(${drift})`, ...(portrait
      ? {left: 0, top: 0, width: '100%', height: '62%', objectPosition: '50% 40%', WebkitMaskImage: 'linear-gradient(180deg, #000 62%, transparent)'}
      : {right: 0, top: 0, width: '62%', height: '100%', objectPosition: '50% 50%', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 38%)'})}}/>}
    {/* Portrait keeps the copy above Reels' caption and action buttons. */}
    <div style={{position: 'absolute', ...(portrait ? {left: 80, right: 180, bottom: 420} : {left: 140, top: 0, bottom: 0, width: 900, display: 'flex', flexDirection: 'column', justifyContent: 'center'})}}>
      {line(0, 'BHAVYA GOR · 21.1 KM · BENGALURU', {fontFamily: MONO, fontSize: portrait ? 30 : 26, letterSpacing: 3, color: MUTED})}
      {line(1, 'Sponsor my slow run.', {fontSize: portrait ? 124 : 128, fontWeight: 700, letterSpacing: -5, lineHeight: .95, marginTop: 26})}
      {line(2, 'Your logo on my race kit · from $120', {fontSize: portrait ? 44 : 42, color: ACCENT, fontWeight: 600, marginTop: 30})}
      {line(3, <span style={{display: 'inline-block', background: INK, color: PAPER, borderRadius: 999, padding: portrait ? '24px 40px' : '22px 38px', fontSize: portrait ? 50 : 46, fontWeight: 600, letterSpacing: -1}}>sponsormyslowrun.com</span>, {marginTop: 48})}
      {line(4, '@bhavya_gor on X', {fontSize: portrait ? 34 : 30, color: MUTED, marginTop: 30})}
    </div>
  </AbsoluteFill>;
}

export function Launch(props: LaunchProps) {
  const portrait = usePortrait();
  const app = props.app[portrait ? 'portrait' : 'landscape'];
  const stills = {closeup: props.closeup, scene: props.scene};
  const starts = FOOTAGE_CUTS.map((_, i) => FOOTAGE_CUTS.slice(0, i).reduce((sum: number, cut: Cut) => sum + cut.beats, 0));
  return <AbsoluteFill style={{background: '#000'}}>
    {props.audio && <Audio src={staticFile(props.audio)} trimBefore={Math.round(props.audioStart * FPS)}
      volume={f => interpolate(f, [DURATION - beat(4), DURATION], [1, 0], clamp)}/>}

    {FOOTAGE_CUTS.map((cut, i) => <Beats key={cut.from} from={starts[i]} beats={cut.beats}>
      <FootageCut src={props.footage} cut={cut} hideCaption={!!(cut.title || cut.text)}>
        {cut.title ? <Line title>{cut.title}</Line> : cut.text ? <Line>{cut.text}</Line> : null}
      </FootageCut>
    </Beats>)}
    <Sequence durationInFrames={beat(APP_BEAT)}>
      <Grain/>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.5) 100%)'}}/>
    </Sequence>

    <Beats from={APP_BEAT} beats={6}><AppClip src={app.orbit} trim={.4} label="app orbit.mp4"/><Flash/></Beats>
    {STICKERS.map((sticker, i) => <Beats key={sticker.number} from={APP_BEAT + 6 + i * 2} beats={2}><StickerZoom src={stills[sticker.still]} sticker={sticker}/></Beats>)}
    <Beats from={APP_BEAT + 12} beats={8}><SpotsScene src={app.spots}/><Flash frames={4}/></Beats>
    <Beats from={APP_BEAT + 20} beats={4}><CountdownScene days={props.daysToRace}/></Beats>
    <Beats from={APP_BEAT + 24} beats={8}><EndCard scene={props.scene}/></Beats>
  </AbsoluteFill>;
}

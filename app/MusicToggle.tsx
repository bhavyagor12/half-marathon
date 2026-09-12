'use client';
import {useEffect, useRef, useState} from 'react';
import RailButton from './RailButton';

// Survivor's official "Eye of the Tiger" video. The track streams through YouTube's player and is never hosted here.
const VIDEO_ID = 'btPJPFnesV4', PREFERENCE = 'slowrun-music', PLAYING = 1;
type Player = {playVideo(): void; pauseVideo(): void; setVolume(volume: number): void; destroy(): void};
type PlayerOptions = {host: string; videoId: string; width: number; height: number; playerVars: Record<string, string | number>; events: {onReady(event: {target: Player}): void; onStateChange(event: {data: number}): void; onError(): void}};
declare global {
  interface Window {YT?: {Player: new (element: HTMLElement, options: PlayerOptions) => Player}; onYouTubeIframeAPIReady?: () => void}
}
let api: Promise<void> | null = null;
function loadApi() {
  api ??= new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) {resolve(); return;}
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {previous?.(); resolve();};
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
    script.onerror = () => {api = null; reject(new Error('YouTube player unavailable'));};
    document.head.appendChild(script);
  });
  return api;
}
const Speaker = ({on}: {on: boolean}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/>{on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/> : <path d="m16 9 5 6m0-6-5 6"/>}</svg>;

/** Soundtrack toggle. Music is on by default, but browsers only allow sound after the visitor's first
 *  interaction, so the track starts on the first tap, click or key press. A mute choice is remembered. */
export default function MusicToggle({enabled}: {enabled: boolean}) {
  const [on, setOn] = useState(true), [failed, setFailed] = useState(false);
  const player = useRef<Player | null>(null), wanted = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false, host: HTMLDivElement | null = null;
    try {wanted.current = localStorage.getItem(PREFERENCE) !== 'off';} catch {/* Storage may be blocked; keep music on. */}
    const sync = setTimeout(() => setOn(wanted.current), 0);
    const unlock = () => {if (wanted.current) player.current?.playVideo();};
    const gestures = ['pointerdown', 'keydown', 'touchstart'] as const;
    const stopListening = () => gestures.forEach(name => document.removeEventListener(name, unlock));
    gestures.forEach(name => document.addEventListener(name, unlock, {passive: true}));
    // Give the 3D model a head start before loading YouTube.
    const start = setTimeout(async () => {
      try {
        await loadApi();
        if (cancelled) return;
        // The iframe lives outside the React tree so hiding the rail (e.g. while a panel is open) never interrupts playback.
        host = document.createElement('div'); host.className = 'music-player'; host.setAttribute('aria-hidden', 'true');
        const mount = document.createElement('div'); host.appendChild(mount); document.body.appendChild(host);
        player.current = new window.YT!.Player(mount, {
          host: 'https://www.youtube-nocookie.com', videoId: VIDEO_ID, width: 200, height: 200,
          playerVars: {autoplay: wanted.current ? 1 : 0, loop: 1, playlist: VIDEO_ID, controls: 0, playsinline: 1, rel: 0},
          events: {
            onReady: ({target}) => {target.setVolume(55); if (wanted.current) target.playVideo();},
            onStateChange: ({data}) => {if (data === PLAYING) stopListening();},
            onError: () => setFailed(true),
          },
        });
      } catch {if (!cancelled) setFailed(true);}
    }, 1200);
    return () => {cancelled = true; clearTimeout(sync); clearTimeout(start); stopListening(); player.current?.destroy(); player.current = null; host?.remove();};
  }, [enabled]);
  const toggle = () => {
    const next = !wanted.current;
    wanted.current = next; setOn(next);
    try {localStorage.setItem(PREFERENCE, next ? 'on' : 'off');} catch {/* The choice just won't persist. */}
    if (next) player.current?.playVideo(); else player.current?.pauseVideo();
  };
  const label = failed ? 'Music is unavailable right now' : on ? 'Mute Eye of the Tiger' : 'Play Eye of the Tiger';
  return <RailButton label={label} pressed={on && !failed} onClick={toggle}>
    <span className="icon-swap"><span><Speaker on={false}/></span><span><Speaker on/></span></span>
  </RailButton>;
}

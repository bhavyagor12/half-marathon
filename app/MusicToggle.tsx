'use client';
import {useEffect, useRef, useState} from 'react';

// Survivor's official "Eye of the Tiger" video. The track streams through YouTube's player and is never hosted here.
const VIDEO_ID = 'btPJPFnesV4';
type Player = {playVideo(): void; pauseVideo(): void; setVolume(volume: number): void; destroy(): void};
type PlayerOptions = {host: string; videoId: string; width: number; height: number; playerVars: Record<string, string | number>; events: {onReady(event: {target: Player}): void; onError(): void}};
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
function SpeakerIcon({on}: {on: boolean}) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/>{on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/> : <path d="m16 9 5 6m0-6-5 6"/>}</svg>;
}

/** Play/pause for the soundtrack. Nothing loads from YouTube until the visitor asks for music. */
export default function MusicToggle() {
  const [playing, setPlaying] = useState(false), [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const player = useRef<Player | null>(null);
  useEffect(() => () => {player.current?.destroy(); document.getElementById('music-player')?.remove();}, []);
  async function toggle() {
    if (status === 'loading') return;
    if (player.current) {if (playing) player.current.pauseVideo(); else player.current.playVideo(); setPlaying(!playing); return;}
    setStatus('loading');
    try {
      await loadApi();
      // The iframe lives outside the React tree so hiding the toolbar (e.g. while a panel is open) never interrupts playback.
      const host = document.createElement('div'), mount = document.createElement('div');
      host.id = 'music-player'; host.className = 'music-player'; host.setAttribute('aria-hidden', 'true');
      host.appendChild(mount); document.body.appendChild(host);
      player.current = new window.YT!.Player(mount, {
        host: 'https://www.youtube-nocookie.com', videoId: VIDEO_ID, width: 200, height: 200,
        playerVars: {autoplay: 1, loop: 1, playlist: VIDEO_ID, controls: 0, playsinline: 1, rel: 0},
        events: {
          onReady: ({target}) => {target.setVolume(55); target.playVideo(); setPlaying(true); setStatus('idle');},
          onError: () => {setPlaying(false); setStatus('error');},
        },
      });
    } catch {setStatus('error');}
  }
  const label = status === 'error' ? 'Music is unavailable right now' : status === 'loading' ? 'Loading music…' : playing ? 'Pause Eye of the Tiger' : 'Play Eye of the Tiger';
  return <button className="control music" aria-pressed={playing} aria-label={label} title={label} onClick={() => void toggle()}>
    <SpeakerIcon on={playing}/><span className="music-label">{status === 'loading' ? 'Loading…' : 'Music'}</span>
  </button>;
}

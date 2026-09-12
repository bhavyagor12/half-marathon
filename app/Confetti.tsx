'use client';
import {useEffect, useRef} from 'react';

type Burst = {x: number; y: number; count?: number; spread?: number; power?: number; angle?: number};
type Piece = {x: number; y: number; vx: number; vy: number; rot: number; spin: number; w: number; h: number; color: string; age: number; ttl: number; round: boolean};
const COLORS = ['#a8371e', '#e2694a', '#27352e', '#f2c14e', '#fffaf0', '#7c8a67'];

/** Fire a burst from any client component; the single <Confetti/> canvas renders it. Angles are degrees, -90 is straight up. */
export function confetti(detail: Burst) {
  window.dispatchEvent(new CustomEvent<Burst>('slowrun:confetti', {detail}));
}

/** Full-screen, click-through confetti canvas. It only animates while pieces are alive and respects reduced motion. */
export default function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current, ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    const pieces: Piece[] = [], reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      node.width = innerWidth * dpr; node.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const tick = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.age++; p.vy += .22; p.vx *= .984; p.vy *= .984; p.x += p.vx; p.y += p.vy; p.rot += p.spin;
        if (p.age > p.ttl || p.y > innerHeight + 40) {pieces.splice(i, 1); continue;}
        ctx.save();
        ctx.globalAlpha = Math.min(1, (p.ttl - p.age) / 25);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        // Squashing the height by the rotation fakes a paper flip without 3D.
        if (p.round) {ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill();}
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, Math.max(1, p.h * Math.abs(Math.cos(p.rot * 1.7))));
        ctx.restore();
      }
      frame = pieces.length ? requestAnimationFrame(tick) : 0;
    };
    const fire = (event: Event) => {
      if (reduced.matches) return;
      const {x, y, count = 80, spread = 70, power = 11, angle = -90} = (event as CustomEvent<Burst>).detail;
      for (let n = 0; n < count; n++) {
        const direction = (angle + (Math.random() - .5) * spread) * Math.PI / 180, speed = power * (.45 + Math.random() * .75);
        pieces.push({x, y, vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed, rot: Math.random() * 6, spin: (Math.random() - .5) * .3, w: 5 + Math.random() * 5, h: 8 + Math.random() * 6, color: COLORS[n % COLORS.length], age: 0, ttl: 80 + Math.random() * 60, round: Math.random() < .25});
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };
    resize();
    window.addEventListener('resize', resize); window.addEventListener('slowrun:confetti', fire);
    return () => {cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('slowrun:confetti', fire);};
  }, []);
  return <canvas ref={canvas} className="confetti" aria-hidden="true"/>;
}

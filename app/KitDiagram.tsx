import {AVATAR_ANCHORS} from '@/lib/avatar.mjs';
import {SPOTS} from '@/lib/config';

const TEE = 'M36 8Q50 17 64 8L79 12L95 31L84 41L78 35V72H22V35L16 41L5 31L21 12Z';
// Anchors are metres above the soles; this maps them onto a 100-unit schematic of the tee and shorts.
const box = ([x, y, width, height]: number[]) => ({x: (x - width / 2 + .5) * 100, y: (2.12 - y - height / 2) * 100, width: width * 100, height: height * 100});

/** Schematic front and back of the race kit, using the same anchors as the 3D decals. */
export default function KitDiagram({selected}: {selected: number}) {
  return <figure className="kit-diagram">
    <svg viewBox="0 0 230 128" role="img" aria-label={`${SPOTS[selected]} highlighted on the race kit`}>
      {[1, -1].map((side, i) => <g key={side} transform={`translate(${i * 120 + 5} 2)`}>
        <rect className="shorts" x="24" y="70" width="52" height="42" rx="4"/>
        <path className="tee" d={TEE}/>
        {AVATAR_ANCHORS.map((anchor, n) => anchor[4] === side && <rect key={n} className={n === selected ? 'chosen' : 'open'} rx="2" {...box(anchor)}/>)}
        <text x="50" y="124">{side === 1 ? 'Front' : 'Back'}</text>
      </g>)}
    </svg>
  </figure>;
}

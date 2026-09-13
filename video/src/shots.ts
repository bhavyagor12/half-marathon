/** A cut from footage/outwork.mp4, in seconds. Each stretches or squeezes slightly to fill its beats. */
export type Cut = {beats: number; from: number; to: number; title?: string; text?: string};

/**
 * The opening footage, in play order (keep the total on a whole bar so the app drops on the downbeat). Cuts with a title or text blur the clip's own caption and show ours instead;
 * the rest keep their original burned-in line.
 */
export const FOOTAGE_CUTS: Cut[] = [
  {beats: 4, from: 109.6, to: 110.7, text: "I'm running a half marathon."}, // beach runner, slowed down
  {beats: 4, from: 3.54, to: 5.48, title: "'Till I collapse"}, // hurricane runner
  {beats: 8, from: 72.39, to: 75.5}, // you can't let anybody tell you / you can't do something (stops before "I'll repeat that")
  {beats: 4, from: 67.91, to: 69.17}, // but if you want something bad enough
  {beats: 4, from: 7.45, to: 9.2}, // something in you has to wake up
  {beats: 2, from: 389.2, to: 390.3, text: 'Bengaluru · 20 December · 21.1 km'}, // runner on the bridge
  {beats: 2, from: 48.3, to: 49.05, text: 'Slow runner. Long exposure.'}, // runner on a night street
];

/** Sticker punch-ins on the 2× landscape stills. x/y are fractions of the still. */
export const STICKERS = [
  {number: '01', name: 'Front chest', price: '$50', still: 'closeup', x: .5, y: .509, zoom: {landscape: 2.3, portrait: 1.9}},
  {number: '04', name: 'Left forearm', price: '$50', still: 'closeup', x: .409, y: .64, zoom: {landscape: 2.6, portrait: 2.4}},
  {number: '08', name: 'Left quad', price: '$50', still: 'scene', x: .474, y: .66, zoom: {landscape: 3.4, portrait: 2.8}},
] as const;

/** Seconds trimmed from the start of spots.mp4, and frames into that section where the butt spot is clicked (3.7s recorded). */
export const SPOTS_TRIM = .7;
export const BUTT_CLICK = Math.round((3.7 - SPOTS_TRIM) * 30);

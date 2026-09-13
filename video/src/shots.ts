/** A cut from footage/outwork.mp4, in seconds. Each stretches or squeezes slightly to fill its beats. */
export type Cut = {beats: number; from: number; to: number; title?: string; text?: string};

/**
 * The opening footage, in play order (keep the total on a whole bar so the app drops on the downbeat). Cuts with a title or text blur the clip's own caption and show ours instead;
 * the rest keep their original burned-in line.
 */
// Short cut: the runner, the location, then straight into the app two bars in.
export const FOOTAGE_CUTS: Cut[] = [
  {beats: 4, from: 109.6, to: 110.7, text: "I'm running a half marathon."}, // beach runner, slowed down
  {beats: 4, from: 389.2, to: 390.3, text: 'Bengaluru · 20 December · 21.1 km'}, // runner on the bridge
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

// Shared by the Remotion Studio (src/Root.tsx) and the render script, so both resolve the same files.

export const RACE_DATE = '2026-12-20T00:00:00+05:30';

/** Whole days left, matching the site's countdown. */
export function daysToRace(now = Date.now()) {
  return Math.max(0, Math.floor((Date.parse(RACE_DATE) - now) / 86_400_000));
}

/**
 * @param {string[]} names public/ paths such as "footage/outwork.mp4" or "app/landscape/orbit.mp4"
 * @param {number} days
 * @param {number} [audioStart] seconds into the track where the video's first frame lands
 */
export function resolveAssets(names, days, audioStart = 0) {
  const has = (/** @type {string} */ name) => (names.includes(name) ? name : null);
  const app = (/** @type {string} */ format) => ({orbit: has(`app/${format}/orbit.mp4`), spots: has(`app/${format}/spots.mp4`)});
  return {
    footage: has('footage/outwork.mp4'),
    audio: names.find(name => /^audio\/[^/]+\.(mp3|m4a|aac|wav)$/i.test(name)) ?? null,
    audioStart,
    daysToRace: days,
    // Stills come from the 2× landscape capture for both formats; the portrait canvas renders too small to punch into.
    closeup: has('app/landscape/closeup.png'),
    scene: has('app/landscape/scene.png'),
    app: {landscape: app('landscape'), portrait: app('portrait')},
  };
}

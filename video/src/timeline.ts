export const FPS = 30;
/** "Eye of the Tiger" runs at ~109 BPM; every cut lands on this beat grid (4 beats = 1 bar). */
export const BPM = 109;
export const beat = (n: number) => Math.round((n * 60 * FPS) / BPM);
export const TOTAL_BEATS = 64;
export const DURATION = beat(TOTAL_BEATS);

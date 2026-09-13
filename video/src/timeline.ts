import {FOOTAGE_CUTS} from './shots';

export const FPS = 30;
/** "Eye of the Tiger" runs at ~109 BPM; every cut lands on this beat grid (4 beats = 1 bar). */
export const BPM = 109;
export const beat = (n: number) => Math.round((n * 60 * FPS) / BPM);
/** The app section starts right after the footage. */
export const APP_BEAT = FOOTAGE_CUTS.reduce((sum, cut) => sum + cut.beats, 0);
/** Footage, then orbit (6) + stickers (6) + spots (8) + countdown (4) + end card (8). */
export const TOTAL_BEATS = APP_BEAT + 32;
export const DURATION = beat(TOTAL_BEATS);

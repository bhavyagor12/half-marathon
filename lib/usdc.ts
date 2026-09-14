// BigInt() rather than 123n literals: the site's TypeScript target predates BigInt literal syntax.
const MICRO = BigInt(1_000_000);

/** USDC has 6 decimals; prices are integer cents. */
export const UNITS_PER_CENT = BigInt(10_000);

/** A sub-cent tag (1–9,999 atomic units, under $0.01) that makes an order's exact USDC amount unique. */
export function randomTag() {
  return 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9_999);
}

export function usdcUnits(cents: number, tag: number) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isInteger(tag) || tag < 1 || tag > 9_999) throw new Error('Invalid USDC amount');
  return BigInt(cents) * UNITS_PER_CENT + BigInt(tag);
}

/** "250.004321": always six decimals, which Base Pay accepts. */
export function formatUsdc(units: bigint) {
  if (units <= BigInt(0)) throw new Error('Invalid USDC amount');
  return `${units / MICRO}.${(units % MICRO).toString().padStart(6, '0')}`;
}

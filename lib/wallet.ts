/** Networks a stablecoin (USDC) refund can be sent on. Keep in sync with slowrun_orders_refund_wallet_check. */
export const REFUND_NETWORKS = {base: 'Base', ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana'} as const;
export type RefundNetwork = keyof typeof REFUND_NETWORKS;

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const EXPLORERS: Record<RefundNetwork, string> = {
  base: 'https://basescan.org/tx/',
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/',
};

/** Decoded byte length of a base58 string, or -1 if it has characters outside the alphabet. */
function base58Bytes(value: string) {
  const bytes: number[] = [];
  for (const char of value) {
    let carry = BASE58.indexOf(char);
    if (carry < 0) return -1;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let leadingZeros = 0;
  while (value[leadingZeros] === '1') leadingZeros++;
  return bytes.length + leadingZeros;
}

export function isRefundNetwork(value: unknown): value is RefundNetwork {
  return typeof value === 'string' && Object.hasOwn(REFUND_NETWORKS, value);
}

/**
 * Validates a refund wallet for its network. EVM checksums are not verified (that needs keccak), so the payer also confirms
 * they control the wallet. Returns null for anything that could lose funds: wrong format, wrong network, or a burn address.
 */
export function parseRefundWallet(network: unknown, address: unknown): {network: RefundNetwork; address: string} | null {
  if (!isRefundNetwork(network) || typeof address !== 'string') return null;
  const value = address.trim();
  if (network === 'solana') {
    const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value) && base58Bytes(value) === 32 && !/^1+$/.test(value);
    return valid ? {network, address: value} : null;
  }
  const valid = /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value) && !/^0x0{36}dead$/i.test(value);
  return valid ? {network, address: value} : null;
}

/** Dodo reports stablecoin checkouts as the crypto_currency payment method type. */
export function isStablecoinPayment(payment: {payment_method?: string | null; payment_method_type?: string | null}) {
  return /crypto|stablecoin|usdc|usdp|usdg/i.test(`${payment.payment_method_type ?? ''} ${payment.payment_method ?? ''}`);
}

export const shortAddress = (address: string) => (address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

/** Block explorer link for a payout transaction, when the reference looks like a transaction on that network. */
export function explorerUrl(network: string | null, reference: string | null) {
  if (!isRefundNetwork(network) || !reference) return null;
  const valid = network === 'solana' ? /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(reference) : /^0x[0-9a-fA-F]{64}$/.test(reference);
  return valid ? EXPLORERS[network] + reference : null;
}

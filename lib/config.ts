export const SITE_ORIGIN = 'https://sponsormyslowrun.com';
export const RACE_DATE = '2026-12-20T00:00:00+05:30';
export const CLOSE_DATE = '2026-12-10T00:00:00+05:30';
export const SPOTS = ['Front · chest','Front · left chest','Front · right chest','Left forearm','Right forearm','Back · upper','Back · lower','Left quad','Butt · back of shorts','Right quad'];
// Opening bids in USD cents, by visibility. Selling every spot once raises $2,090 (about $2,000 after payment fees); takeovers add more.
// The centre spots are the front chest and the whole back (the field sees a slow runner's back all race); the butt is the premium spot.
export const OPENING_PRICES = [
  25000, // Front · chest
  15000, // Front · left chest
  15000, // Front · right chest
  15000, // Left forearm
  15000, // Right forearm
  25000, // Back · upper
  25000, // Back · lower
  12000, // Left quad
  50000, // Butt · back of shorts
  12000, // Right quad
];
export function startingPrice(slot:number){return OPENING_PRICES[slot];}
export function nextPrice(slot:number,paid?:number){return paid?paid*2:startingPrice(slot);}
export type Sponsor = {slot:number;brand:string;tagline:string;website:string;logo:string;amount:number;version:number};

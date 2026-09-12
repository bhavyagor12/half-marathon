export const SITE_ORIGIN = 'https://sponsormyslowrun.com';
export const RACE_DATE = '2026-12-20T00:00:00+05:30';
export const CLOSE_DATE = '2026-12-10T00:00:00+05:30';
export const SPOTS = ['Front · chest','Front · left chest','Front · right chest','Left forearm','Right forearm','Back · upper','Back · lower','Left quad','Butt · back of shorts','Right quad'];
// Opening bids in USD cents, sized by area and visibility: chest and upper back $15; left/right chest, lower back and quad $10; forearms $5; butt $20.
export const OPENING_PRICES = [1500,1000,1000,500,500,1500,1000,1000,2000,1000];
export function startingPrice(slot:number){return OPENING_PRICES[slot];}
export function nextPrice(slot:number,paid?:number){return paid?paid*2:startingPrice(slot);}
export type Sponsor = {slot:number;brand:string;tagline:string;website:string;logo:string;amount:number;version:number};

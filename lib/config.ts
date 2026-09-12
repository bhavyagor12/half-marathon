export const SITE_ORIGIN = 'https://sponsormyslowrun.com';
export const RACE_DATE = '2026-12-20T00:00:00+05:30';
export const CLOSE_DATE = '2026-12-10T00:00:00+05:30';
export const SPOTS = ['Front · chest','Front · left chest','Front · right chest','Left forearm','Right forearm','Back · upper','Back · lower','Left quad','Butt · back of shorts'];
export function startingPrice(slot:number){return slot===8?2000:1000;}
export function nextPrice(slot:number,paid?:number){return paid?paid*2:startingPrice(slot);}
export type Sponsor = {slot:number;brand:string;tagline:string;website:string;logo:string;amount:number;version:number};

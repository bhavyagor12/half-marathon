export const RACE_DATE = '2026-12-20T00:00:00+05:30';
export const CLOSE_DATE = '2026-12-10T00:00:00+05:30';
export const SPOTS = ['Front · center','Front · left chest','Front · right chest','Left sleeve','Right sleeve','Back · upper','Back · center','Back · lower','Butt · back of shorts'];
export function startingPrice(slot:number){return slot===8?2000:1000;}
export function nextPrice(slot:number,paid?:number){return paid?paid*2:startingPrice(slot);}
export type Sponsor = {slot:number;brand:string;tagline:string;website:string;logo:string;amount:number;version:number};

import type {Metadata} from 'next';

import './globals.css';
export async function generateMetadata():Promise<Metadata>{const title='Slow Club — Sponsor Bhavya’s Half Marathon';const description='I run slow. Your logo gets more airtime. Sponsor Bhavya’s race tee for his December 20, 2026 half marathon. Spots start at $10. The premium shorts spot starts at $20. Each outbid doubles the price.';return {title,description,openGraph:{title,description,type:'website',images:[]},twitter:{card:'summary',title,description,creator:'@bhavya_gor',images:[]}};}
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}

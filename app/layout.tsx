import type {Metadata, Viewport} from 'next';
import './globals.css';
const title = 'Sponsor my slow run — Bhavya Gor';
const description = '21.1 km. One slow runner. Your logo on my race kit. Bengaluru, 20 December 2026. Tee spots from $10 USD; premium shorts spot from $20 USD.';
export const metadata: Metadata = {
  metadataBase: new URL('https://half-marathon-nu.vercel.app'), title, description,
  openGraph: {title, description, type: 'website', url: '/', images: [{url:'/share.jpg', width:1200, height:630, alt:'Sponsor Bhavya’s slow run — Bengaluru, December 20, 2026'}]},
  twitter: {card:'summary_large_image', title, description, creator:'@bhavya_gor', images:['/share.jpg']},
  icons: {icon:'/favicon.svg', apple:'/apple-touch-icon.png'},
};
export const viewport: Viewport = {themeColor:'#f7f2e8'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en"><head><link rel="preload" href="/scene-poster.webp" as="image" media="(min-width: 701px)"/><link rel="preload" href="/scene-poster-mobile.webp" as="image" media="(max-width: 700px)"/><link rel="preload" href="/fonts/geist-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body>{children}</body></html>;
}

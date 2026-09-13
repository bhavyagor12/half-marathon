import type {Metadata, Viewport} from 'next';
import {SITE_ORIGIN} from '@/lib/config';
import './globals.css';
const name = 'Sponsor my slow run';
const title = 'Sponsor my slow run — Bhavya Gor';
const description = '21.1 km. One slow runner. Your logo on my race kit. Bengaluru, 20 December 2026. Spots on my tee, forearms and quad from $50 USD; the premium shorts spot from $100 USD.';
// Bump the version whenever share.jpg changes: X, LinkedIn, Slack and WhatsApp cache link previews by image URL.
const shareImage = {url: '/share.jpg?v=20260912-3', width: 1200, height: 630, type: 'image/jpeg', alt: 'Bhavya in his race kit at a Bengaluru start line with numbered sponsor spots, next to the words “Sponsor my slow run”'};
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN), title, description,
  applicationName: name, authors: [{name: 'Bhavya Gor', url: 'https://x.com/bhavya_gor'}], creator: 'Bhavya Gor', publisher: 'Bhavya Gor',
  keywords: ['sponsor', 'half marathon', 'Bengaluru', 'race kit sponsorship', 'logo placement', 'running', 'Bhavya Gor'],
  category: 'sports',
  alternates: {canonical: '/'},
  robots: {index: true, follow: true, googleBot: {index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1}},
  openGraph: {type: 'website', url: '/', siteName: name, locale: 'en_US', title, description, images: [shareImage]},
  twitter: {card: 'summary_large_image', site: '@bhavya_gor', creator: '@bhavya_gor', title, description, images: [{url: shareImage.url, alt: shareImage.alt, width: shareImage.width, height: shareImage.height}]},
  icons: {icon: [{url: '/favicon.ico', sizes: '48x48'}, {url: '/favicon.svg', type: 'image/svg+xml'}, {url: '/icon-192.png', sizes: '192x192', type: 'image/png'}], apple: [{url: '/apple-touch-icon.png', sizes: '180x180'}]},
};
export const viewport: Viewport = {themeColor: '#f7f2e8', colorScheme: 'light'};
const structuredData = {'@context': 'https://schema.org', '@graph': [
  {'@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, url: SITE_ORIGIN, name, description, inLanguage: 'en', image: `${SITE_ORIGIN}${shareImage.url}`, publisher: {'@id': `${SITE_ORIGIN}/#bhavya`}},
  {'@type': 'Person', '@id': `${SITE_ORIGIN}/#bhavya`, name: 'Bhavya Gor', url: SITE_ORIGIN, image: `${SITE_ORIGIN}/bhavya-x-avatar.jpg`, sameAs: ['https://x.com/bhavya_gor']},
]};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en"><head><link rel="preload" href="/scene-poster.webp" as="image" media="(min-width: 701px)"/><link rel="preload" href="/scene-poster-mobile.webp" as="image" media="(max-width: 700px)"/><link rel="preload" href="/fonts/geist-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredData)}}/></head><body>{children}</body></html>;
}

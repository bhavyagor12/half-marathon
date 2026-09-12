import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sponsor my slow run', short_name: 'Slow run', description: 'Put your logo on Bhavya’s race kit for the Bengaluru half marathon, 20 December 2026.',
    start_url: '/', display: 'standalone', background_color: '#f7f2e8', theme_color: '#f7f2e8',
    icons: [{src: '/icon-192.png', sizes: '192x192', type: 'image/png'}, {src: '/icon-512.png', sizes: '512x512', type: 'image/png'}],
  };
}

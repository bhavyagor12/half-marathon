import type {MetadataRoute} from 'next';
import {SITE_ORIGIN} from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{url: SITE_ORIGIN, lastModified: new Date('2026-09-12'), changeFrequency: 'daily', priority: 1, images: [`${SITE_ORIGIN}/share.jpg`]}];
}

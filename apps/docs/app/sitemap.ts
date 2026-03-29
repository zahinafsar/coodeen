import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://coodeen.com';

  const pages = [
    '',
    '/docs',
    '/docs/getting-started/quick-start',
    '/docs/getting-started/configuration',
    '/docs/getting-started/providers',
    '/docs/features/chat',
    '/docs/features/preview',
    '/docs/features/file-explorer',
    '/docs/features/terminal',
    '/docs/features/git',
    '/docs/features/screenshots',
    '/docs/architecture/overview',
    '/docs/architecture/server',
    '/docs/architecture/tools',
    '/docs/architecture/database',
    '/docs/guides/development',
    '/docs/guides/troubleshooting',
  ];

  return pages.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'monthly' : 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));
}

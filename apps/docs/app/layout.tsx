import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://coodeen.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Coodeen - AI Coding Assistant with Live Preview',
    template: '%s | Coodeen Docs',
  },
  description:
    'AI coding assistant with a split-pane editor — chat on the left, live preview on the right. Supports OpenAI, Anthropic, and Google models. Fully local and private.',
  keywords: [
    'coodeen',
    'ai coding assistant',
    'code editor',
    'live preview',
    'openai',
    'anthropic',
    'claude',
    'gpt',
    'gemini',
    'ai pair programming',
    'local ai tool',
    'developer tools',
    'npx coodeen',
  ],
  authors: [{ name: 'Zahin Afsar', url: 'https://github.com/zahinafsar' }],
  creator: 'Zahin Afsar',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Coodeen',
    title: 'Coodeen - AI Coding Assistant with Live Preview',
    description:
      'AI coding assistant with a split-pane editor — chat on the left, live preview on the right. Supports OpenAI, Anthropic, and Google models.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Coodeen - AI Coding Assistant',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Coodeen - AI Coding Assistant with Live Preview',
    description:
      'AI coding assistant with a split-pane editor — chat on the left, live preview on the right.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="canonical" href={siteUrl} />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          theme={{ enabled: true, forcedTheme: 'dark' }}
          search={{
            options: {
              type: 'static',
            },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

import './globals.css';
import type { Metadata, Viewport } from 'next';

const site =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  'http://localhost:3000';

const description = 'It’s Giselle’s birthday ♡ Tap what you had and chip in for the birthday girl.';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: 'Giselle’s Birthday ♡',
  description,
  openGraph: {
    title: 'Giselle’s Birthday ♡',
    description,
    images: [{ url: '/giselle/og.jpg', width: 1200, height: 630, alt: 'Drawings of Giselle' }],
    type: 'website',
  },
  twitter: { card: 'summary_large_image', images: ['/giselle/og.jpg'] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#d6338a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Caveat:wght@500;700&family=Caveat+Brush&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

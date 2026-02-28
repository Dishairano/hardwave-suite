import type { Metadata, Viewport } from 'next';
import { PWAShell } from '@/components/pwa/PWAShell';
import './pwa.css';

export const metadata: Metadata = {
  title: 'Hardwave Suite - Mobile',
  description: 'Browse your sample library on the go',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hardwave',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function PWALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PWAShell>{children}</PWAShell>;
}

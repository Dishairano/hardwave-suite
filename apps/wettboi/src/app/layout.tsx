import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WettBoi',
  description: 'WettBoi VST by Hardwave Studios',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#000', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}

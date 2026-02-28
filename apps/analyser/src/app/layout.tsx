import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hardwave Analyser',
  description: 'Hardwave Analyser VST',
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

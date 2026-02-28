import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hardwave ERP',
  description: 'Hardwave Studios ERP System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

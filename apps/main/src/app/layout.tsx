import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "Hardwave Studios - Professional Harder-Styles Production Suite",
  description: "Complete production ecosystem for hardstyle, rawstyle, and hardcore producers. Sample organization, kick synthesis, Splice integration, and extended intro creation.",
  keywords: ["hardstyle", "rawstyle", "hardcore", "sample library", "kick generator", "FL Studio", "production tools", "harder styles"],
  authors: [{ name: "Hardwave Studios" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hardwave",
  },
  openGraph: {
    title: "Hardwave Studios - Professional Harder-Styles Production Suite",
    description: "Complete production ecosystem for hardstyle, rawstyle, and hardcore producers.",
    url: "https://hardwavestudios.com",
    siteName: "Hardwave Studios",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFA500",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossOrigin="anonymous" referrerPolicy="no-referrer" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className="antialiased"
      >
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}

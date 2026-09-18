import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "DartsScheduler",
  description: "Raspored pikado ekipa i pregled zauzetosti mjesta igranja.",
  manifest: `${basePath}/manifest.webmanifest`,
  applicationName: "DartsScheduler",
  appleWebApp: {
    capable: true,
    title: "DartsScheduler",
    statusBarStyle: "black-translucent",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [
      { url: `${basePath}/favicon.svg`, type: "image/svg+xml" },
      { url: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    shortcut: `${basePath}/favicon.svg`,
    apple: [{ url: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr">
      <body className="antialiased">{children}</body>
    </html>
  );
}

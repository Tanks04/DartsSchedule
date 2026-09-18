import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DartsScheduler",
  description: "Raspored pikado ekipa i pregled zauzetosti mjesta igranja.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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

import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata = {
  title: "CPA Cleanup Next Console",
  description: "Next.js UI for CPA Codex Cleanup",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable}`}>{children}</body>
    </html>
  );
}

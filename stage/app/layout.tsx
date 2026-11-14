import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Homer's Odyssey", description: "Every great solution begins with an Odyssey." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

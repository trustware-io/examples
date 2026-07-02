import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Trustware Embedded Swap",
  description: "Trustware swap widget with a Privy-style embedded wallet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

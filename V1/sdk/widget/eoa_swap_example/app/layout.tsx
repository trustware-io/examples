import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Trustware EOA Swap",
  description: "Trustware swap widget with an injected EOA wallet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

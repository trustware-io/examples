import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Trustware EOA Deposit",
  description: "Trustware deposit widget with an injected EOA wallet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

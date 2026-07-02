import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Trustware Headless Example",
  description: "Build Trustware routes with the SDK core API in Next.js.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

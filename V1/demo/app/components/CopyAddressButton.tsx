"use client";

import { useState } from "react";

export default function CopyAddressButton({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS context) — nothing to do.
    }
  }

  return (
    <button type="button" className={className} onClick={handleCopy}>
      {copied ? "Copied!" : "Copy address"}
    </button>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavBar.module.css";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/headless", label: "Headless" },
  { href: "/eoa-deposit", label: "EOA Deposit" },
  { href: "/eoa-swap", label: "EOA Swap" },
  { href: "/embedded-swap", label: "Embedded Swap" },
  { href: "/embedded-withdraw", label: "Embedded Deposit + Withdraw" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        <span className={styles.brandMark} />
        Trustware
      </Link>
      <div className={styles.links}>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname === link.href ? styles.linkActive : styles.link}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

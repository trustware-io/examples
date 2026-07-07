import Link from "next/link";
import styles from "./page.module.css";

const DEMOS = [
  {
    href: "/headless",
    tag: "SDK core",
    title: "Headless route builder",
    description:
      "Calls Trustware.init and Trustware.buildRoute directly — no widget UI, your own layout.",
  },
  {
    href: "/eoa-deposit",
    tag: "Injected wallet",
    title: "EOA deposit widget",
    description:
      "Drop-in deposit widget backed by a browser-injected wallet (MetaMask, Coinbase Wallet, Rabby).",
  },
  {
    href: "/eoa-swap",
    tag: "Injected wallet",
    title: "EOA swap widget",
    description: "Same widget in swap mode, still backed by an injected wallet.",
  },
  {
    href: "/embedded-swap",
    tag: "Embedded wallet",
    title: "Embedded swap widget",
    description:
      "Swap widget wired to a Privy embedded wallet instead of a browser extension.",
  },
  {
    href: "/embedded-withdraw",
    tag: "Embedded wallet",
    title: "Embedded deposit + withdraw",
    description:
      "Deposit into a Privy embedded wallet with the widget, then withdraw headlessly with the SDK core API.",
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>Trustware</p>
        <h1>Integration demos</h1>
        <p className={styles.copy}>
          Five ways to integrate Trustware, each on its own page. Pick one below.
        </p>
      </section>
      <div className={styles.grid}>
        {DEMOS.map((demo) => (
          <Link key={demo.href} href={demo.href} className={styles.card}>
            <span className={styles.tag}>{demo.tag}</span>
            <h2>{demo.title}</h2>
            <p>{demo.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

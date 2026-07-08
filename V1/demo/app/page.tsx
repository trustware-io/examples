import Link from "next/link";
import Reveal from "./components/Reveal";
import RouteSceneClient from "./components/RouteSceneClient";
import styles from "./page.module.css";

const ENGINE_STEPS = [
  { step: "01", label: "Validate", detail: "GET /sdk/validate confirms your API key and config." },
  {
    step: "02",
    label: "Discover",
    detail: "GET /routes/chains and /routes/tokens list what's supported.",
  },
  { step: "03", label: "Quote", detail: "POST /routes/quote prices the move in real time." },
  { step: "04", label: "Route", detail: "POST /routes/route returns a signable transaction." },
  {
    step: "05",
    label: "Settle",
    detail: "Broadcast with your own wallet, then submit the receipt.",
  },
  {
    step: "06",
    label: "Track",
    detail: "GET /route-intent/{id}/status polls it through to completion.",
  },
];

const DATA_APIS = [
  "Balances across every supported chain, or scoped to one",
  "Transaction history, with explorer links attached",
  "Live native and token USD pricing",
];

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
      <section className={styles.hero}>
        <div className={styles.heroScene}>
          <RouteSceneClient />
        </div>
        <div className={styles.heroScrim} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Trustware</p>
          <h1 className={styles.heroTitle}>
            One engine.
            <br />
            Every chain.
          </h1>
          <p className={styles.heroCopy}>
            Trustware quotes, builds, and settles cross-chain moves behind a single API — so
            your product supports any asset, any wallet, any chain, without a bridge
            integration for each one.
          </p>
        </div>
        <span className={styles.scrollCue}>Scroll</span>
      </section>

      <section className={styles.section}>
        <Reveal>
          <p className={styles.sectionEyebrow}>01 — The problem</p>
          <h2 className={styles.sectionTitle}>Multichain is a UX tax</h2>
          <p className={styles.sectionCopy}>
            Every chain is its own island — its own bridges, its own gas token, its own wallet
            quirks. Users juggle all of it just to move value. Builders pay for it twice: a
            separate integration per chain, per bridge, per wallet type, multiplied by every
            asset they want to support.
          </p>
        </Reveal>
      </section>

      <section className={styles.section}>
        <Reveal>
          <p className={styles.sectionEyebrow}>02 — The engine</p>
          <h2 className={styles.sectionTitle}>One routing lifecycle, one API</h2>
          <p className={styles.sectionCopy}>
            The backend behind every SDK call and widget click. Six calls take a transfer from
            intent to settled, on any of the chains and tokens it supports.
          </p>
        </Reveal>
        <div className={styles.stepGrid}>
          {ENGINE_STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 60}>
              <div className={styles.stepCard}>
                <span className={styles.stepNumber}>{s.step}</span>
                <h3>{s.label}</h3>
                <p>{s.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className={styles.dataApis}>
            <p className={styles.dataApisLabel}>Plus read-only data APIs</p>
            <ul>
              {DATA_APIS.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      <section className={styles.section}>
        <Reveal>
          <p className={styles.sectionEyebrow}>03 — The SDK</p>
          <h2 className={styles.sectionTitle}>Ship the engine, not the plumbing</h2>
          <p className={styles.sectionCopy}>
            Two ways in, same engine underneath: a headless core for teams who own their UI,
            or a drop-in widget for teams who don&apos;t want to build one. Both work with
            browser-injected wallets and embedded wallets alike.
          </p>
        </Reveal>
        <div className={styles.sdkGrid}>
          <Reveal>
            <pre className={styles.codeBlock}>
              <code>{`await Trustware.init(config);

const route = await Trustware.buildRoute({
  fromChain, toChain,
  fromToken, toToken,
  fromAmount,
  fromAddress, toAddress,
  slippageBps: 100,
});`}</code>
            </pre>
          </Reveal>
          <Reveal delay={80}>
            <ul className={styles.sdkList}>
              <li>
                <strong>Headless core</strong> — call <code>Trustware.init</code> and{" "}
                <code>Trustware.buildRoute</code> directly, render your own UI.
              </li>
              <li>
                <strong>Drop-in widget</strong> — a full deposit/swap flow in a few lines of
                JSX.
              </li>
              <li>
                <strong>Injected wallets</strong> — MetaMask, Coinbase Wallet, Rabby.
              </li>
              <li>
                <strong>Embedded wallets</strong> — Privy-style, no extension required.
              </li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className={styles.section}>
        <Reveal>
          <p className={styles.sectionEyebrow}>04 — Live demos</p>
          <h2 className={styles.sectionTitle}>See it running</h2>
          <p className={styles.sectionCopy}>
            Five integration paths, each a real page wired to the live SDK. Pick one below.
          </p>
        </Reveal>
        <div className={styles.grid}>
          {DEMOS.map((demo, i) => (
            <Reveal key={demo.href} delay={i * 60}>
              <Link href={demo.href} className={styles.card}>
                <span className={styles.tag}>{demo.tag}</span>
                <h3>{demo.title}</h3>
                <p>{demo.description}</p>
                <span className={styles.cardArrow}>&rarr;</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Trustware</span>
        <div className={styles.footerLinks}>
          <a href="https://docs.trustware.io" target="_blank" rel="noreferrer">
            Docs
          </a>
          <a href="https://www.npmjs.com/package/@trustware/sdk" target="_blank" rel="noreferrer">
            npm
          </a>
          <a href="https://github.com/trustware-io/trustware-sdk" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}

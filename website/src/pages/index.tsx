import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import styles from "./index.module.css";

const features = [
  {
    icon: "🔌",
    title: "Pluggable connectors",
    body: "Wire any backend in minutes — Dummy, WebSocket, SignalR, DirectLine, SSE, HTTP. Or write your own with a 30-line IConnector implementation.",
  },
  {
    icon: "🎨",
    title: "Themable to the pixel",
    body: "Three layers — CSS variables, JSON config, fluent builder. Four window modes (full, popup, side panel, floating). Custom launcher slots.",
  },
  {
    icon: "🪄",
    title: "Generative UI streaming",
    body: "Stream <genui-card>, <genui-form>, <genui-chart>, <genui-table>… inline. Send chunks from your agent; the widget assembles them as they arrive.",
  },
  {
    icon: "🧩",
    title: "Extensions",
    body: "Middleware lifecycle for analytics, transformers, redaction. Register slash commands from inside an extension. Hooks fire in install order.",
  },
  {
    icon: "📦",
    title: "Web Component, framework-free",
    body: "Drop one <script> into any page — React, Vue, Angular, plain HTML. Built on LitElement; uses Shadow DOM so the host page can't leak styles.",
  },
  {
    icon: "🌍",
    title: "i18n built in",
    body: "English & Turkish out of the box. i18next under the hood — extend or override at runtime, even per message-action.",
  },
];

function HomepageHeader() {
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className="container">
        <span className={styles.heroBadge}>Open source · MIT</span>
        <Heading as="h1" className={styles.heroTitle}>
          Chativa
        </Heading>
        <p className={styles.heroTagline}>
          A framework-agnostic, themeable chat widget. Web Components, pluggable
          connectors, and Generative UI streaming — drop a <code>&lt;script&gt;</code>{" "}
          into any page.
        </p>
        <div className={styles.heroButtons}>
          <Link
            className="button button--secondary button--lg"
            to="/getting-started"
          >
            Get started → 5 min
          </Link>
          <Link
            className="button button--outline button--lg"
            style={{ color: "white", borderColor: "white" }}
            href="/sandbox/"
            target="_blank"
          >
            Live sandbox ↗
          </Link>
        </div>
        <pre className={styles.codeBlock}>
          {`<script type="module" src="https://unpkg.com/@chativa/ui/dist/chativa.js"></script>
<chat-bot-button></chat-bot-button>
<chat-iva></chat-iva>`}
        </pre>
      </div>
    </header>
  );
}

function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <Heading as="h2" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          What you get out of the box
        </Heading>
        <p
          style={{
            textAlign: "center",
            color: "var(--ifm-color-emphasis-700)",
            maxWidth: 720,
            margin: "0 auto 2rem",
          }}
        >
          Everything below is included in <code>@chativa/ui</code> +{" "}
          <code>@chativa/core</code>. No additional setup.
        </p>
        <div className={styles.featureGrid}>
          {features.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Chativa — a framework-agnostic, themeable chat widget built on Web Components."
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}

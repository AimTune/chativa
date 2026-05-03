import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const GITHUB_REPO = "https://github.com/AimTune/chativa";
const SITE_URL = "https://chativa.aimtune.dev";
const BASE_URL = "/";

const config: Config = {
  title: "Chativa",
  tagline:
    "A framework-agnostic, themeable chat widget — Web Components + pluggable connectors.",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
    faster: true,
  },

  url: SITE_URL,
  baseUrl: BASE_URL,

  organizationName: "AimTune",
  projectName: "chativa",
  trailingSlash: false,

  onBrokenLinks: "warn",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
      onBrokenMarkdownImages: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          editUrl: `${GITHUB_REPO}/edit/main/website/`,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/chativa-social-card.png",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Chativa",
      logo: {
        alt: "Chativa logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docs",
          position: "left",
          label: "Docs",
        },
        {
          to: "/concepts",
          position: "left",
          label: "Concepts",
        },
        {
          to: "/connectors/overview",
          position: "left",
          label: "Connectors",
        },
        {
          to: "/genui/overview",
          position: "left",
          label: "Generative UI",
        },
        {
          href: "/sandbox/",
          label: "Sandbox",
          position: "right",
          target: "_blank",
        },
        {
          href: GITHUB_REPO,
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Getting started", to: "/getting-started" },
            { label: "Concepts", to: "/concepts" },
            { label: "Architecture", to: "/architecture" },
            { label: "Configuration", to: "/configuration" },
          ],
        },
        {
          title: "Reference",
          items: [
            { label: "Connectors", to: "/connectors/overview" },
            { label: "Message types", to: "/message-types/overview" },
            { label: "Generative UI", to: "/genui/overview" },
            { label: "Extensions", to: "/extensions" },
          ],
        },
        {
          title: "More",
          items: [
            { label: "Sandbox", href: "/sandbox/" },
            { label: "GitHub", href: GITHUB_REPO },
            { label: "Issues", href: `${GITHUB_REPO}/issues` },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Hamza Agar — Chativa is MIT licensed.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "diff", "csharp"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

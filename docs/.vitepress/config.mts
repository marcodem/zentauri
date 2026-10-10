import extensiblePlugin from "markdown-it-extensible";
import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Zentauri",
  base: "/zentauri/",
  cleanUrls: true,
  head: [
    [
      "link",
      { rel: "icon", type: "image/png", href: "/zentauri/birchville_logo.png" },
    ],
    ["meta", { name: "theme-color", content: "#03192e" }],
  ],
  markdown: {
    config: (md) => {
      md.use(extensiblePlugin);
    },
  },
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      description:
        "Technical Documentation & Wiki for Zentauri — Native Scholarly Markdown Editor",
      themeConfig: {
        nav: [
          { text: "Home", link: "/" },
          { text: "Installation", link: "/installation" },
          { text: "User Guide", link: "/user-guide" },
          { text: "Architecture", link: "/system-architecture" },
          { text: "Features", link: "/scholarly-features" },
          { text: "Roadmap", link: "/roadmap" },
          { text: "Release Notes", link: "/release-notes" },
          { text: "GitHub", link: "https://github.com/marcodem/zentauri" },
        ],
        sidebar: [
          {
            text: "Getting Started",
            collapsed: false,
            items: [
              { text: "Overview (Home)", link: "/" },
              { text: "Installation & Setup", link: "/installation" },
              { text: "User Guide", link: "/user-guide" },
            ],
          },
          {
            text: "Architecture & Specifications",
            collapsed: false,
            items: [
              { text: "System Architecture", link: "/system-architecture" },
              {
                text: "Sanskrit Input Architecture",
                link: "/scholarly-input-architecture",
              },
              { text: "Scholarly Features", link: "/scholarly-features" },
              { text: "Roadmap & Backlog", link: "/roadmap" },
              { text: "Release Notes", link: "/release-notes" },
            ],
          },
          {
            text: "Resources & Links",
            collapsed: false,
            items: [
              {
                text: "GitHub Repository",
                link: "https://github.com/marcodem/zentauri",
              },
              {
                text: "Releases & Downloads",
                link: "https://github.com/marcodem/zentauri/releases",
              },
            ],
          },
        ],
        footer: {
          message: "Zentauri • Native Scholarly Markdown Editor",
          copyright: "Birchville Standard • Scholarly Synthesis",
        },
      },
    },
    de: {
      label: "Deutsch",
      lang: "de-DE",
      link: "/de/",
      description:
        "Technische Dokumentation & Wiki für Zentauri — Nativer wissenschaftlicher Markdown-Editor",
      themeConfig: {
        nav: [
          { text: "Startseite", link: "/de/" },
          { text: "Installation", link: "/de/installation" },
          { text: "Benutzerhandbuch", link: "/de/user-guide" },
          { text: "Architektur", link: "/de/system-architecture" },
          { text: "Funktionen", link: "/de/scholarly-features" },
          { text: "Roadmap", link: "/de/roadmap" },
          { text: "Release Notes", link: "/de/release-notes" },
          { text: "GitHub", link: "https://github.com/marcodem/zentauri" },
        ],
        sidebar: [
          {
            text: "Erste Schritte",
            collapsed: false,
            items: [
              { text: "Übersicht (Startseite)", link: "/de/" },
              { text: "Installation & Setup", link: "/de/installation" },
              { text: "Benutzerhandbuch", link: "/de/user-guide" },
            ],
          },
          {
            text: "Architektur & Spezifikation",
            collapsed: false,
            items: [
              { text: "System-Architektur", link: "/de/system-architecture" },
              {
                text: "Sanskrit-Eingabearchitektur",
                link: "/de/scholarly-input-architecture",
              },
              {
                text: "Wissenschaftliche Features",
                link: "/de/scholarly-features",
              },
              { text: "Roadmap & Backlog", link: "/de/roadmap" },
              { text: "Release Notes", link: "/de/release-notes" },
            ],
          },
          {
            text: "Ressourcen & Links",
            collapsed: false,
            items: [
              {
                text: "GitHub Repository",
                link: "https://github.com/marcodem/zentauri",
              },
              {
                text: "Releases & Downloads",
                link: "https://github.com/marcodem/zentauri/releases",
              },
            ],
          },
        ],
        footer: {
          message: "Zentauri • Nativer wissenschaftlicher Markdown-Editor",
          copyright: "Birchville Standard • Scholarly Synthesis",
        },
      },
    },
  },
  themeConfig: {
    outline: false,
    logo: "/birchville_logo.png",
    logoLink: "https://birchville.org",
    siteTitle: "Zentauri",
    socialLinks: [
      { icon: "github", link: "https://github.com/marcodem/zentauri" },
    ],
  },
});

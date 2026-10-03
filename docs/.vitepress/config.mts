import { defineConfig } from 'vitepress'
import extensiblePlugin from 'markdown-it-extensible'

export default defineConfig({
  title: 'Zentauri',
  description: 'Technical Documentation & Wiki for Zentauri — Native Scholarly Markdown Editor',
  base: '/zentauri/',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/zentauri/birchville_logo.png' }],
    ['meta', { name: 'theme-color', content: '#03192e' }]
  ],
  markdown: {
    config: (md) => {
      md.use(extensiblePlugin)
    }
  },
  themeConfig: {
    outline: false,
    logo: '/birchville_logo.png',
    siteTitle: 'Zentauri',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Installation', link: '/installation' },
      { text: 'User Guide', link: '/user-guide' },
      { text: 'Architecture', link: '/system-architecture' },
      { text: 'Features', link: '/scholarly-features' },
      { text: 'Release Notes', link: '/release-notes' },
      { text: 'GitHub', link: 'https://github.com/marcodem/zentauri' }
    ],
    sidebar: [
      {
        text: 'Erste Schritte',
        collapsed: false,
        items: [
          { text: 'Übersicht (Home)', link: '/' },
          { text: 'Installation & Setup', link: '/installation' },
          { text: 'Benutzerhandbuch', link: '/user-guide' }
        ]
      },
      {
        text: 'Architektur & Spezifikation',
        collapsed: false,
        items: [
          { text: 'System-Architektur', link: '/system-architecture' },
          { text: 'Scholarly Features', link: '/scholarly-features' },
          { text: 'Release Notes', link: '/release-notes' }
        ]
      },
      {
        text: 'Ressourcen & Links',
        collapsed: false,
        items: [
          { text: 'GitHub Repository', link: 'https://github.com/marcodem/zentauri' },
          { text: 'Releases & Downloads', link: 'https://github.com/marcodem/zentauri/releases' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/marcodem/zentauri' }
    ],
    footer: {
      message: 'Zentauri • Native Scholarly Markdown Editor',
      copyright: 'Birchville Standard • Scholarly Synthesis'
    }
  }
})

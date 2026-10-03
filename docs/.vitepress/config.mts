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
    logo: '/birchville_logo.png',
    siteTitle: 'Zentauri',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'System Architecture', link: '/system-architecture' },
      { text: 'Scholarly Features', link: '/scholarly-features' },
      { text: 'GitHub', link: 'https://github.com/marcodem/zentauri' }
    ],
    sidebar: [
      {
        text: 'Dokumentation',
        collapsed: false,
        items: [
          { text: 'Übersicht (Home)', link: '/' },
          { text: 'System-Architektur', link: '/system-architecture' },
          { text: 'Scholarly Features', link: '/scholarly-features' }
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

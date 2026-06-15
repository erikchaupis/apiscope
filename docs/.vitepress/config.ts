import { defineConfig } from 'vitepress';

// Local dev defaults to `/`. CI sets VITEPRESS_BASE=/apiscope/ for GitHub project Pages.
// When getapiscope.com DNS is live, set VITEPRESS_BASE=/ in docs.yml instead.
const base = process.env.VITEPRESS_BASE ?? '/';

export default defineConfig({
  title: 'APIScope',
  description: 'Source-code-aware API client for VS Code and Cursor',
  lang: 'en-US',
  base,
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', href: '/logo.png', type: 'image/png' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#0B1628' }],
    ['meta', { property: 'og:image', content: 'https://getapiscope.com/logo.png' }],
    ['meta', { property: 'og:site_name', content: 'APIScope' }],
  ],
  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'APIScope',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Specifications', link: '/specification/' },
      {
        text: 'GitHub',
        link: 'https://github.com/erikchaupis/apiscope',
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Using APIScope',
          items: [
            { text: 'Collections', link: '/guide/collections' },
            { text: 'Scanning Endpoints', link: '/guide/scanning' },
            { text: 'Environments', link: '/guide/environments' },
            { text: 'Runtime Variables', link: '/guide/runtime-variables' },
            { text: 'Authentication', link: '/guide/authentication' },
            { text: 'Sending Requests', link: '/guide/requests' },
            { text: 'History & Drafts', link: '/guide/history' },
            { text: 'Themes', link: '/guide/themes' },
            { text: 'Commands Reference', link: '/guide/commands' },
          ],
        },
      ],
      '/specification/': [
        {
          text: 'Specifications',
          items: [
            { text: 'Overview', link: '/specification/' },
            { text: 'Workspace v1', link: '/specification/workspace/v1/' },
            { text: 'History v2', link: '/specification/history/v2/' },
            { text: 'Collection Export', link: '/specification/collection-export/v1/' },
            { text: 'Architecture Decisions', link: '/specification/adr/' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/erikchaupis/apiscope' },
    ],
    footer: {
      message: 'Apache-2.0 Licensed',
      copyright: 'Copyright © Erik Chaupis',
    },
    search: {
      provider: 'local',
    },
  },
});

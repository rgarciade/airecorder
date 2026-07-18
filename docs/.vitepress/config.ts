import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'AIRecorder',
  description: 'AI-powered audio recorder and transcription tool',
  base: '/airecorder/vp/',

  srcDir: './vp-src',
  outDir: './vp',

  // Shared settings (all locales)
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    logo: '/icon.png',
    outline: 'deep',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/rgarciade/airecorder' }
    ],
    search: {
      provider: 'local'
    }
  },

  locales: {
    root: {
      label: 'Español',
      lang: 'es',
      link: '/',
      title: 'AIRecorder',
      description: 'Documentación de AIRecorder',
      themeConfig: {
        nav: [
          { text: '← AIRecorder', link: 'https://rgarciade.github.io/airecorder/' },
          { text: 'Guía', link: '/guide/' },
          { text: 'Referencia', link: '/reference/' },
          { text: 'Changelog', link: 'https://rgarciade.github.io/airecorder/changelog.html' }
        ],
        sidebar: {
          '/guide/': [
            {
              text: 'Guía de Usuario',
              items: [
                { text: 'Inicio', link: '/guide/' },
            { text: 'Añadir Contenido', link: '/guide/recording' },
            { text: 'Transcripción', link: '/guide/transcription' },
            { text: 'Chat IA', link: '/guide/chat' },
            { text: 'Esquema', link: '/guide/schema' },
            { text: 'Exportar', link: '/guide/export' },
            { text: 'Proyectos', link: '/guide/projects' },
            { text: 'Hablantes', link: '/guide/speakers' },
            { text: 'IA Local', link: '/guide/local-ai' },
            { text: 'IA en la Nube', link: '/guide/cloud-ai' },
            { text: 'Conexiones Personalizadas', link: '/guide/custom-ai' },
            { text: 'Ajustes', link: '/guide/settings' },
            { text: 'FAQ', link: '/guide/faq' }
              ]
            }
          ],
          '/reference/': [
            {
              text: 'Referencia Técnica',
              items: [
                { text: 'Índice', link: '/reference/' },
                { text: 'Arquitectura', link: '/reference/architecture' },
                { text: 'RAG', link: '/reference/rag' },
                { text: 'Diarización', link: '/reference/diarization' },
                { text: 'Prompts', link: '/reference/prompts' },
                { text: 'Contribuir', link: '/reference/contributing' }
              ]
            }
          ]
        },
        footer: {
          message: 'Toma el control de tus reuniones y proyectos. Todo en local, todo privado.',
          copyright: '© 2024–2026 AIRecorder · Desarrollado por Raul Garcia'
        }
      }
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      title: 'AIRecorder',
      description: 'AIRecorder documentation',
      themeConfig: {
        nav: [
          { text: '← AIRecorder', link: 'https://rgarciade.github.io/airecorder/' },
          { text: 'Guide', link: '/en/guide/' },
          { text: 'Reference', link: '/en/reference/' },
          { text: 'Changelog', link: 'https://rgarciade.github.io/airecorder/changelog.html' }
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'User Guide',
              items: [
                { text: 'Home', link: '/en/guide/' },
              { text: 'Adding Content', link: '/en/guide/recording' },
              { text: 'Transcription', link: '/en/guide/transcription' },
              { text: 'AI Chat', link: '/en/guide/chat' },
              { text: 'Schema', link: '/en/guide/schema' },
              { text: 'Export', link: '/en/guide/export' },
              { text: 'Projects', link: '/en/guide/projects' },
              { text: 'Speakers', link: '/en/guide/speakers' },
              { text: 'Local AI', link: '/en/guide/local-ai' },
              { text: 'Cloud AI', link: '/en/guide/cloud-ai' },
              { text: 'Custom Connections', link: '/en/guide/custom-ai' },
              { text: 'Settings', link: '/en/guide/settings' },
              { text: 'FAQ', link: '/en/guide/faq' }
              ]
            }
          ],
          '/en/reference/': [
            {
              text: 'Technical Reference',
              items: [
                { text: 'Index', link: '/en/reference/' },
                { text: 'Architecture', link: '/en/reference/architecture' },
                { text: 'RAG', link: '/en/reference/rag' },
                { text: 'Diarization', link: '/en/reference/diarization' },
                { text: 'Prompts', link: '/en/reference/prompts' },
                { text: 'Contributing', link: '/en/reference/contributing' }
              ]
            }
          ]
        },
        footer: {
          message: 'Take control of your meetings and projects. All local, all private.',
          copyright: '© 2024–2026 AIRecorder · Built by Raul Garcia'
        }
      }
    }
  },

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/airecorder/icon.png' }]
  ]
})

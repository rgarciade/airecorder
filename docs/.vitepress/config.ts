import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitepress'

// ============================================================
// SEO helpers — shared by transformPageData (per-page canonical /
// hreflang / OG tags) and buildEnd (sitemap.xml generation), so the
// es<->en URL pairing logic lives in exactly one place.
// ============================================================

const SITE_ORIGIN = 'https://rgarciade.github.io/airecorder'
const WIKI_BASE = `${SITE_ORIGIN}/vp/`
const SITE_NAME = 'AIRecorder'
const OG_IMAGE = `${SITE_ORIGIN}/icon.png`

// Mirrors VitePress's own internal route-normalization regex (see
// INDEX_OR_EXT_RE in vitepress/dist/node/chunk-*.js): strips a trailing
// "index.md" (collapsing to the parent directory) or a bare ".md"
// extension, matching exactly how `cleanUrls: true` resolves real URLs.
// e.g. "index.md" -> "", "guide/index.md" -> "guide/", "guide/faq.md" -> "guide/faq"
const INDEX_OR_EXT_RE = /(?:(^|\/)index)?\.md$/

/**
 * Given a page's `relativePath` (as found on `pageData.relativePath` in
 * transformPageData, or as an entry of `siteConfig.pages` in buildEnd —
 * both share the exact same "path/relative/to/srcDir.md" format), resolve
 * its locale, its clean route, and the canonical + es/en sibling URLs.
 */
function resolvePageMeta(relativePath: string) {
  const route = relativePath.replace(INDEX_OR_EXT_RE, '$1')
  const locale: 'es' | 'en' = route === 'en' || route.startsWith('en/') ? 'en' : 'es'
  const bareRoute = locale === 'en' ? route.slice(3) : route // strips "en/"
  const es = `${WIKI_BASE}${bareRoute}`
  const en = `${WIKI_BASE}en/${bareRoute}`
  const canonical = locale === 'en' ? en : es
  return { route, bareRoute, locale, canonical, es, en }
}

/** Priority/changefreq convention carried over from the previous hand-written sitemap. */
function computeSeoWeight(bareRoute: string, locale: 'es' | 'en') {
  let priority: number
  let changefreq: 'weekly' | 'monthly'

  if (bareRoute === '') {
    priority = 0.9
    changefreq = 'weekly'
  } else if (bareRoute === 'guide/') {
    priority = 0.8
    changefreq = 'weekly'
  } else if (bareRoute === 'reference/') {
    priority = 0.6
    changefreq = 'monthly'
  } else if (bareRoute.startsWith('guide/')) {
    priority = bareRoute === 'guide/local-ai' ? 0.8 : 0.7
    changefreq = 'weekly'
  } else if (bareRoute.startsWith('reference/')) {
    priority = 0.5
    changefreq = 'monthly'
  } else {
    priority = 0.5
    changefreq = 'monthly'
  }

  // English pages mirror their Spanish counterpart one tier down, same
  // convention the previous manual sitemap already used (e.g. es guide
  // subpages 0.7 -> en guide subpages 0.6).
  if (locale === 'en') priority = Math.round((priority - 0.1) * 10) / 10

  return { priority: priority.toFixed(1), changefreq }
}

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
  ],

  // FIX 1: inject canonical + hreflang + OG/Twitter tags into every page's
  // frontmatter.head (VitePress merges this array into the real <head>).
  transformPageData(pageData) {
    // Skip the virtual "not found" page — it has no real route to canonicalize.
    if (pageData.isNotFound || pageData.relativePath === '404.md') return

    const { locale, canonical, es, en } = resolvePageMeta(pageData.relativePath)
    const frontmatter = pageData.frontmatter

    const title = frontmatter.title || pageData.title || SITE_NAME
    const ogTitle = title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`
    const description =
      frontmatter.description ||
      pageData.description ||
      (locale === 'en' ? 'AIRecorder documentation' : 'Documentación de AIRecorder')
    const ogLocale = locale === 'en' ? 'en_US' : 'es_ES'

    frontmatter.head ??= []
    frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonical }],
      // Self-referencing entry is mandatory in hreflang sets, not just the sibling.
      ['link', { rel: 'alternate', hreflang: 'es', href: es }],
      ['link', { rel: 'alternate', hreflang: 'en', href: en }],
      ['link', { rel: 'alternate', hreflang: 'x-default', href: es }],
      ['meta', { property: 'og:title', content: ogTitle }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: canonical }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:image', content: OG_IMAGE }],
      ['meta', { property: 'og:locale', content: ogLocale }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: ogTitle }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:image', content: OG_IMAGE }]
    )
  },

  // FIX 2: regenerate docs/sitemap.xml (covers the whole site, not just the
  // VitePress wiki) from the actual page list on every build — no manual drift.
  buildEnd(siteConfig) {
    const today = new Date().toISOString().slice(0, 10)

    const wikiPages = siteConfig.pages
      .map((relativePath) => {
        const meta = resolvePageMeta(relativePath)
        const { priority, changefreq } = computeSeoWeight(meta.bareRoute, meta.locale)
        return { ...meta, priority, changefreq }
      })
      .sort((a, b) => a.canonical.localeCompare(b.canonical))

    const staticEntries = [
      { loc: `${SITE_ORIGIN}/`, changefreq: 'weekly', priority: '1.0' },
      { loc: `${SITE_ORIGIN}/changelog.html`, changefreq: 'monthly', priority: '0.6' }
    ]

    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    ]

    for (const entry of staticEntries) {
      lines.push(
        '  <url>',
        `    <loc>${entry.loc}</loc>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>'
      )
    }

    for (const page of wikiPages) {
      lines.push(
        '  <url>',
        `    <loc>${page.canonical}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${page.changefreq}</changefreq>`,
        `    <priority>${page.priority}</priority>`,
        `    <xhtml:link rel="alternate" hreflang="es" href="${page.es}"/>`,
        `    <xhtml:link rel="alternate" hreflang="en" href="${page.en}"/>`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${page.es}"/>`,
        '  </url>'
      )
    }

    lines.push('</urlset>', '')

    // outDir is docs/vp — sitemap.xml must live at docs/sitemap.xml (site root)
    const sitemapPath = path.resolve(siteConfig.outDir, '../sitemap.xml')
    fs.writeFileSync(sitemapPath, lines.join('\n'), 'utf-8')
  }
})

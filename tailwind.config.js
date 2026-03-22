/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        surface: {
          primary:   'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary:  'var(--color-bg-tertiary)',
          hover:     'var(--color-bg-hover)',
          active:    'var(--color-bg-active)',
          input:     'var(--color-bg-input)',
        },
        content: {
          primary:   'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary:  'var(--color-text-tertiary)',
          muted:     'var(--color-text-muted)',
          heading:   'var(--color-text-heading)',
          inverse:   'var(--color-text-inverse)',
        },
        edge: {
          primary:   'var(--color-border-primary)',
          secondary: 'var(--color-border-secondary)',
          subtle:    'var(--color-border-subtle)',
        },
        brand: {
          DEFAULT: 'var(--color-primary)',
          hover:   'var(--color-primary-hover)',
          light:   'var(--color-primary-light)',
          bg:      'var(--color-primary-bg)',
        },
      },
    },
  },
  plugins: [],
}

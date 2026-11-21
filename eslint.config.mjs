import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Reglas de estilo/higiene: warn con baseline (--max-warnings en el script lint).
// Reglas de corrección (no-undef, rules-of-hooks): error.
const stylisticWarnings = {
  'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-empty': 'warn',
  'no-useless-escape': 'warn',
  'no-control-regex': 'warn',
  'no-redeclare': ['warn', { builtinGlobals: false }],
}

export default [
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'electron-dist/**',
      'python-dist/**',
      'venv/**',
      '.venv/**',
      'node_modules/**',
      'coverage/**',
      'build/**',
      'web-docs/**',
      'python/**',
      'docs/**',
      'public/**',
      '.claude/**',
      '.engram/**',
      '.scratch/**',
      '.github/**',
    ],
  },
  js.configs.recommended,
  { rules: stylisticWarnings },

  // Proceso principal de Electron y scripts: CommonJS + Node
  {
    files: ['electron/**/*.js', 'scripts/**/*.js', 'debug_duration.js', 'postcss.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },

  // Renderer: ESM + navegador + React
  {
    files: ['src/**/*.{js,jsx,mjs}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Tests y configs: ESM + Node (vitest se importa de forma explícita)
  {
    files: ['test/**/*.{js,jsx,mjs}', 'src/tests/**/*.{js,jsx,mjs}', '*.config.js', '*.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // postcss.config.js es CommonJS (se declara después para que prevalezca)
  {
    files: ['postcss.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
]

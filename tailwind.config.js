import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';
import typographyPlugin from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,json,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontSize: {
        // Add default line heights for heading sizes
        '4xl': ['2.25rem', { lineHeight: '1.25' }],
        '5xl': ['3rem', { lineHeight: '1.25' }],
        '6xl': ['3.75rem', { lineHeight: '1.25' }],
        '7xl': ['4.5rem', { lineHeight: '1.25' }],
        '8xl': ['6rem', { lineHeight: '1.25' }],
        '9xl': ['8rem', { lineHeight: '1.25' }],
      },
      colors: {
        primary: 'var(--aw-color-primary)',
        secondary: 'var(--aw-color-secondary)',
        accent: 'var(--aw-color-accent)',
        default: 'var(--aw-color-text-default)',
        muted: 'var(--aw-color-text-muted)',
        'terminal': {
          100: 'var(--terminal-100)',
          200: 'var(--terminal-200)',
          300: 'var(--terminal-300)',
          400: 'var(--terminal-400)',
          500: 'var(--terminal-500)',
          600: 'var(--terminal-600)',
          700: 'var(--terminal-700)',
          bright: 'var(--terminal-bright)',
        },
        'terminal-bg': {
          primary: 'var(--terminal-bg-primary)',
          secondary: 'var(--terminal-bg-secondary)',
          accent: 'var(--terminal-bg-accent)',
        }
      },
      fontFamily: {
        sans: ['var(--aw-font-sans, ui-sans-serif)', ...defaultTheme.fontFamily.sans],
        serif: ['var(--aw-font-serif, ui-serif)', ...defaultTheme.fontFamily.serif],
        heading: ['var(--aw-font-heading, ui-sans-serif)', ...defaultTheme.fontFamily.sans],
        'share-tech': ['"Share Tech Mono"', 'monospace'],
        'vt323': ['VT323', 'monospace'],
        'cmd': ['"Windows Command Prompt"', 'monospace'],
        'vermin': ['"Vermin Vibes"', 'sans-serif'],
        'nasalization': ['Nasalization', 'sans-serif'],
        'kode': ['"Kode Mono"', 'monospace'],
        'uav-mono': ['"UAV OSD Mono"', 'monospace'],
        'uav-sans': ['"UAV OSD Sans"', 'monospace'],
        'computer': ['Computerfont', 'monospace'],
      },

      animation: {
        fade: 'fadeInUp 1s both',
      },

      keyframes: {
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(2rem)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    typographyPlugin,
    plugin(({ addVariant }) => {
      addVariant('intersect', '&:not([no-intersect])');
    }),
  ],
  darkMode: 'class',
};

import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#BD93F9', // Dracula purple
          600: '#A779E9',
          700: '#8B5CF6'
        },
        accent: '#FF79C6', // neon pink
        success: '#50FA7B',
        danger: '#FF5555',
        cyber: {
          900: '#0B1020',
          800: '#0F172A',
          700: '#101132',
          600: '#1E1E2E'
        }
      },
      fontFamily: {
        mono: ["'JetBrainsMono NF'", "'FiraCode Nerd Font'", "'Cascadia Code'", "'JetBrains Mono'", "'Fira Code'", 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'monospace'],
        sans: ["'Inter var'", 'Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans']
      }
    }
  },
  plugins: [typography]
}

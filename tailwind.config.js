/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark mode foundation
        bg: {
          primary: '#0A0A0F',
          secondary: '#121218',
          tertiary: '#1A1A24',
          hover: '#22222E',
        },
        // Neon accents (harder-styles energy)
        accent: {
          primary: '#FF00FF',
          secondary: '#00FFFF',
          tertiary: '#FF3366',
          success: '#00FF88',
          warning: '#FFAA00',
          error: '#FF0055',
        },
        // Text colors
        text: {
          primary: '#FFFFFF',
          secondary: '#B8B8C8',
          tertiary: '#6B6B7B',
          disabled: '#3A3A45',
        },
        // BPM range colors
        bpm: {
          euphoric: '#00D4FF',
          raw: '#FF00AA',
          hardcore: '#FF0044',
          uptempo: '#AA00FF',
        },
        // Tag colors
        tag: {
          red: '#FF4466',
          orange: '#FF8833',
          yellow: '#FFD700',
          green: '#00FF88',
          cyan: '#00FFDD',
          blue: '#0088FF',
          purple: '#AA00FF',
          pink: '#FF00CC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['SF Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: '11px',
        sm: '12px',
        base: '14px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        lg: '8px',
        xl: '12px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        DEFAULT: '0 4px 12px rgba(0, 0, 0, 0.4)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
        xl: '0 16px 48px rgba(0, 0, 0, 0.6)',
        'glow-magenta': '0 8px 24px rgba(255, 0, 255, 0.4)',
        'glow-cyan': '0 8px 24px rgba(0, 255, 255, 0.4)',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.645, 0.045, 0.355, 1) infinite',
      },
    },
  },
  plugins: [],
}

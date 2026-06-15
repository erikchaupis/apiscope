/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--as-background)',
        foreground: 'var(--as-foreground)',
        border: 'var(--as-border)',
        ring: 'var(--as-ring)',
        primary: {
          DEFAULT: 'var(--as-primary)',
          foreground: 'var(--as-primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--as-accent)',
          foreground: 'var(--as-accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--as-accent)',
          foreground: 'var(--as-muted)',
        },
        accent: {
          DEFAULT: 'var(--as-accent)',
          foreground: 'var(--as-accent-foreground)',
        },
        card: {
          DEFAULT: 'var(--as-surface)',
          foreground: 'var(--as-foreground)',
        },
        success: 'var(--as-success)',
        warning: 'var(--as-warning)',
        danger: 'var(--as-danger)',
        'brand-orange': 'var(--as-brand-orange)',
        'warning-foreground': 'var(--as-foreground)',
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
};

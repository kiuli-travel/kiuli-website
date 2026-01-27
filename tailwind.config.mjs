import tailwindcssAnimate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  plugins: [tailwindcssAnimate, typography],
  prefix: '',
  safelist: [
    'lg:col-span-4',
    'lg:col-span-6',
    'lg:col-span-8',
    'lg:col-span-12',
    'border-border',
    'bg-card',
    'border-error',
    'bg-error/30',
    'border-success',
    'bg-success/30',
    'border-warning',
    'bg-warning/30',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',    // 16px mobile
        sm: '1.5rem',       // 24px
        md: '2rem',         // 32px
        lg: '2rem',
        xl: '2rem',
        '2xl': '2rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1200px',       // Kiuli max container
        '2xl': '1320px',    // Kiuli large container
      },
    },
    extend: {
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        background: 'hsl(var(--background))',
        border: 'hsla(var(--border))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        foreground: 'hsl(var(--foreground))',
        input: 'hsl(var(--input))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        ring: 'hsl(var(--ring))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        success: 'hsl(var(--success))',
        error: 'hsl(var(--error))',
        warning: 'hsl(var(--warning))',
        kiuli: {
          teal: '#486A6A',
          'teal-light': 'rgba(72, 106, 106, 0.10)',
          clay: '#DA7A5A',
          'clay-hover': '#C46B4D',
          charcoal: '#404040',
          gray: '#DADADA',
          ivory: '#F5F3EB',
        },
      },
      fontFamily: {
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
        heading: ['General Sans', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        body: ['Satoshi', 'system-ui', 'sans-serif'],
        accent: ['Waterfall', 'cursive'],
        mono: ['var(--font-geist-mono)'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      typography: () => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': '#404040',
            '--tw-prose-headings': '#404040',
            fontFamily: 'Satoshi, system-ui, sans-serif',
            fontWeight: '300',
            lineHeight: '1.5',
            a: {
              color: '#DA7A5A',
              textDecoration: 'none',
              textUnderlineOffset: '3px',
              '&:hover': {
                textDecoration: 'underline',
              },
              '&:focus-visible': {
                outline: '2px solid #486A6A',
                outlineOffset: '2px',
              },
            },
            h1: {
              fontFamily: 'General Sans, system-ui, sans-serif',
              fontWeight: '700',
              letterSpacing: '0.11em',
              lineHeight: '1.17',
              fontSize: '2rem', // 32px mobile-first
              marginBottom: '0.25em',
            },
            h2: {
              fontFamily: 'General Sans, system-ui, sans-serif',
              fontWeight: '600',
              letterSpacing: '0',
              lineHeight: '1.22',
              fontSize: '1.75rem', // 28px mobile-first
            },
            h3: {
              fontFamily: 'General Sans, system-ui, sans-serif',
              fontWeight: '600',
              lineHeight: '1.33',
              fontSize: '1.25rem', // 20px mobile-first
            },
            h4: {
              fontFamily: 'General Sans, system-ui, sans-serif',
              fontWeight: '500',
              lineHeight: '1.40',
              fontSize: '1.125rem', // 18px mobile-first
            },
          },
        },
        sm: {
          css: {
            h1: { fontSize: '2.5rem' },   // 40px
            h2: { fontSize: '2rem' },     // 32px
            h3: { fontSize: '1.375rem' }, // 22px
          },
        },
        lg: {
          css: {
            h1: { fontSize: '3rem' },     // 48px
            h2: { fontSize: '2.25rem' },  // 36px
            h3: { fontSize: '1.5rem' },   // 24px
            h4: { fontSize: '1.25rem' },  // 20px
          },
        },
      }),
    },
  },
}

export default config

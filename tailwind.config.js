/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  // hover: styles only where a real hover exists, so taps don't leave sticky hover states.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      // Semantic colour roles (values live in src/index.css, per theme). See DESIGN.md → Colors.
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        raised: token('raised'),
        overlay: token('overlay'),
        line: token('line'),
        'line-strong': token('line-strong'),
        control: token('control'),
        ink: token('ink'),
        muted: token('muted'),
        faint: token('faint'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        danger: token('danger'),
        warning: token('warning'),
        success: token('success'),
        atlas: token('atlas'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Monospace is only for the voice HUD and keyboard hints; the system face, nothing to download.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        control: '10px',
        card: '14px',
        sheet: '20px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        button: 'var(--shadow-button)',
        pop: 'var(--shadow-pop)',
        modal: 'var(--shadow-modal)',
      },
      // Motion tokens (plans/001). Strong ease-out for UI; drawer curve for sheets and side panels.
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: { press: '160ms', fast: '150ms', base: '200ms' },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        'check-pop': { from: { transform: 'scale(0.6)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'menu-pop': { from: { transform: 'scale(0.97)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both',
        // Opacity only: for content that changes in place (inline errors) and for reduced motion.
        fade: 'fade 150ms ease-out both',
        // A checked mark settles in: the app's most rewarding moment, kept short.
        'check-pop': 'check-pop 160ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'sheet-up': 'sheet-up 260ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'menu-pop': 'menu-pop 150ms cubic-bezier(0.23, 1, 0.32, 1) both',
      },
    },
  },
  plugins: [],
};

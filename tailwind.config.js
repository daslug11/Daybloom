/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(8vw, -6vh) scale(1.1)' },
          '66%': { transform: 'translate(-6vw, 5vh) scale(0.95)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        drift: 'drift 28s ease-in-out infinite',
        'drift-slow': 'drift 40s ease-in-out infinite reverse',
        shimmer: 'shimmer 6s linear infinite',
      },
    },
  },
  plugins: [],
};

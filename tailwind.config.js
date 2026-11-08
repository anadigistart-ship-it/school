/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef3fb', 100: '#d9e4f5', 200: '#b5c9ea', 300: '#86a3d8',
          400: '#5679c2', 500: '#3b5eab', 600: '#2d4a8f', 700: '#243b73',
          800: '#1b2d5a', 900: '#12204a', 950: '#0a1330',
        },
        royal: { 500: '#2563eb', 600: '#1d4ed8', 700: '#1e40af' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(18,32,74,.06), 0 4px 16px rgba(18,32,74,.06)',
      },
    },
  },
  plugins: [],
}

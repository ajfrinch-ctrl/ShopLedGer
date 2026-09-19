/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f5ee',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#10a37f',
          600: '#06806a',
          700: '#04795a',
          800: '#065f46',
          900: '#134e4a',
        },
        shop: {
          green: '#04795a',
          mint: '#eefaf6',
          light: '#e6f5ee',
        }
      },
      fontFamily: {
        bangla: ['Noto Sans Bengali', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

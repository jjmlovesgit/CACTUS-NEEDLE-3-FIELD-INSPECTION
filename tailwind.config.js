/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          900: '#0B0F17',
          800: '#121824',
          700: '#1C2536',
          600: '#2D394E',
          500: '#475569',
          accent: '#06B6D4',
          warning: '#F59E0B',
          danger: '#EF4444',
          success: '#10B981'
        }
      }
    },
  },
  plugins: [],
}

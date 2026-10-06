/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: '#E5484D',
          dark: '#C93B40',
        },
        navy: {
          DEFAULT: '#1F2A44',
          light: '#2A3A5C',
        },
      },
    },
  },
  plugins: [],
}

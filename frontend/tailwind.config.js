/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6B8E7D',
        'primary-light': '#E8F3EE',
        secondary: '#F4A261',
        surface: '#FAFAF8',
        muted: '#94A3B8',
        'text-main': '#2D3436',
        'text-sub': '#636E72',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

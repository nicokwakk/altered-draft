/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ax: '#894b33',  // Axiom — brown/orange
        br: '#9e3c40',  // Bravos — dark red
        ly: '#d89da3',  // Lyra — pink/rose
        mu: '#3f9085',  // Muna — teal
        or: '#00628e',  // Ordis — blue
        yz: '#6d4f95',  // Yzmir — purple
      },
    },
  },
  plugins: [],
}

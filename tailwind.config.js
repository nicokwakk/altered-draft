/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ax: '#4d9de0',  // Axiom — blue
        br: '#e05c3a',  // Bravos — red/orange
        ly: '#5ba85a',  // Lyra — green
        mu: '#9b59b6',  // Muna — purple
        or: '#d4af37',  // Ordis — gold
        yz: '#c2185b',  // Yzmir — pink/magenta
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ax: '#4b8ec8',  // Axiom — blue
        br: '#c84b3c',  // Bravos — red
        ly: '#d4679c',  // Lyra — pink/rose
        mu: '#7b5bb0',  // Muna — purple
        or: '#c8a030',  // Ordis — gold
        yz: '#3aab9b',  // Yzmir — teal
      },
    },
  },
  plugins: [],
}

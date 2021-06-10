module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Libre Baskerville', 'serif'],
        'crimson': ['Crimson Text', 'serif'],
        'orelega': ['Orelega One', 'cursive']
      }
    },
  },
  variants: {
    extend: {
      backgroundColor: ['disabled', 'focus'],
      cursor: ['disabled'],
      textColor: ['disabled']
    },
  },
  plugins: [],
}

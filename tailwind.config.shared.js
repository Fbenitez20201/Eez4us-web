/** @type {Partial<import('tailwindcss').Config>} */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        nunito: ['Nunito'],
        'nunito-bold': ['Nunito-Bold'],
        'nunito-black': ['Nunito-Black'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      colors: {
        brand: {
          green: '#7AD035',
          yellow: '#FFCC1A',
          orange: '#FF8A1A',
          blue: '#2F8AF5',
          purple: '#A93EC4',
          pink: '#F02BB7',
          red: '#FF1F1F',
        },
      },
    },
  },
  plugins: [],
};

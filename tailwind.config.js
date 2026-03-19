/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/ui/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        figma: {
          bg: '#2c2c2c',
          surface: '#383838',
          border: '#4a4a4a',
          text: '#ffffff',
          'text-secondary': '#b3b3b3',
          accent: '#0d99ff',
        },
      },
      fontSize: {
        xs: '11px',
        sm: '12px',
        base: '13px',
      },
    },
  },
  plugins: [],
};

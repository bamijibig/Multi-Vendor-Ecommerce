/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Section canvases from the original template (#F4F5F7 / #F3F5F6).
        canvas: '#F4F5F7',
        paper: '#FFFFFF',
        brand: {
          // #FCBE00 is the template's dominant accent.
          DEFAULT: '#FCBE00',
          dark: '#E9AD00',
          light: '#FFF8DB',
        },
        accent: {
          // #16BCDC drives the template's buttons and links.
          DEFAULT: '#16BCDC',
          dark: '#0FA5C3',
          light: '#E4F8FC',
        },
        navy: {
          // #222 body/heading ink; #263C97 is the template header bar.
          DEFAULT: '#222222',
          light: '#454545',
          dark: '#1F2024',
          header: '#263C97',
        },
        ink: '#222222',
        muted: '#666666',
        subtle: '#999999',
        line: '#E5E5E5',
        sale: '#CC1414',
        stock: '#5AAB19',
      },
      fontFamily: {
        sans: ['Rubik', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Rubik', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['16px', '26px'],
      },
      borderRadius: {
        card: '20px',
      },
      boxShadow: {
        card: '0 5px 30px rgba(0, 0, 0, 0.1)',
        lift: '0 8px 30px rgba(0, 0, 0, 0.14)',
      },
      maxWidth: {
        page: '1320px',
      },
    },
  },
  plugins: [],
};

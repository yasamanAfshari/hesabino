/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.html",
    "./src/**/*.ts",
  ],
  theme: {
    extend: {
      colors: {
        'main-color': '#0062AE',
        'second-color': '#BDD7EA',
      },
    },
  },
  plugins: [],
}

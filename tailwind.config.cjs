/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        mainCyan: "68c7c3",
        alBlue: "263258",
        alDarkBlue: "202151",
      },
    },
  },
  plugins: [],
};

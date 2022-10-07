/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        mainCyan: "#68c7c3",
        alBlue: "#263258",
        alDarkBlue: "#202151",
        grandmaster: "#ffd700",
        nova: "#7d4ac5",
        astra: "#ff1761",
        celestial: "#ffffff",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        oswald: ["Oswald", "sans-serif"],
      },
    },
  },
  plugins: [],
};

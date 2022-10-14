/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        mainCyan: "#68c7c3",
        alBlue: "#263258",
        alDarkBlue: "#202151",
        //
        iron: "#afafaf",
        bronze: "#ff9900",
        silver: "#cbd9e6",
        gold: "#d8bf52",
        platinum: "#2fcfc2",
        diamond: "#b9f2ff",
        jade: "#85fa85",
        master: "#ff66e9",
        grandmaster: "#ffd700",
        nova: "#7d4ac5",
        astra: "#ff1761",
        celestial: "#ffffff",
        //ra colors
        mythic: "#ffd700",
        immortal: "#c36eff",
        archon: "#ff0000",
        ethereal: "#91d7e4",
        divine: "#fff",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        oswald: ["Oswald", "sans-serif"],
      },
    },
  },
  plugins: [],
};

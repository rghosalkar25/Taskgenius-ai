/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Sora'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
    },
  },
  safelist: [
    // Priority + category colors are composed dynamically from JS, so
    // Tailwind's static content scan can miss them — safelist keeps them in the build.
    { pattern: /bg-(red|amber|emerald|green|blue|purple|slate|gray)-500\/(10|15|20)/ },
    { pattern: /text-(red|amber|emerald|green|blue|purple|slate|gray)-300/ },
    { pattern: /border-(red|amber|emerald|green|blue|purple|slate|gray)-500\/30/ },
  ],
  plugins: [],
};

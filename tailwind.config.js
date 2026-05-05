/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        beta: {
          DEFAULT: "#a855f7",
          dark: "#6d28d9",
        },
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        hw: {
          bg: "#08080c",
          panel: "#121216",
          panel2: "#1a1a21",
          border: "rgba(255,255,255,0.08)",
          text: "#f0f0f5",
          mute: "#9ca0a8",
          accent: "#E85D00",
          accent2: "#ff7a1f",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 40px rgba(232, 93, 0, 0.25)",
      },
      animation: {
        "spin-slow": "spin 8s linear infinite",
      },
    },
  },
  plugins: [],
};

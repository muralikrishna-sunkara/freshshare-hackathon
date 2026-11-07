/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#6b9f5e", dark: "#3e6b35", light: "#e8f1e5" },
        accent: { DEFAULT: "#e89344", light: "#fcefe2" },
      },
    },
  },
  plugins: [],
};

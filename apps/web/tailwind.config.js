/** @type {import('tailwindcss').Config} */
// Theme: "Basil & Honey" (picked 2026-11-07). Components use brand / accent / stone classes,
// so the whole UI follows these tokens. Avoid hard-coded hex colours in components.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Basil green: primary buttons, active states, verified badge, origin chip
        brand: { DEFAULT: "#2e5e4e", dark: "#1f4337", light: "#e3ede8" },
        // Honey: Share action, stars, best-before chip background
        accent: { DEFAULT: "#d9a23c", dark: "#7a560f", light: "#faf0d9" },
        // Neutrals tinted toward basil (replaces Tailwind's warm stone)
        stone: {
          50: "#f6f8f7",
          100: "#eef2f0",
          200: "#e0e6e3",
          300: "#c9d2ce",
          400: "#9aa6a1",
          500: "#6f7c77",
          600: "#5b6863",
          700: "#3f4b47",
          800: "#2a3531",
          900: "#18231f",
          950: "#0f1714",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      letterSpacing: {
        tight: "-0.02em",
      },
    },
  },
  plugins: [],
};

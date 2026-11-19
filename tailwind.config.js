/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "var(--site-bg)",
          900: "var(--site-surface)",
          800: "var(--site-surface-high)",
          700: "#26304a",
        },
        accent: {
          DEFAULT: "var(--site-accent)",
          soft: "var(--site-accent-soft)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--site-radius)",
        lg: "calc(var(--site-radius) - 2px)",
        xl: "var(--site-radius)",
        "2xl": "calc(var(--site-radius) + 4px)",
      },
      fontFamily: {
        sans: ["var(--site-font)"],
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

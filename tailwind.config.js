/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--site-bg)",
        card: "var(--site-surface)",
        feature: "var(--site-surface-high)",
        oat: "var(--site-surface-deep)",
        ink: {
          DEFAULT: "var(--site-fg)",
          soft: "var(--site-ink-soft)",
          muted: "var(--site-muted)",
          faint: "var(--site-faint)",
          950: "var(--site-bg)",
          900: "var(--site-surface)",
          800: "var(--site-surface-high)",
          700: "var(--site-surface-deep)",
        },
        line: {
          DEFAULT: "var(--site-border)",
          strong: "var(--site-border-strong)",
        },
        clay: {
          DEFAULT: "var(--site-accent)",
          deep: "var(--site-accent-deep)",
          on: "var(--site-on-accent)",
        },
        success: {
          DEFAULT: "var(--site-success)",
          soft: "var(--site-success-soft)",
        },
        danger: {
          DEFAULT: "var(--site-danger)",
          soft: "var(--site-danger-soft)",
        },
        warning: {
          DEFAULT: "var(--site-warning)",
          soft: "var(--site-warning-soft)",
        },
        accent: {
          DEFAULT: "var(--site-accent)",
          soft: "var(--site-accent-deep)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--site-radius-btn)",
        lg: "12px",
        xl: "16px",
        "2xl": "var(--site-radius)",
        card: "var(--site-radius)",
        "card-sm": "var(--site-radius-sm)",
        btn: "var(--site-radius-btn)",
        pill: "999px",
      },
      fontFamily: {
        sans: ["var(--site-font)"],
        display: ["var(--site-font-display)"],
        mono: ["var(--site-font-mono)"],
      },
      maxWidth: {
        prose: "42rem",
        page: "72rem",
      },
    },
  },
  plugins: [],
};

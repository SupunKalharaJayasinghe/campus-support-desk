import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        mutedText: "var(--mutedText)",
        primary: "var(--primary)",
        primary2: "var(--primary2)",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(3, 57, 166, 0.08)",
        card: "0 4px 16px rgba(38, 21, 15, 0.06)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-poppins)", "sans-serif"],
      },
    },
  },
};

export default config;

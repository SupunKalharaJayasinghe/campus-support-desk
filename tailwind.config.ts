import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        tint: "var(--tint)",
        text: "var(--text)",
        heading: "var(--heading)",
        primary: "var(--primary)",
        primaryHover: "var(--primaryHover)",
        border: "var(--border)",
        focus: "var(--focus)",
      },
      boxShadow: {
        shadow: "var(--shadow)",
        shadowHover: "var(--shadowHover)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.6rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        heading: ["var(--font-poppins)", "sans-serif"],
      },
    },
  },
};

export default config;

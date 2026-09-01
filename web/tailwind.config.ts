import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        rail: "var(--bg-rail)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        line: "var(--border)",
        ink: "var(--text)",
        muted: "var(--muted)",
        hot: "var(--hot)",
        warm: "var(--warm)",
        cold: "var(--cold)",
      },
    },
  },
  plugins: [],
};
export default config;

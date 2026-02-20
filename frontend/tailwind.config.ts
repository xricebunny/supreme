import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0a0f0d",
          secondary: "#111a16",
          tertiary: "#1a2721",
        },
        border: {
          grid: "#1e3329",
        },
        neon: {
          primary: "#00ff88",
          glow: "rgba(0, 255, 136, 0.5)",
          dim: "rgba(0, 255, 136, 0.15)",
        },
        cyan: {
          bet: "#00e5ff",
          border: "#40efff",
          glow: "rgba(0, 229, 255, 0.4)",
        },
        text: {
          muted: "#4a7a66",
          dim: "#3d5c4d",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

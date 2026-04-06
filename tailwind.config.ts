import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#050916",
        panel: "#0d1424",
        card: "#111a2f",
        cardSoft: "#17223c",
        border: "#22314f",
        text: "#f8fbff",
        muted: "#9aa7bf",
        brand: "#6f7cff",
        brandSoft: "#202b56",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      boxShadow: {
        panel: "0 22px 50px rgba(5, 11, 25, 0.45)",
      },
      backgroundImage: {
        "workspace-glow":
          "radial-gradient(circle at top left, rgba(111, 124, 255, 0.14), transparent 34%), radial-gradient(circle at top right, rgba(34, 197, 94, 0.10), transparent 24%)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "0.35", transform: "scale(0.95)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#111316",
        surface: "#111316",
        "surface-dim": "#111316",
        "surface-container-lowest": "#0c0e11",
        "surface-container-low": "#1a1c1f",
        "surface-container": "#1e2023",
        "surface-container-high": "#282a2d",
        "surface-container-highest": "#333538",
        "surface-bright": "#37393d",
        "surface-variant": "#333538",
        "on-background": "#e2e2e6",
        "on-surface": "#e2e2e6",
        "on-surface-variant": "#c2c6d6",
        outline: "#8c909f",
        "outline-variant": "#424754",
        primary: "#adc6ff",
        "on-primary": "#002e6a",
        "primary-container": "#4d8eff",
        secondary: "#a4c9ff",
        "secondary-container": "#0267b8",
        tertiary: "#b6c6ef",
        error: "#ffb4ab",
        "error-container": "#93000a",
        success: "#6ee7b7",
        warning: "#fbbf24",
        cobalt: "#0b84d8",
        navy: "#1A2B4B"
      },
      borderRadius: {
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem"
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        headline: ["var(--font-jakarta)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        body: ["var(--font-jakarta)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        label: ["var(--font-jakarta)", "Plus Jakarta Sans", "system-ui", "sans-serif"]
      },
      fontSize: {
        "headline-xl": ["40px", { lineHeight: "48px", fontWeight: "700", letterSpacing: "0" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "700", letterSpacing: "0" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "0" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400", letterSpacing: "0" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400", letterSpacing: "0" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400", letterSpacing: "0" }],
        "label-md": ["14px", { lineHeight: "16px", fontWeight: "600", letterSpacing: "0" }],
        "label-sm": ["12px", { lineHeight: "14px", fontWeight: "500", letterSpacing: "0" }]
      },
      boxShadow: {
        glow: "0 0 24px rgba(173, 198, 255, 0.22)",
        card: "0 12px 30px rgba(0, 0, 0, 0.28)"
      },
      backgroundImage: {
        "hero-card": "linear-gradient(135deg, #1A2B4B 0%, #121417 100%)",
        "gauge": "linear-gradient(90deg, #4d8eff 0%, #a4c9ff 100%)"
      }
    }
  },
  plugins: [animate]
};

export default config;

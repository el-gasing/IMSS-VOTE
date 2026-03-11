import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        maroon: {
          900: "#2a1317",
          800: "#4d1f27",
          700: "#6f2d35"
        }
      },
      boxShadow: {
        soft: "0 18px 40px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;

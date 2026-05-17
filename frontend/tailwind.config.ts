import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Strichpunkt Sans", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        felt: "#1a3a2a",
        "felt-dark": "#0f2218",
        "felt-light": "#245237",
        chip: {
          red: "#c0392b",
          blue: "#2980b9",
          green: "#27ae60",
          black: "#1a1a1a",
          white: "#ecf0f1",
        },
      },
    },
  },
  plugins: [],
};

export default config;

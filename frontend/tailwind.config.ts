import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./src/app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "primary-dark": "#1e293b",
        "primary-accent": "#16a34a",
        "primary-accent-hover": "#15803d",
        "secondary-accent": "#ca8a04",
        "background-light": "#f1f5f9",
        "text-dark": "#0f172a",
        "text-light": "#f8fafc",
      },
    },
  },
  plugins: [],
};

export default config;
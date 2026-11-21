/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#090a0c",
          900: "#101214",
          850: "#16181c",
          800: "#1d2025",
          750: "#252930",
          700: "#2f343d",
          600: "#454c59",
          400: "#8c96a5",
          200: "#cbd2dc",
          100: "#e9edf2",
        },
        clinical: {
          blue: "#0ea5e9",
          teal: "#14b8a6",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#ef4444",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Menlo", "monospace"],
      }
    },
  },
  plugins: [],
};

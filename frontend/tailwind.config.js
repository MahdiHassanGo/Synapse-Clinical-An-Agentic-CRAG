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
        canvas: "#F5F6F4",
        surface: "#FFFFFF",
        subtle: "#EEF1EF",
        muted: "#E3E8E5",
        hairline: "#DCE2DE",
        strong: "#C5CEC9",
        ink: {
          DEFAULT: "#141D1B",
          secondary: "#3F4D49",
          muted: "#5C6B66",
        },
        accent: {
          DEFAULT: "#0D6E63",
          hover: "#09544B",
          soft: "#E6F4F2",
          border: "#A7DAD3",
        },
        clinical: {
          blue: "#1E56A0",
          teal: "#0D6E63",
          emerald: "#0E6F4E",
          amber: "#9A4D06",
          rose: "#B42318",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-noto)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

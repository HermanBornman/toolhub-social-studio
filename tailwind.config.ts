import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        toolhub: "#FA6800",
        ingco: "#FF9900",
        charcoal: "#161616",
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0,0,0,.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;


/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern: /print:(block|hidden|absolute|inset-0|w-full)/,
    },
  ],
  
  theme: {
    extend: {
      keyframes: {
        disintegrate: {
          '0%': { transform: 'scale(1)', opacity: 0.5 },
          '50%': { transform: 'scale(1)', opacity: 1 },
          '100%': { transform: 'scale(1) translateX(0)', opacity: 0 }, // end fully transparent
        },
      },
      animation: {
        disintegrate: 'disintegrate 4s ease-in-out forwards', // updated to ease-in-out for smoother transition
      },
    },
  },
  plugins: [],
}


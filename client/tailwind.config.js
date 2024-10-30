/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
        extend: {
            keyframes: {
                disintegrate: {
                    '0%': { transform: 'scale(1.5)', opacity: 1 },
                    '50%': { transform: 'scale(1) translateX(0)', opacity: 0.6 },
                    '100%': { transform: 'scale(0.5) translateX(0)', opacity: 0 }, // Modify for a scatter effect
                },
            },
            animation: {
                disintegrate: 'disintegrate 1.5s ease-in forwards',
            },
        },
    },
  plugins: [],
}


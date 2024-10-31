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
                    '0%': { transform: 'scale(1)', opacity: 0 },
                    '50%': { transform: 'scale(1) translateX(0)', opacity: 1 },
                    '100%': { transform: 'scale(1) translateX(0)', opacity: 0.2 }, // Modify for a scatter effect
                },
            },
            animation: {
                disintegrate: 'disintegrate 3s ease-in forwards',
            },
        },
    },
  plugins: [],
}


// client/src/components/Button.jsx
const Button = ({ text, type = 'button' }) => (
  <button
    type={type}
    className=" bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
  >
    {text}
  </button>
);

export default Button;

// client/src/components/Input.jsx
const Input = ({ label, type, value, onChange, autoComplete }) => (
  <div className="mb-4">
    <label className="block text-gray-700 text-sm font-bold mb-2">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete} // Add autocomplete attribute
      className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
    />
  </div>
);

export default Input;

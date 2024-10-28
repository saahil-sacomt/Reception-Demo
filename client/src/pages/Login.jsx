// client/src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn } from '../services/authService';
import Input from '../components/Input';
import Button from '../components/Button';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage(''); // Reset error message

    const { data, error } = await signIn(email, password);
    if (error) {
      setErrorMessage('Invalid credentials, please try again.');
    } else {
      navigate('/home'); // Directly navigate to the homepage on successful login
    }
  };

  // Function to toggle password visibility with auto-hide after 3 seconds
  const togglePasswordVisibility = () => {
    setShowPassword(true);
    setTimeout(() => setShowPassword(false), 2000); // Hide password after 3 seconds
  };

  return (
    <div className="w-full max-w-md p-10 mx-auto bg-gray-100 shadow-xl rounded-lg border border-gray-200 space-y-6">
      <h2 className="text-2xl font-semibold text-center text-gray-800">Hello, have a wonderful day!</h2>
      {errorMessage && <p className="text-center text-red-500">{errorMessage}</p>}
      
      <form onSubmit={handleLogin} className="space-y-6">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="Enter your email"
        />
        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"} // Toggle input type based on showPassword state
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-gray-600"
          >
            {showPassword ? '👀' : '👁️'}
          </button>
        </div>
        <Button
          text="Login"
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-150"
        />
      </form>

      <p className="text-center text-gray-600">
        Don’t have an account?{' '}
        <Link to="/signup" className="text-indigo-600 font-medium hover:underline">
          Sign up here
        </Link>
      </p>
    </div>
  );
};

export default Login;

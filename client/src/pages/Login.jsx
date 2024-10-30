// client/src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn } from '../services/authService';
import topLogo from '../assets/sreenethraenglishisolated.png';
import bottomLogo from '../assets/Retrato Black PNG.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const { data, error } = await signIn(email, password);
    if (error) {
      setErrorMessage('Invalid credentials, please try again.');
    } else {
      sessionStorage.setItem('showSplash', 'true'); // Set flag for splash screen
      navigate('/home'); // Navigate to home
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(true);
    setTimeout(() => setShowPassword(false), 2000);
  };

  return (
    <div className="flex h-screen">
      <div className="hidden md:flex w-1/2 bg-cover bg-center relative">
        <img src={topLogo} alt="Top Logo" className="absolute top-6 left-6 h-10" />
        <div className="flex items-center justify-center bg-green-50 w-full">
        <h2 className="text-3xl  text-center text-gray-800 mb-6 font-">Sign in to Continue</h2>
          <div className="text-center text-white p-8"></div>
        </div>
      </div>

      {/* Right Section with Login Form */}
      <div className="flex w-full md:w-1/2 items-center justify-center p-6 bg-white">
        <div className="w-full max-w-xs">
          
          {errorMessage && <p className="text-center text-red-500 mb-4">{errorMessage}</p>}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="">
              <label className="block font-normal text-sm text-gray-700 mb-1">
                Email ID 
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:border-indigo-700"
              />
            </div>
            <div className="relative">
              <label className="block font-normal text-sm text-gray-700 mb-1">
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:border-indigo-700"
              />
              <span
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-0 top-8 pr-3 flex items-center text-gray-600 cursor-pointer"
              >
                {showPassword ? '👀' : '👁️'}
              </span>
            </div>
            
            <button
              type="submit"
              className="w-full bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] text-white py-2 px-4 rounded-lg transition duration-150"
            >
              Sign in
            </button>
          </form>
        </div>
        {/* Bottom-right logo */}
        <img src={bottomLogo} alt="Bottom Logo" className="absolute bottom-4 right-4 h-10" />
      </div>
    </div>
  );
};

export default Login;

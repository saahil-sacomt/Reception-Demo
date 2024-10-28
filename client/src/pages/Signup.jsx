// client/src/pages/Signup.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../services/authService';
import Input from '../components/Input';
import Button from '../components/Button';
import { EyeIcon, EyeSlashIcon as EyeOffIcon } from '@heroicons/react/24/outline';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('employee'); // Default role is 'employee'
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [errorMessage, setErrorMessage] = useState(''); // For error messages only
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMessage(''); // Reset error message
  
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
  
    const { data, error } = await signUp(name, email, password, role, address, phoneNumber, emergencyContact);
    if (error) {
      setErrorMessage(`Signup failed: ${error.message}`);
    } else {
      // Navigate to the login page on successful signup without showing success message
      navigate('/login');
    }
  };
  

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <div className="w-full max-w-lg p-10 mx-auto bg-gray-100 shadow-lg rounded-lg space-y-4 border border-gray-300">
      {/* Display error messages in red if any */}
      {errorMessage && <p className="text-center text-lg text-red-500 mb-4">{errorMessage}</p>}

      <form onSubmit={handleSignup} className="space-y-4">
        <Input label="Full Name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Enter your full name" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="Enter your email address" />

        {/* Flex container for Password and Confirm Password with show/hide functionality */}
        <div className="flex gap-4">
          <div className="w-1/2 relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Create a password"
            />
            <button type="button" onClick={togglePasswordVisibility} className="absolute right-3 top-9 text-gray-600">
              {showPassword ? '👀' : '👁️'}
            </button>
          </div>

          <div className="w-1/2 relative">
            <Input
              label="Re-enter Password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter password"
            />
            <button type="button" onClick={togglePasswordVisibility} className="absolute right-3 top-9 text-gray-600">
              {showPassword ? '👀' : '👁️'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-medium mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <Input label="Address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="address-line1" placeholder="Enter your address" />

        {/* Flex container for Phone Number and Emergency Contact */}
        <div className="flex gap-4">
          <div className="w-1/2">
            <Input label="Phone Number" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} autoComplete="tel" placeholder="Phone number" />
          </div>
          <div className="w-1/2">
            <Input label="Emergency Contact Number" type="tel" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} autoComplete="tel" placeholder="Emergency contact" />
          </div>
        </div>

        <Button text="Signup" type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition duration-150" />
      </form>

      <p className="text-center text-gray-500 mt-6">
        Already have an account? <Link to="/login" className="text-indigo-600 font-medium hover:underline">Log in here</Link>
      </p>
    </div>
  );
};

export default Signup;

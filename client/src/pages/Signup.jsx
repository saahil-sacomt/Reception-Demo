// client/src/pages/Signup.jsx

import { useState , useEffect} from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '../services/authService';
import Input from '../components/Input';
import Button from '../components/Button';
import companyLogo from '../assets/sreenethraenglishisolated.png'; // Ensure the logo path is correct

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('employee'); // Default role
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false); // New state for success
  const [showPassword, setShowPassword] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [pin, setPin] = useState('');

  const navigate = useNavigate();


  // client/src/data/branches.js

  // New state for sub-role/department
  const [subRole, setSubRole] = useState('');
  const [availableSubRoles, setAvailableSubRoles] = useState([]);

  const branches = [
    { name: 'Neyyatinkara', code: 'NTA' },
    { name: 'Trivandrum', code: 'TVR' },
    { name: 'Kottarakara 1', code: 'KOT1' },
    { name: 'Kottarakara 2', code: 'KOT2' },
    { name: 'Kattakada', code: 'KAT' },
    // Add more branches as needed
  ];



  const subDepartmentsByRoleAndBranch = {
    // reception: {
    //   NTA: ['Reception NTA-01', 'Reception NTA-02'],
    //   TVR: ['Reception TVR-01', 'Reception TVR-01'],
    //   KOT1: ['Reception K1-01'],
    //   KOT2: ['Reception K2-01'],
    //   KAT: ['Reception KAT-01'],
    // },
    counselling: {
      NTA: ['Counselling 01', 'Counselling 02'],
      TVR: ['Counselling 01', 'Counselling 02'],
      KOT1: ['Counselling 01'],
      KOT2: ['Counselling 01'],
      KAT: ['Counselling 01'],
    },
    opd: {
      NTA: ['OPD 01', 'OPD 02'],
      TVR: ['OPD 01', 'OPD 02'],
      KOT1: ['OPD 01'],
      KOT2: ['OPD 01'],
      KAT: ['OPD 01'],
    },
  };



  // Regular Expressions for Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format

  // Dynamically update the options based on the selected role and branch
  useEffect(() => {
    if (
      subDepartmentsByRoleAndBranch[role] &&
      subDepartmentsByRoleAndBranch[role][selectedBranch]
    ) {
      setAvailableSubRoles(subDepartmentsByRoleAndBranch[role][selectedBranch]);
    } else {
      setAvailableSubRoles([]);
    }
    setSubRole('');
  }, [role, selectedBranch]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Add PIN validation
    if (pin.length < 4 || pin.length > 6) {
      setErrorMessage('PIN must be between 4 to 6 digits.');
      return;
    }

    // Frontend Validations
    if (!name.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }

    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!address.trim()) {
      setErrorMessage('Address is required.');
      return;
    }

    if (!phoneRegex.test(phoneNumber)) {
      setErrorMessage('Please enter a valid phone number.');
      return;
    }

    if (!phoneRegex.test(emergencyContact)) {
      setErrorMessage('Please enter a valid emergency contact number.');
      return;
    }

    if (!selectedBranch) {
      setErrorMessage('Please select a branch.');
      return;
    }

    try {
      const { data, error } = await signUp(
        name,
        email,
        password,
        role,
        address,
        phoneNumber,
        emergencyContact,
        selectedBranch,
        pin,// Pass the selected branch code
        subRole
      );

      if (error) {
        setErrorMessage(`Signup failed: ${error.message}`);
      } else {
        // setIsSuccess(true); // Show success message
        // Optionally, navigate to login or another page
        navigate('/login');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  };


  const togglePasswordVisibility = () => setShowPassword(!showPassword);



  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-20">
      <div className="max-w-3xl w-full bg-green-50 shadow-lg rounded-xl p-8">
        {/* Company Logo */}
        <div className="flex justify-center mb-6">
          <img
            className="h-16 w-auto"
            src={companyLogo}
            alt="Company Logo"
          />
        </div>

        {/* Form Title */}
        <div className="mb-6">
          <h2 className="text-center text-xl font-semibold text-gray-900">
            Create New User
          </h2>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-xl bg-red-50 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                {/* Error Icon */}
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {isSuccess ? (
          <div className="rounded-xl bg-green-50 p-6 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                {/* Success Icon */}
                <svg
                  className="h-6 w-6 text-green-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg leading-6 font-medium text-green-800">Signup Successful!</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>The new user has been created successfully.</p>
                </div>
                <div className="mt-4 flex space-x-4">
                  <Button
                    text="Create Another User"
                    onClick={resetForm}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  />
                  <Link to="/users">
                    <Button
                      text="View All Users"
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Signup Form */
          <form onSubmit={handleSignup} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <Input
                  label="Full Name"
                  type="text"
                  name="name"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                />
              </div>

              {/* Email Address */}
              <div>
                <Input
                  label="Email Address"
                  type="email"
                  name="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1 rounded-md shadow-sm">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      // Eye Icon (Visible)
                      <svg
                        className="h-5 w-5 text-gray-400"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zM10 15a5 5 0 100-10 5 5 0 000 10z" />
                        <path d="M10 13a3 3 0 110-6 3 3 0 010 6z" />
                      </svg>
                    ) : (
                      // Eye Off Icon (Hidden)
                      <svg
                        className="h-5 w-5 text-gray-400"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M3.707 2.293a1 1 0 00-1.414 1.414l1.314 1.314C2.94 6.027 2 7.374 2 10c0 2.626.94 3.973 2.293 5.393l1.414-1.414A3.978 3.978 0 014 10c0-1.104.448-2.112 1.172-2.828L3.707 2.293z" />
                        <path d="M16.293 17.707a1 1 0 001.414-1.414l-1.314-1.314C17.06 13.973 18 12.626 18 10c0-2.626-.94-3.973-2.293-5.393l-1.414 1.414A3.978 3.978 0 0116 10c0 1.104-.448 2.112-1.172 2.828l1.465 1.465z" />
                        <path d="M12.828 12.828a3 3 0 01-4.242 4.242l-1.414-1.414a3 3 0 014.242-4.242l1.414 1.414z" />
                        <path d="M7.757 7.757a3 3 0 014.242 4.242l1.414 1.414a3 3 0 01-4.242-4.242l-1.414-1.414z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1 rounded-md shadow-sm">
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="********"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  aria-label="Select Role"
                  required
                >
                  <option value="" disabled>
                    Select Role
                  </option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="reception">Reception</option>
                  <option value="counselling">Counselling</option>
                  <option value="opd">OPD</option>
                  <option value="insurance">Insurance</option>
                  
                </select>
              </div>

              {/* Branch Selection */}
              <div>
                <label htmlFor="branch" className="block text-sm font-medium text-gray-700">
                  Select Branch <span className="text-red-500">*</span>
                </label>
                <select
                  id="branch"
                  name="branch"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  required
                >
                  <option value="" disabled>
                    -- Select Branch --
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.code} value={branch.code}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-Department Selection */}
              {[ 'counselling', 'opd'].includes(role) && (

                <div>
                  <label htmlFor="subRole" className="block text-sm font-medium text-gray-700 mt-4">
                    Select Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="subRole"
                    name="subRole"
                    value={subRole}
                    onChange={(e) => setSubRole(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 border-gray-300 rounded-md"
                    required
                  >
                    <option value="" disabled>
                      -- Select Department --
                    </option>
                    {availableSubRoles.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}


              {/* Address */}
              <div>
                <Input
                  label="Address"
                  type="text"
                  name="address"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  placeholder="123 Main St, City, Country"
                />
              </div>
              {/* PIN */}
              <div>
                <Input
                  label="Employee PIN"
                  type="password"
                  name="pin"
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  placeholder="Enter a secure PIN"
                />
              </div>


              {/* Phone Number */}
              <div>
                <Input
                  label="Phone Number"
                  type="tel"
                  name="phoneNumber"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {/* Emergency Contact */}
              <div>
                <Input
                  label="Emergency Contact"
                  type="tel"
                  name="emergencyContact"
                  id="emergencyContact"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  required
                  placeholder="+1 (555) 987-6543"
                />
              </div>
            </div>

            {/* Signup Button */}
            <div className="mt-6">
              <Button
                text="Create User"
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              />
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Signup;
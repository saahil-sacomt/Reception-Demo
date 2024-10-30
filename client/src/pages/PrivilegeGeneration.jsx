// client/src/pages/PrivilegeGeneration.jsx
import { useState, useEffect } from 'react';

const PrivilegeGeneration = ({ isCollapsed }) => {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // OTPLESS callback function to handle user data
    window.otpless = (otplessUser) => {
      setUserData(otplessUser);  // Save user data on successful login
      console.log("User authenticated:", otplessUser);  // For debugging
    };
  }, []);

  return (
    <div className="container mt-20 mx-auto p-6 bg-white shadow-lg rounded-lg max-w-md">
      <h2 className="text-2xl font-bold text-center mb-4">Privilege Generation</h2>

      {/* OTPLESS Login UI */}
      <div id="otpless-login-page"></div>

      {/* Display user data after authentication */}
      {userData ? (
        <div className="mt-6 text-center">
          <h3 className="text-lg font-medium">User Authenticated</h3>
          <p><strong>Name:</strong> {userData.identities[0].name}</p>
          <p><strong>Email:</strong> {userData.identities[0].identityValue}</p>
        </div>
      ) : (
        <p className="text-center text-gray-500 mt-4">Please log in using OTPLESS.</p>
      )}
    </div>
  );
};

export default PrivilegeGeneration;

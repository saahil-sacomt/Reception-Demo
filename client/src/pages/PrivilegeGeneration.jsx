// client/src/pages/PrivilegeGeneration.jsx
import React, { useState } from 'react';

const PrivilegeGeneration = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpRequested, setIsOtpRequested] = useState(false);

  const requestOtp = () => {
    try {
      // Initialize OTP request via OTPLESS SDK for phone verification
      window.OTPlessSignin.initiate({
        channel: 'PHONE',
        phone: phoneNumber,
        countryCode: '+91', // Update this as per the user's location
      });
      setIsOtpRequested(true);
    } catch (error) {
      console.error('Error initiating OTP request:', error);
    }
  };

  const verifyOtp = () => {
    try {
      // Verify the entered OTP via OTPLESS SDK
      window.OTPlessSignin.verify({
        channel: 'PHONE',
        phone: phoneNumber,
        otp: otp,
        countryCode: '+91', // Update this based on the user’s location
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
    }
  };

  return (
    <div className="container mx-auto mt-20 p-6 bg-white shadow-lg rounded-lg max-w-md">
      <h2 className="text-2xl font-bold text-center mb-4">Privilege Generation</h2>

      {!isOtpRequested ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enter your Phone Number
          </label>
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            placeholder="Enter phone number"
          />
          <button
            onClick={requestOtp}
            className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg"
          >
            Request OTP
          </button>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            placeholder="Enter the OTP"
          />
          <button
            onClick={verifyOtp}
            className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg"
          >
            Verify OTP
          </button>
        </div>
      )}
    </div>
  );
};

export default PrivilegeGeneration;

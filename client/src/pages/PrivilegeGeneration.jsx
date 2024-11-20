// client/src/pages/PrivilegeGeneration.jsx
import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { generateCardWithBarcode } from '../utils/cardGenerator';
import { sendCardViaWhatsApp } from '../utils/watiApi';
import supabase from '../supabaseClient';
import { convertUTCToIST, getCurrentUTCDateTime, formatDateToIST } from "../utils/dateUtils";
import { useAuth } from '../context/AuthContext';
import { PencilIcon, XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline"; // Enhanced Icons

const PrivilegeGeneration = ({ isCollapsed }) => {
  const { name: employeeName, branch } = useAuth(); // Fetch employee name and branch from AuthContext
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [topUpAmount, setTopUpAmount] = useState(500);
  const [isOtpRequested, setIsOtpRequested] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cardPreview, setCardPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cardTier, setCardTier] = useState('GOLD'); // Ensure card tiers are uppercase

  const mockOtp = "1234";

  const phoneNumberRef = useRef(null);
  const otpRef = useRef(null);
  const nameRef = useRef(null);
  const topUpAmountRef = useRef(null);

  // React Router Hooks
  const navigate = useNavigate();
  const location = useLocation();

  async function generateNextPcNumber() {
    // Fetch the last PC number from the database
    const { data: lastRecord, error } = await supabase
      .from('privilegecards')
      .select('pc_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error('Error fetching last PC number: ' + error.message);
    }

    let lastPcNumber = lastRecord ? lastRecord.pc_number.toUpperCase() : null; // Ensure uppercase

    // If no PC number exists, start from 'AA0002' (skip 'AA0001')
    if (!lastPcNumber) {
      return 'AA0002';
    }

    // Split last PC number into alphabet and numeric parts
    const alphaPart = lastPcNumber.slice(0, 2).toUpperCase();
    const numericPart = parseInt(lastPcNumber.slice(2), 10);

    // Increment numeric part
    let newNumericPart = numericPart + 1;

    let newAlphaPart = alphaPart;

    if (newNumericPart > 9999) {
      // Reset numeric part and increment alpha part
      newNumericPart = 1;
      newAlphaPart = incrementAlphaPart(alphaPart);
    }

    // Format numeric part to be 4 digits with leading zeros
    const numericPartStr = newNumericPart.toString().padStart(4, '0');

    // Combine new alpha and numeric parts
    let newPcNumber = `${newAlphaPart}${numericPartStr}`;

    // Skip 'AA0001' if it's generated
    if (newPcNumber === 'AA0001') {
      newPcNumber = 'AA0002';
    }

    return newPcNumber;
  }

  // Helper function to increment the alphabetic part
  function incrementAlphaPart(alpha) {
    const firstCharCode = alpha.charCodeAt(0);
    const secondCharCode = alpha.charCodeAt(1);

    // 'A' to 'Z' are 65 to 90 in ASCII
    if (secondCharCode < 90) { // 'Z' is 90
      return alpha[0] + String.fromCharCode(secondCharCode + 1);
    } else if (firstCharCode < 90) {
      return String.fromCharCode(firstCharCode + 1) + 'A';
    } else {
      throw new Error('PC number limit reached. No more unique PC numbers available.');
    }
  }

  const requestOtp = () => {
    if (phoneNumber.length === 10 && /^\d+$/.test(phoneNumber)) {
      setIsOtpRequested(true);
      setErrorMessage('');
      alert(`Mock OTP for testing purposes: ${mockOtp}`);
      otpRef.current?.focus();
    } else {
      setErrorMessage("Please enter a valid 10-digit phone number.");
    }
  };

  const verifyOtp = () => {
    if (otp === mockOtp) {
      setIsOtpVerified(true);
      setErrorMessage('');
      setTimeout(() => nameRef.current?.focus(), 0);
    } else {
      setErrorMessage("Incorrect OTP. Please try again.");
    }
  };

  const handleTopUpChange = (value) => {
    if (!isNaN(value) && Number(value) >= 0) {
      setTopUpAmount(value);
      if (value && Number(value) < 500) {
        setErrorMessage("Top-Up Amount must be at least 500.");
      } else {
        setErrorMessage('');
      }
    }
  };

  const generateAndSaveCard = async () => {
    if (topUpAmount === '' || Number(topUpAmount) < 500) {
      setErrorMessage("Top-Up Amount must be at least 500.");
      return;
    }

    setIsLoading(true);
    try {
      console.log("Attempting to generate and save card...");

      // Check if a privilege card already exists for this phone number
      const { data: existingCard, error: fetchError } = await supabase
        .from('privilegecards')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error('Error checking existing privilege card: ' + fetchError.message);
      }

      if (existingCard) {
        setErrorMessage("A privilege card already exists for this phone number.");
        setIsLoading(false);
        return;
      }

      // Generate a unique PC number
      const pcNumber = await generateNextPcNumber();
      console.log("Generated PC Number:", pcNumber);

      // Generate the barcode card
      const cardDataUrl = await generateCardWithBarcode(pcNumber, name);
      setCardPreview(cardDataUrl);

      const currentUTCDateTime = getCurrentUTCDateTime(); 

      // Insert data into Supabase
      const { data, error } = await supabase.from('privilegecards').insert([{
        pc_number: pcNumber.toUpperCase(), // Ensure uppercase
        customer_name: name.toUpperCase(), // Optional: capitalize customer name
        phone_number: phoneNumber,
        top_up_amount: Number(topUpAmount),
        loyalty_points: Number(topUpAmount),
        card_tier: cardTier.toUpperCase(), // Ensure uppercase
        created_at: currentUTCDateTime,
        branch: branch, // Add branch from AuthContext
        employee_name: employeeName, // Add employee name from AuthContext
      }]);

      if (error) {
        console.error("Supabase insert error:", error.message);
        setErrorMessage("Error inserting data: " + error.message);
        return;
      }

      console.log("Data inserted successfully into Supabase:", data);

      // Send the card via WhatsApp
      await sendCardViaWhatsApp(phoneNumber, cardDataUrl, topUpAmount);
      alert("Privilege card sent successfully via WhatsApp!");

      // Navigate back to Sales Order with previous state
      if (location.state?.from === 'sales-order') {
        navigate('/sales-order', {
          state: {
            from: 'privilege-generation',
            step: location.state.step,
            formData: location.state.formData
          }
        });
      } else {
        // Reset form
        setName('');
        setPhoneNumber('');
        setOtp('');
        setTopUpAmount('');
        setIsOtpRequested(false);
        setIsOtpVerified(false);
        setCardPreview(null);
        setErrorMessage('');
      }
    } catch (err) {
      console.error("Error generating/saving card:", err);
      setErrorMessage("Failed to generate/send card. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
        } justify-center mt-20 p-20 rounded-xl mx-auto max-w-2xl bg-green-50 shadow-inner`}>
      <h2 className="text-2xl font-semibold text-center mb-4 ">Privilege Generation</h2>

      {isOtpVerified ? (
        <div>
          <p className="text-green-600 font-bold text-center">OTP Verified Successfully!</p>

          {/* Customer Name Input */}
          <label className="block text-base font-medium text-gray-700 mb-1 mt-4">
            Customer Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            ref={nameRef}
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            placeholder="Enter customer's name"
            onKeyDown={(e) => e.key === 'Enter' && topUpAmountRef.current?.focus()}
          />

          {/* Privilege Card Tier */}
          <label className="block text-base font-medium text-gray-700 mb-1 mt-4">Card Tier</label>
          <select
            value={cardTier}
            onChange={(e) => setCardTier(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="GOLD">GOLD</option>
            <option value="PLATINUM" disabled>PLATINUM</option>
          </select>

          {/* Top-Up Amount Input */}
          <label className="block text-base font-medium text-gray-700 mb-1 mt-4">
            Top-Up Amount <span className="text-xs text-gray-500">(Minimum: 500)</span>
          </label>
          <input
            type="number"
            value={topUpAmount}
            onChange={(e) => handleTopUpChange(e.target.value)}
            ref={topUpAmountRef}
            className="appearance-none w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            placeholder="Enter top-up amount"
            onKeyDown={(e) => e.key === 'Enter' && generateAndSaveCard()}
          />

          {errorMessage && (
            <p className="text-red-600 text-xs mt-1 text-center">{errorMessage}</p>
          )}

          <button
            onClick={generateAndSaveCard}
            disabled={isLoading}
            className={`mt-4 w-full py-2 rounded-lg flex items-center justify-center transition ${
              isLoading ? 'bg-yellow-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
            } text-white`}
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 mr-3 border-t-2 border-b-2 border-white rounded-full"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"></path>
                </svg>
                Sending...
              </>
            ) : (
              "Generate and Send Privilege Card"
            )}
          </button>

          {cardPreview && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Card Preview:</h3>
              <img src={cardPreview} alt="Generated Privilege Card" className="border rounded-md" />
            </div>
          )}
        </div>
      ) : (
        <div>
          {!isOtpRequested ? (
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2">
                Enter your Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                ref={phoneNumberRef}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                placeholder="Enter phone number"
                onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
              />
              <button
                onClick={requestOtp}
                className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg flex items-center justify-center"
              >
                Request OTP
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2">Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                ref={otpRef}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                placeholder="Enter the OTP"
                onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
              />
              <button
                onClick={verifyOtp}
                className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg flex items-center justify-center"
              >
                Verify OTP
              </button>
            </div>
          )}
          {errorMessage && <p className="text-red-600 mt-2 text-center">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
};

export default PrivilegeGeneration;

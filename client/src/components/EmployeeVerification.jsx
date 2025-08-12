import React, { useState, useRef, useEffect } from 'react';
import supabase from '../supabaseClient';
import bcrypt from 'bcryptjs';

const EmployeeVerification = ({ employee, onVerify , component = 'notInsurance'}) => {
  console.log("EmployeeVerification component rendered for employee:", employee);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const pinInputRef = useRef(null);
  const verifyButtonRef = useRef(null);

  // Function to verify the PIN
  const verifyPin = async () => {
    if (pin.length !== 4) {
      setError("PIN must be exactly 4 digits.");
      setSuccessMessage('');
      return;
    }

    try {
      console.log("Verifying PIN for employee:", employee);

      // Fetch the employee's hashed PIN from the database
      let columntocheck = 'name';
      if(component === 'insurance'){
        columntocheck = 'id';
      }

      const { data, error } = await supabase
        .from('employees')
        .select('pin')
        .eq(columntocheck, employee) // Query by the "name" column
        .single();


      console.log("Supabase query result:", { data, error });

      if (error) {
        console.error("Supabase error:", error.message);
        setError("Failed to fetch employee data. Please try again.");
        setSuccessMessage('');
        onVerify(false);
        return;
      }

      if (!data || !data.pin) {
        setError("Employee not found or no PIN set.");
        setSuccessMessage('');
        onVerify(false);
        return;
      }

      // Verify the entered PIN against the stored hashed PIN
      const isValidPin = await bcrypt.compare(pin, data.pin);
      if (!isValidPin) {
        setError("Incorrect PIN. Please try again.");
        setSuccessMessage('');
        onVerify(false);
      } else {
        setError('');
        setSuccessMessage("PIN Verified Successfully!");
        onVerify(true);
      }
    } catch (err) {
      console.error("Error verifying PIN:", err);
      setError("Failed to verify PIN. Please try again.");
      setSuccessMessage('');
      onVerify(false);
    }
  };

  // Handle "Enter" key navigation
  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await verifyPin();
      if (successMessage) {
        verifyButtonRef.current?.focus();
      }
    }
  };

  const handleModifyOrder = (orderId) => {
    navigate(`/modify-order/${orderId}`, {
      state: {
        onModificationSuccess: () => {
          setActionRequests((prevRequests) =>
            prevRequests.filter((request) => request.order_id !== orderId)
          );
          setNotification({
            type: 'success',
            message: `Modification for Order ID ${orderId} completed successfully.`,
          });
        },
      },
    });
  };


  // Focus on the PIN input field when the component mounts
  useEffect(() => {
    pinInputRef.current?.focus();
  }, []);

  return (
    <div>
      {/* Input Field for PIN */}
      <input
        type="password"
        placeholder="Enter 4-digit PIN"
        value={pin}
        ref={pinInputRef}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={handleKeyDown}
        className="border border-gray-300 px-4 py-2 rounded mb-2 w-full"
      />

      {/* Verify Button */}
      <button
        type="button"
        ref={verifyButtonRef}
        onClick={verifyPin}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-2"
      >
        Verify
      </button>

      {/* Error and Success Messages */}
      {error && <p className="text-red-500">{error}</p>}
      {successMessage && <p className="text-blue-500">{successMessage}</p>}
    </div>
  );
};

export default EmployeeVerification;

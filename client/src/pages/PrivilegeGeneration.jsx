// client/src/pages/PrivilegeGeneration.jsx
import React, { useState, useRef } from 'react';
import { generateCardWithBarcode } from '../utils/cardGenerator';
import { sendCardViaWhatsApp } from '../utils/watiApi';

const PrivilegeGeneration = () => {
    const [name, setName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [isOtpRequested, setIsOtpRequested] = useState(false);
    const [isOtpVerified, setIsOtpVerified] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [cardPreview, setCardPreview] = useState(null);

    const mockOtp = "1234";

    // References for navigating between fields
    const phoneNumberRef = useRef(null);
    const otpRef = useRef(null);
    const nameRef = useRef(null);

    const requestOtp = () => {
        if (phoneNumber.length === 10) {
            setIsOtpRequested(true);
            setErrorMessage('');
            alert(`Mock OTP for testing purposes: ${mockOtp}`);
            otpRef.current?.focus();  // Move focus to OTP input
        } else {
            setErrorMessage("Please enter a valid 10-digit phone number.");
        }
    };

    const verifyOtp = () => {
        if (otp === mockOtp) {
            setIsOtpVerified(true);
            setErrorMessage('');
            setTimeout(() => nameRef.current?.focus(), 0); // Ensure focus on the name input after rendering
        } else {
            setErrorMessage("Incorrect OTP. Please try again.");
        }
    };

    const generateAndSendCard = async () => {
        try {
            const mrNumber = `MR${Date.now()}`;
            const cardDataUrl = await generateCardWithBarcode(mrNumber, 'Mr. ' + name);

            setCardPreview(cardDataUrl);

            await sendCardViaWhatsApp(phoneNumber, cardDataUrl);
            alert("Privilege card sent successfully via WhatsApp!");
        } catch (error) {
            console.error("Error generating/sending card:", error);
            setErrorMessage("Failed to generate/send card. Please try again.");
        }
    };

    return (
        <div className="container mx-auto mt-20 p-6 py-20 bg-green-50 shadow-inner rounded-lg max-w-xl">
            <h2 className="text-2xl font-bold text-center mb-4">Privilege Generation</h2>
            
            {isOtpVerified ? (
                <div className="text-center">
                    <p className="text-green-600 font-bold">OTP Verified Successfully!</p>

                    <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">
                        Customer Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        ref={nameRef}
                        autoFocus // Ensure name input is auto-focused after OTP verification
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                        placeholder="Enter customer's name"
                        onKeyDown={(e) => e.key === 'Enter' && generateAndSendCard()}
                    />

                    <button
                        onClick={generateAndSendCard}
                        className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg"
                    >
                        Generate and Send Privilege Card
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">
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
                                className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg"
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
                                ref={otpRef}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                placeholder="Enter the OTP"
                                onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
                            />
                            <button
                                onClick={verifyOtp}
                                className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg"
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

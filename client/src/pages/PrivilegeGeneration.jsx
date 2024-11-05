// client/src/pages/PrivilegeGeneration.jsx
import React, { useState, useRef } from 'react';
import { generateCardWithBarcode } from '../utils/cardGenerator';
import { sendCardViaWhatsApp } from '../utils/watiApi';

const PrivilegeGeneration = () => {
    const [name, setName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [topUpAmount, setTopUpAmount] = useState(''); // Keep as a string for better handling of blank state
    const [isOtpRequested, setIsOtpRequested] = useState(false);
    const [isOtpVerified, setIsOtpVerified] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [cardPreview, setCardPreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const mockOtp = "1234";

    const phoneNumberRef = useRef(null);
    const otpRef = useRef(null);
    const nameRef = useRef(null);
    const topUpAmountRef = useRef(null);

    const requestOtp = () => {
        if (phoneNumber.length === 10) {
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
        // Only update if input is a positive integer
        if (!isNaN(value) && Number(value) >= 0) {
            setTopUpAmount(value);
            if (value && Number(value) < 500) {
                setErrorMessage("Top-Up Amount must be at least 500.");
            } else {
                setErrorMessage('');
            }
        }
    };

    const generateAndSendCard = async () => {
        if (topUpAmount === '' || Number(topUpAmount) < 500) {
            setErrorMessage("Top-Up Amount must be at least 500.");
            return;
        }

        setIsLoading(true);
        try {
            const mrNumber = `MR${Date.now()}`;
            const cardDataUrl = await generateCardWithBarcode(mrNumber, 'Mr. ' + name);

            setCardPreview(cardDataUrl);

            await sendCardViaWhatsApp(phoneNumber, cardDataUrl, topUpAmount);
            alert("Privilege card sent successfully via WhatsApp!");
        } catch (error) {
            console.error("Error generating/sending card:", error);
            setErrorMessage("Failed to generate/send card. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto my-20 px-6 py-6 bg-green-50 shadow-inner rounded-lg max-w-xl ">
            <h2 className="text-2xl font-semibold text-center mb-4 ">Privilege Generation</h2>
            
            {isOtpVerified ? (
                <div className="">
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
                        onKeyDown={(e) => e.key === 'Enter' && generateAndSendCard()}
                    />
                    {errorMessage && (
                        <p className="text-red-600 text-xs mt-1 text-center">{errorMessage}</p>
                    )}

                    <button
                        onClick={generateAndSendCard}
                        disabled={isLoading}
                        className={`mt-4 w-full py-2 rounded-lg transition ${isLoading ? 'bg-yellow-400' : 'bg-green-500 hover:bg-green-600'} text-white`}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"></path>
                                </svg>
                                Sending...
                            </span>
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
                                className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg"
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

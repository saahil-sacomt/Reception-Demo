import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabaseClient';

// Utils
const today = new Date();
const formattedDate = today.toLocaleDateString('en-IN');

const InsuranceCheckout = memo(() => {
    // State Management from SalesOrderGeneration
    const [validationErrors, setValidationErrors] = useState({});
    const [step, setStep] = useState(1);
    const [mrNumber, setMrNumber] = useState('');
    const [patientDetails, setPatientDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Refs
    const mrNumberRef = useRef(null);
    const nextButtonRef = useRef(null);

    // Navigation Functions (copied from SalesOrderGeneration)
    const nextStep = () => {
        const errors = {};

        // Validate current step
        if (step === 1) {
            if (!mrNumber.trim()) {
                errors.mrNumber = "MR number is required";
            }
            if (!patientDetails) {
                errors.mrNumber = "Please fetch patient details first";
            }
        }

        setValidationErrors(errors);

        if (Object.keys(errors).length === 0) {
            setStep(prevStep => prevStep + 1);
        }
    };

    const prevStep = () => setStep(prevStep => Math.max(prevStep - 1, 1));

    // Patient Fetch Function (similar to SalesOrderGeneration)
    const fetchPatientByMRNumber = async () => {
        if (!mrNumber.trim()) {
            setValidationErrors({ mrNumber: 'MR number is required' });
            mrNumberRef.current?.focus();
            return;
        }

        setIsLoading(true);
        setValidationErrors({});

        try {
            const { data, error } = await supabase
                .from("patients")
                .select("*")
                .eq("mr_number", mrNumber.trim())
                .maybeSingle();

            if (error) {
                console.error("Error fetching patient:", error);
                setValidationErrors({ mrNumber: 'Failed to fetch patient details' });
                return;
            }

            if (!data) {
                setValidationErrors({ mrNumber: 'No patient found with this MR number' });
                setPatientDetails(null);
                return;
            }

            setPatientDetails(data);
            nextButtonRef.current?.focus();

        } catch (err) {
            console.error("Unexpected error:", err);
            setValidationErrors({ mrNumber: 'An unexpected error occurred' });
        } finally {
            setIsLoading(false);
        }
    };

    // Focus Management (copied from SalesOrderGeneration)
    useEffect(() => {
        if (step === 1) {
            mrNumberRef.current?.focus();
        }
    }, [step]);

    return (
        <div className="mx-20 px-20 justify-center mt-16 p-4">
            <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">
                Insurance Checkout
            </h1>

            {/* Progress Tracker */}
            <div className="flex items-center mb-8 w-2/3 mx-auto">
                {Array.from({ length: 5 }, (_, i) => (
                    <div
                        key={i}
                        className={`flex-1 h-2 rounded-xl mx-1 ${step > i ? "bg-[#5db76d]" : "bg-gray-300"
                            } transition-all duration-300`}
                    />
                ))}
            </div>

            <form className="space-y-8 bg-white p-6 rounded-lg max-w-3xl mx-auto">
                {/* Step 1: MR Number Entry */}
                {step === 1 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner">
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">Enter MR Number</h2>

                        <div className="space-y-4">
                            <div>
                                <input
                                    type="text"
                                    value={mrNumber}
                                    onChange={(e) => setMrNumber(e.target.value)}
                                    placeholder="Enter MR Number"
                                    ref={mrNumberRef}
                                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            fetchPatientByMRNumber();
                                        }
                                    }}
                                />
                                {validationErrors.mrNumber && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.mrNumber}</p>
                                )}
                            </div>

                            <button
                                onClick={fetchPatientByMRNumber}
                                disabled={isLoading}
                                className={`w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg 
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                type="button"
                            >
                                {isLoading ? 'Searching...' : 'Search'}
                            </button>

                            {/* Patient Details Display */}
                            {patientDetails && (
                                <div className="mt-4 bg-gray-100 p-4 rounded border border-gray-200">
                                    <p>
                                        <strong>Name:</strong> {patientDetails.name}
                                    </p>
                                    <p>
                                        <strong>Age:</strong> {patientDetails.age}
                                    </p>
                                    <p>
                                        <strong>Gender:</strong> {patientDetails.gender}
                                    </p>
                                    <p>
                                        <strong>Address:</strong> {patientDetails.address}
                                    </p>
                                    <p>
                                        <strong>Phone number:</strong>{" "}
                                        {patientDetails.phone_number}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-center space-x-4">
                    {step > 1 && (
                        <button
                            type="button"
                            onClick={prevStep}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                        >
                            Previous
                        </button>
                    )}
                    {step < 5 && patientDetails && (
                        <button
                            type="button"
                            ref={nextButtonRef}
                            onClick={nextStep}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
                        >
                            Next
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
});

export default InsuranceCheckout;
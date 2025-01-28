import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const CheckoutInsurance = () => {
    const { branch, role } = useAuth();
    const navigate = useNavigate();

    // Step Management
    const [currentStep, setCurrentStep] = useState(1);

    // Step 01: MR Number
    const [mrNumber, setMrNumber] = useState('');
    const mrRef = useRef(null);

    // Patient Details
    const [patientDetails, setPatientDetails] = useState(null);

    // Step 03: Counseling Room IDs (s_ids)
    const [counselingList, setCounselingList] = useState([]);

    // Amounts
    const [totalAmount, setTotalAmount] = useState('');
    const [approvedAmount, setApprovedAmount] = useState('');
    const [balancePay, setBalancePay] = useState('');

    // Loading & Errors
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // ─────────────────────────────────────────────────────────────
    //  STEP NAVIGATION
    // ─────────────────────────────────────────────────────────────
    const nextStep = () => setCurrentStep((p) => p + 1);
    const prevStep = () => setCurrentStep((p) => p - 1);

    // ─────────────────────────────────────────────────────────────
    //  STEP 01: FETCH PATIENT & INSURANCE DETAILS BY MR NO
    // ─────────────────────────────────────────────────────────────
    const handleFetchDetails = useCallback(async () => {
        if (!mrNumber.trim()) {
            setErrors({ mrNumber: 'MR Number is required' });
            return;
        }
        setIsLoading(true);
        setErrors({});

        try {
            // Example: fetch the patient_details from your table
            const { data, error } = await supabase
                .from('patient_details')
                .select('*')
                .eq('mr_number', mrNumber.trim())
                .single();
            if (error) throw error;

            setPatientDetails(data);
            // Example fields
            setTotalAmount(data?.total_amount || '');
            setApprovedAmount(data?.approved_amount || '');
            setErrors({});
            nextStep();
        } catch (err) {
            console.error('Error fetching details:', err);
            setErrors({ fetch: 'Failed to fetch patient details' });
        } finally {
            setIsLoading(false);
        }
    }, [mrNumber]);

    // ─────────────────────────────────────────────────────────────
    //  STEP 03: FETCH COUNSELING ROOM ENTRIES (S_IDS)
    // ─────────────────────────────────────────────────────────────
    const fetchCounselingEntries = useCallback(async () => {
        try {
            // Example: fetch s_ids from a "counseling_room" table
            const { data, error } = await supabase
                .from('counseling_room')
                .select('*')
                .eq('mr_number', mrNumber.trim());
            if (error) throw error;

            setCounselingList(data || []);
            nextStep();
        } catch (err) {
            console.error('Error fetching counseling entries:', err);
            setErrors({ counseling: 'Failed to fetch counseling entries' });
        }
    }, [mrNumber]);

    // ─────────────────────────────────────────────────────────────
    //  STEP 04: CALCULATE BALANCE PAYMENT
    //  Formula: Balance_pay = Total Amount - Approved_amount
    // ─────────────────────────────────────────────────────────────
    const calculateBalance = useCallback(() => {
        if (!totalAmount || !approvedAmount) {
            setErrors({ balance: 'Make sure total & approved are valid' });
            return;
        }
        const balance = parseFloat(totalAmount) - parseFloat(approvedAmount);
        setBalancePay(balance.toFixed(2));
        nextStep();
    }, [totalAmount, approvedAmount]);

    // ─────────────────────────────────────────────────────────────
    //  STEP 05: BILL PREVIEW & PRINT
    // ─────────────────────────────────────────────────────────────
    const handlePrint = () => {
        // Add your print logic or open a print preview
        window.print();
    };

    // ─────────────────────────────────────────────────────────────
    //  RENDER UI
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
            <div className="max-w-3xl w-full bg-white rounded-md shadow-lg p-6">
                <h1 className="text-2xl font-bold mb-6 text-center">
                    Insurance Checkout
                </h1>

                {/* Step Navigation Indicator (if desired) */}
                <div className="flex mb-6">
                    {Array.from({ length: 5 }, (_, i) => (
                        <div
                            key={i}
                            className={`flex-1 h-2 rounded-full mx-1 ${currentStep > i ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                        />
                    ))}
                </div>

                {/* Step 01: MR Number */}
                {currentStep === 1 && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                MR Number
                            </label>
                            <input
                                type="text"
                                className="w-full border rounded-md px-3 py-2"
                                placeholder="Enter MR Number"
                                ref={mrRef}
                                value={mrNumber}
                                onChange={(e) => setMrNumber(e.target.value)}
                            />
                            {errors.mrNumber && (
                                <p className="text-red-500 text-sm mt-1">{errors.mrNumber}</p>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={handleFetchDetails}
                                disabled={isLoading}
                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                            >
                                {isLoading ? 'Loading...' : 'Fetch'}
                            </button>
                        </div>
                        {errors.fetch && (
                            <p className="text-red-500 text-sm mt-2">{errors.fetch}</p>
                        )}
                    </div>
                )}

                {/* Step 02: (Already moved to next step if check passes) */}
                {/* You can add an optional step or popup confirming patient details here */}

                {/* Step 03: Counseling Room Entries */}
                {currentStep === 2 && (
                    <div className="space-y-4">
                        <p className="text-gray-700">
                            Found patient: {patientDetails?.name || 'Unknown Name'}
                        </p>
                        <p className="text-gray-700">
                            Total: {patientDetails?.total_amount || 0}, Approved: {patientDetails?.approved_amount || 0}
                        </p>

                        <div className="flex justify-end">
                            <button
                                onClick={fetchCounselingEntries}
                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                            >
                                Fetch Counseling
                            </button>
                        </div>
                        {errors.counseling && (
                            <p className="text-red-500 text-sm mt-2">{errors.counseling}</p>
                        )}
                    </div>
                )}

                {/* Step 04: Calculate Balance Payment */}
                {currentStep === 3 && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Total Amount
                            </label>
                            <input
                                type="number"
                                value={totalAmount}
                                onChange={(e) => setTotalAmount(e.target.value)}
                                className="w-full border rounded-md px-3 py-2"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Approved Amount
                            </label>
                            <input
                                type="number"
                                value={approvedAmount}
                                onChange={(e) => setApprovedAmount(e.target.value)}
                                className="w-full border rounded-md px-3 py-2"
                            />
                        </div>

                        {errors.balance && (
                            <p className="text-red-500 text-sm mt-2">{errors.balance}</p>
                        )}

                        <div className="flex justify-end">
                            <button
                                onClick={calculateBalance}
                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                            >
                                Calculate
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 05: Bill Preview & Print */}
                {currentStep === 4 && (
                    <div className="space-y-4">
                        <div className="p-4 border rounded-md">
                            <h2 className="font-semibold text-gray-700 mb-2">
                                Bill Preview
                            </h2>
                            <p className="text-gray-700">MR No: {mrNumber}</p>
                            <p className="text-gray-700">
                                Patient Name: {patientDetails?.name || 'N/A'}
                            </p>
                            <p className="text-gray-700">
                                Total Amount: {totalAmount || 0}
                            </p>
                            <p className="text-gray-700">
                                Approved Amount: {approvedAmount || 0}
                            </p>
                            <p className="text-gray-700 font-semibold">
                                Balance Payment: {balancePay || '0.00'}
                            </p>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={handlePrint}
                                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                            >
                                Print
                            </button>
                            <button
                                onClick={() => navigate('/home')}
                                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 ml-2"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}

                {/* Step Navigation Buttons (Optional) */}
                {currentStep > 1 && currentStep < 4 && (
                    <div className="flex justify-between mt-6">
                        <button
                            onClick={prevStep}
                            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                        >
                            Previous
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckoutInsurance;
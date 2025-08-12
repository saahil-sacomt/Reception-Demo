import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabaseClient';
import { PrinterIcon, TrashIcon } from "@heroicons/react/24/outline";
import { XMarkIcon } from '@heroicons/react/24/solid'; // For solid icons

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
    // Add these states after existing state declarations
    const [productEntries, setProductEntries] = useState([]);
    const [productSuggestions, setProductSuggestions] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const productRefs = useRef([]);
    const [approvedAmount, setApprovedAmount] = useState(0);
    const [balanceAmount, setBalanceAmount] = useState(0);
    const [insuranceClaims, setInsuranceClaims] = useState([]);


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

            if (data) {
                setPatientDetails(data);
                // Fetch insurance products after patient is found
                await fetchInsuranceProducts(mrNumber);
                await fetchInsuranceClaims(mrNumber);
                nextButtonRef.current?.focus();
            }

            // setPatientDetails(data);
            // nextButtonRef.current?.focus();

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


    const fetchInsuranceProducts = async (mrNumber) => {
        if (!mrNumber) return;

        try {
            // Fetch all work orders for the MR number with insurance
            const { data: workOrders, error: workOrderError } = await supabase
                .from('work_orders')
                .select('*')
                .eq('mr_number', mrNumber)
                .eq('is_insurance', true);

            if (workOrderError) throw workOrderError;

            if (!workOrders || workOrders.length === 0) {
                setValidationErrors(prev => ({
                    ...prev,
                    products: 'No insurance work orders found for this MR number'
                }));
                return;
            }

            // Extract and normalize product entries from all work orders
            let allProducts = [];
            let total = 0;

            workOrders.forEach(workOrder => {
                if (workOrder.product_entries && Array.isArray(workOrder.product_entries)) {
                    workOrder.product_entries.forEach(product => {
                        // Add each product to the array
                        allProducts.push({
                            id: product.id || null,
                            product_id: product.product_id,
                            name: product.product_name || product.name || "",
                            price: parseFloat(product.price) || 0,
                            quantity: parseInt(product.quantity, 10) || 0,
                            work_order_id: workOrder.work_order_id // Track which work order it came from
                        });

                        // Add to total
                        total += (parseFloat(product.price) || 0) * (parseInt(product.quantity, 10) || 0);
                    });
                }
            });

            setProductEntries(allProducts);
            setTotalAmount(total);

        } catch (error) {
            console.error('Error fetching insurance products:', error);
            setValidationErrors(prev => ({
                ...prev,
                products: 'Error fetching insurance products'
            }));
        }
    };


    // const fetchInsuranceClaims = async (mrNumber) => {
    //     try {
    //         const { data, error } = await supabase
    //             .from('insurance_claims')
    //             .select('*')
    //             .eq('mr_number', mrNumber)
    //             .neq('status', 'pending');

    //         if (error) throw error;

    //         if (data && data.length > 0) {
    //             setInsuranceClaims(data);
    //             const totalApproved = data.reduce((sum, claim) =>
    //                 sum + (parseFloat(claim.approved_amount) || 0), 0
    //             );
    //             setApprovedAmount(totalApproved);
    //             setBalanceAmount(totalAmount - totalApproved);
    //         }
    //     } catch (error) {
    //         console.error('Error fetching insurance claims:', error);
    //         setValidationErrors(prev => ({
    //             ...prev,
    //             claims: 'Error fetching insurance claims'
    //         }));
    //     }
    // };

    // Adding useEffect to calculate balance when totalAmount or approvedAmount changes
    const fetchInsuranceClaims = async (mrNumber) => {
        try {
            console.log('Fetching claims for MR:', mrNumber);

            const { data, error } = await supabase
                .from('insurance_claims')
                .select('*')
                .eq('mr_number', mrNumber)
                .eq('status', 'pending');

            if (error) throw error;

            console.log('Fetched claims:', data);

            if (data && data.length > 0) {
                setInsuranceClaims(data);

                // Fix approved amount calculation
                const totalApproved = data.reduce((sum, claim) => {
                    const claimAmount = typeof claim.approved_amount === 'string'
                        ? parseFloat(claim.approved_amount)
                        : Number(claim.approved_amount) || 0;

                    console.log('Claim amount:', claimAmount);
                    return sum + claimAmount;
                }, 0);

                console.log('Total approved:', totalApproved);
                setApprovedAmount(totalApproved);

                // Calculate balance with type checking
                const balance = Number(totalAmount) - Number(totalApproved);
                console.log('Calculated balance:', balance);
                setBalanceAmount(balance);
            } else {
                // Reset values if no claims found
                setInsuranceClaims([]);
                setApprovedAmount(0);
                setBalanceAmount(Number(totalAmount));
            }
        } catch (error) {
            console.error('Error in fetchInsuranceClaims:', error);
            setValidationErrors(prev => ({
                ...prev,
                claims: 'Error fetching insurance claims'
            }));
        }
    };
    useEffect(() => {
        const total = Number(totalAmount) || 0;
        const approved = Number(approvedAmount) || 0;
        const balance = total - approved;

        console.log('Balance calculation:', {
            total,
            approved,
            balance
        });

        setBalanceAmount(balance);
    }, [totalAmount, approvedAmount]);


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
                                className={`w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg 
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

                {step === 2 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-6">
                        <h2 className="text-lg font-semibold text-gray-700 mb-4"> Services</h2>

                        {productEntries.length > 0 ? (
                            <div className="space-y-4">
                                <table className="w-full border-collapse mb-4">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            {/* <th className="border p-2 text-left"> ID</th> */}
                                            <th className="border p-2 text-left">Service Name</th>
                                            <th className="border p-2 text-right">Price</th>
                                            <th className="border p-2 text-right">Quantity</th>
                                            <th className="border p-2 text-right">Total</th>
                                            <th className="border p-2 text-left">Work Order</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productEntries.map((product, index) => (
                                            <tr key={index}>
                                                {/* <td className="border p-2">{product.product_id}</td> */}
                                                <td className="border p-2">{product.name}</td>
                                                <td className="border p-2 text-right">₹{product.price}</td>
                                                <td className="border p-2 text-right">{product.quantity}</td>
                                                <td className="border p-2 text-right">
                                                    ₹{(product.price * product.quantity).toFixed(2)}
                                                </td>
                                                <td className="border p-2">{product.work_order_id}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50">
                                            <td colSpan="4" className="border p-2 text-right font-bold">
                                                Total Amount:
                                            </td>
                                            <td className="border p-2 text-right font-bold">
                                                ₹{totalAmount.toFixed(2)}
                                            </td>
                                            <td className="border p-2"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">
                                No insurance products found for this MR number
                            </div>
                        )}
                    </div>
                )}


                {step === 3 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-6">
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">Payment Details</h2>

                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="col-span-2">
                                        <h3 className="font-semibold mb-2">Insurance Claims</h3>
                                        {insuranceClaims.length > 0 ? (
                                            <table className="w-full">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        {/* <th className="p-2 text-left">Claim ID</th> */}
                                                        <th className="p-2 text-left">Status</th>
                                                        <th className="p-2 text-right">Approved Amount</th>
                                                        <th className="p-2 text-left">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {insuranceClaims.map((claim, index) => (
                                                        <tr key={index} className="border-b">
                                                            {/* <td className="p-2">{claim.claim_id}</td> */}
                                                            <td className="p-2">{claim.status}</td>
                                                            <td className="p-2 text-right">₹{parseFloat(claim.approved_amount).toFixed(2)}</td>
                                                            <td className="p-2">{new Date(claim.created_at).toLocaleDateString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <p className="text-gray-500">No approved claims found</p>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="grid grid-cols-2 gap-4 text-lg">
                                        <div className="font-medium">Total Amount:</div>
                                        <div className="text-right">₹{totalAmount.toFixed(2)}</div>

                                        <div className="font-medium">Total Approved Amount:</div>
                                        <div className="text-right">₹{approvedAmount.toFixed(2)}</div>

                                        <div className="font-medium text-blue-600">Balance Payment:</div>
                                        <div className="text-right text-blue-600 font-bold">
                                            ₹{balanceAmount.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <>
                        <div className="bg-gray-50 p-6 rounded-md shadow-inner">
                            <h2 className="text-lg font-semibold text-gray-700 mb-4">Bill Preview</h2>

                            <div className="bg-white rounded-lg text-gray-800">
                                <div className="printable-area print:mt-20 print:block print:absolute print:inset-0 print:w-full bg-white p-4 print:m-0 print:p-0 w-full">
                                    {/* Bill Header */}
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-3xl font-bold">Insurance Bill</h2>
                                        <div className="text-right">
                                            <p>Date: <strong>{formattedDate}</strong></p>
                                            <p>MR No: <strong>{mrNumber}</strong></p>
                                        </div>
                                    </div>

                                    {/* Patient Details */}
                                    <div className="mb-6">
                                        <p>Name: <strong>{patientDetails?.name || 'N/A'} | {patientDetails?.age || 'N/A'} | {patientDetails?.gender || 'N/A'}</strong></p>
                                        <p>Address: <strong>{patientDetails?.address || 'N/A'}</strong></p>
                                        <p>Phone Number: <strong>{patientDetails?.phone_number || 'N/A'}</strong></p>
                                    </div>

                                    {/* Services Table */}
                                    <table className="w-full border-collapse mb-6">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th className="border p-2 text-left">Service Name</th>
                                                <th className="border p-2 text-right">Price</th>
                                                <th className="border p-2 text-right">Quantity</th>
                                                <th className="border p-2 text-right">Total</th>
                                                <th className="border p-2 text-left">Work Order</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productEntries.map((service, index) => (
                                                <tr key={index}>
                                                    <td className="border p-2">{service.name}</td>
                                                    <td className="border p-2 text-right">₹{service.price}</td>
                                                    <td className="border p-2 text-right">{service.quantity}</td>
                                                    <td className="border p-2 text-right">₹{(service.price * service.quantity).toFixed(2)}</td>
                                                    <td className="border p-2">{service.work_order_id}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Amount Details */}
                                    <div className="flex justify-end mb-6">
                                        <div className="w-64">
                                            <div className="border-t pt-4">
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-medium">Total Amount:</span>
                                                    <span>₹{totalAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-medium">Approved Amount:</span>
                                                    <span>₹{approvedAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between font-bold text-blue-600">
                                                    <span>Balance Payment:</span>
                                                    <span>₹{balanceAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-center space-x-4 mt-6 print:hidden">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="flex items-center bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
                                >
                                    <PrinterIcon className="w-5 h-5 mr-2" />
                                    Print Bill
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navigate('/dashboard')}
                                    className="flex items-center bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg"
                                >
                                    <XMarkIcon className="w-5 h-5 mr-2" />
                                    Exit
                                </button>
                            </div>
                        </div>
                    </>
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
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
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
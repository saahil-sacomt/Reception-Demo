// client/src/pages/SalesOrderGeneration.jsx
import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import axios from 'axios';
import { PrinterIcon } from '@heroicons/react/24/outline';

const SalesOrderGeneration = ({ isCollapsed }) => {
    const [step, setStep] = useState(1);
    const [salesOrderId, setSalesOrderId] = useState('');
    const [productEntries, setProductEntries] = useState([{ id: '', price: '', quantity: '' }]);
    const [stockStatus, setStockStatus] = useState({});
    const [description, setDescription] = useState('');
    const [patientId, setPatientId] = useState('');
    const [patientDetails, setPatientDetails] = useState(null);
    const [privilegeCard, setPrivilegeCard] = useState(true);
    const [redeemOption, setRedeemOption] = useState('add');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [employee, setEmployee] = useState('');
    const [employees] = useState(['John Doe', 'Jane Smith', 'Alex Brown']);
    const [allowPrint, setAllowPrint] = useState(false);
    const [advanceDetails, setAdvanceDetails] = useState(1000); // Default value for testing
    const [paymentMethod, setPaymentMethod] = useState('');
    const [validationErrors, setValidationErrors] = useState({});

    // Refs for input fields to control focus
    const descriptionRef = useRef(null);
    const patientIdRef = useRef(null);
    const fetchButtonRef = useRef(null);
    const privilegePhoneRef = useRef(null);
    const otpRef = useRef(null);
    const employeeRef = useRef(null);
    const nextButtonRef = useRef(null);
    const paymentMethodRef = useRef(null);
    const printButtonRef = useRef(null);

    useEffect(() => {
        setSalesOrderId(nanoid());
    }, []);

    useEffect(() => {
        focusFirstFieldOfStep();
    }, [step, privilegeCard]);

    const focusFirstFieldOfStep = () => {
        if (step === 1) document.getElementById(`productId-0`)?.focus();
        if (step === 2) descriptionRef.current?.focus();
        if (step === 3) patientIdRef.current?.focus();
        if (step === 4 && privilegeCard) privilegePhoneRef.current?.focus();
        if (step === 5) employeeRef.current?.focus();
        if (step === 6) paymentMethodRef.current?.focus();
    };

    const handleEnterKey = (e, nextFieldRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextFieldRef) nextFieldRef.current?.focus();
            else nextStep();
        }
    };

    const handleProductEntryChange = (index, field, value) => {
        const updatedEntries = [...productEntries];
        updatedEntries[index][field] = value;
        setProductEntries(updatedEntries);
    };

    const handleProductEntryShiftEnter = (e, index, field) => {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            if (index === productEntries.length - 1 && productEntries[index].id) {
                setProductEntries([...productEntries, { id: '', price: '', quantity: '' }]);
                setTimeout(() => document.getElementById(`productId-${productEntries.length}`)?.focus(), 0);
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (field === 'id') document.getElementById(`productPrice-${index}`)?.focus();
            else if (field === 'price') document.getElementById(`productQuantity-${index}`)?.focus();
            else if (field === 'quantity' && index === productEntries.length - 1) nextStep();
        }
    };

    const calculateTotal = () => {
        return productEntries.reduce((total, product) => {
            const price = parseFloat(product.price) || 0;
            const quantity = parseInt(product.quantity) || 0;
            return total + price * quantity;
        }, 0);
    };

    const nextStep = () => {
        const errors = {};

        // Step 1 Validation for productEntries
        if (step === 1) {
            productEntries.forEach((product, index) => {
                if (!product.id) errors[`productId-${index}`] = 'Product ID is required';
                if (!product.price) errors[`productPrice-${index}`] = 'Price is required';
                if (!product.quantity) errors[`productQuantity-${index}`] = 'Quantity is required';
            });
        
        } else if (step === 3) {
            if (!patientId) errors.patientId = 'Patient ID is required';
        } else if (step === 4) {
            if (!phoneNumber) errors.phoneNumber = 'Phone number is required';
            if (!otp) errors.otp = 'OTP is required';
        } else if (step === 5) {
            if (!employee) errors.employee = 'Employee selection is required';
        } else if (step === 6) {
            if (!paymentMethod) errors.paymentMethod = 'Payment method is required';
        }

        setValidationErrors(errors);

        // If no errors, proceed to the next step
        if (Object.keys(errors).length === 0) {
            if (step < 6) setStep((prevStep) => prevStep + 1);
            else if (step === 6 && allowPrint) handlePrint();
            else if (step === 6) setAllowPrint(true);
        }
    };

    const prevStep = () => setStep((prevStep) => Math.max(prevStep - 1, 1));

    const handleMRNumberSearch = async () => {
        try {
            const response = await axios.get(`/api/patient-details/${patientId}`);
            setPatientDetails({
                name: response.data.name,
                age: response.data.age,
                condition: response.data.condition,
            });
            setAdvanceDetails(response.data.advanceAmount || 1000); // Default value if backend fails
            nextButtonRef.current?.focus();
        } catch (error) {
            console.error('Error fetching patient details:', error);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && step === 6) {
                e.preventDefault();
                if (allowPrint) handlePrint();
                else setAllowPrint(true);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [step, allowPrint]);

    return (
        <div className={`transition-all duration-300 ${isCollapsed ? 'mx-20' : 'mx-20 px-20'} justify-center mt-16 p-4 mx-auto`}>
            <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">Sales Order Generation</h1>

            {/* Progress Tracker */}
            <div className="flex items-center mb-8 w-2/3 mx-auto">
                {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className={`flex-1 h-2 rounded-xl mx-1 ${step > i + 1 ? 'bg-[#5db76d]' : 'bg-gray-300'} transition-all duration-300`} />
                ))}
            </div>

            <form className="space-y-8 bg-white p-6 rounded-lg max-w-2xl mx-auto" onSubmit={(e) => e.preventDefault()}>
                {/* Step 1: Sales Order ID and Product Details */}
                {step === 1 && (
                    <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-6">
                        <h2 className="text-lg font-semibold text-gray-700 text-center">Product Information</h2>
                        <label className="block text-gray-700 font-medium mb-1">Generated Sales Order ID</label>
                        <input
                            type="text"
                            value={salesOrderId}
                            readOnly
                            className="border border-gray-300 px-4 py-3 rounded-lg bg-gray-200 text-gray-700 w-full text-center"
                        />
                        <label className="block text-gray-700 font-medium mb-1">Product Details</label>
                        {productEntries.map((product, index) => (
                            <div key={index} className="flex space-x-2 items-center">
                                <div className="relative w-1/2">
                                    <input
                                        type="text"
                                        id={`productId-${index}`}
                                        placeholder="Product ID / Scan Barcode"
                                        value={product.id}
                                        onChange={(e) => handleProductEntryChange(index, 'id', e.target.value)}
                                        onKeyDown={(e) => handleProductEntryShiftEnter(e, index, 'id')}
                                        className="border border-gray-300 px-4 py-3 rounded-lg w-full"
                                    />
                                    {validationErrors[`productId-${index}`] && (
                                        <p className="text-red-500 text-xs absolute -bottom-5 left-0">{validationErrors[`productId-${index}`]}</p>
                                    )}
                                </div>
                                <div className="relative w-1/4">
                                    <input
                                        type="text"
                                        id={`productPrice-${index}`}
                                        placeholder="Price"
                                        value={product.price}
                                        onChange={(e) => handleProductEntryChange(index, 'price', e.target.value)}
                                        onKeyDown={(e) => handleProductEntryShiftEnter(e, index, 'price')}
                                        className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center"
                                    />
                                    {validationErrors[`productPrice-${index}`] && (
                                        <p className="text-red-500 text-xs absolute -bottom-5 left-0">{validationErrors[`productPrice-${index}`]}</p>
                                    )}
                                </div>
                                <div className="relative w-1/4">
                                    <input
                                        type="text"
                                        id={`productQuantity-${index}`}
                                        placeholder="Quantity"
                                        value={product.quantity}
                                        onChange={(e) => handleProductEntryChange(index, 'quantity', e.target.value)}
                                        onKeyDown={(e) => handleProductEntryShiftEnter(e, index, 'quantity')}
                                        className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center"
                                    />
                                    {validationErrors[`productQuantity-${index}`] && (
                                        <p className="text-red-500 text-xs absolute -bottom-5 left-0">{validationErrors[`productQuantity-${index}`]}</p>
                                    )}
                                </div>
                            </div>
                            
                        ))}
                        <button
                            type="button"
                            onClick={() => setProductEntries([...productEntries, { id: '', price: '', quantity: '' }])}
                            className=" bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
                        >
                            Add Product
                        </button>
                        
                    </div>
                )}

                {/* Step 2: Stock Status, Quantity, and Description */}
                {step === 2 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4 text-center">
                        <h2 className="text-lg font-semibold text-gray-700">Stock & Product Details</h2>
                        {productEntries.map((product, index) => (
                            product.id && (
                                <div key={index} className="flex items-center justify-between">
                                    <span className="text-gray-700 font-medium">
                                        Product ID: {product.id}
                                    </span>
                                    <span className={`px-2 py-1 rounded-lg ${stockStatus[product.id] === 'in_stock' ? 'bg-green-500 text-white' : 'bg-red-600 text-white'}`}>
                                        {stockStatus[product.id] === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                                    </span>
                                </div>
                            )
                        ))}
                        <label className="block text-gray-700 font-medium mb-1 mt-4">Description</label>
                        <textarea
                            placeholder="Enter Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onKeyDown={(e) => handleEnterKey(e, nextButtonRef)} // Focus on Next button after pressing Enter
                            ref={descriptionRef}
                            className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center"
                        />
                    
                    </div>
                )}

                {/* Step 3: Patient ID and Advance Payment */}
                {step === 3 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Patient & Payment Information</h2>
                        <label className="block text-gray-700 font-medium mb-1">Enter Patient ID</label>
                        <input
                            type="text"
                            placeholder="Enter Patient ID"
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            onKeyDown={(e) => handleEnterKey(e, fetchButtonRef)}
                            ref={patientIdRef}
                            className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        />
                        {validationErrors.patientId && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.patientId}</p>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                handleMRNumberSearch();
                                nextButtonRef.current?.focus();
                            }}
                            ref={fetchButtonRef}
                            className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
                        >
                            Fetch Patient Details
                        </button>
                        {patientDetails && (
                            <div className="mt-4 bg-gray-100 p-4 rounded border border-gray-200">
                                <p><strong>Name:</strong> {patientDetails.name}</p>
                                <p><strong>Age:</strong> {patientDetails.age}</p>
                                <p><strong>Condition:</strong> {patientDetails.condition}</p>
                            </div>
                        )}
                        {advanceDetails !== null && (
                            <div className="mt-4 bg-gray-100 p-4 rounded border border-gray-200">
                                <p><strong>Advance Paid:</strong> {advanceDetails}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: Privilege Card & OTP */}
                {step === 4 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Privilege Card</h2>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={privilegeCard}
                                onChange={() => setPrivilegeCard(!privilegeCard)}
                                className="mr-2"
                            />
                            Do you have a Privilege Card?
                        </label>
                        {privilegeCard && (
                            <div className="space-y-4">
                                <div className="flex space-x-4">
                                    <button
                                        type="button"
                                        onClick={() => setRedeemOption('redeem')}
                                        className={`px-4 py-2 rounded-lg w-full font-medium transition-colors duration-200 ${redeemOption === 'redeem' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    >
                                        Redeem Points
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRedeemOption('add')}
                                        className={`px-4 py-2 rounded-lg w-full font-medium transition-colors duration-200 ${redeemOption === 'add' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                    >
                                        Add Points
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Enter Phone Number"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    onKeyDown={(e) => handleEnterKey(e, otpRef)}
                                    ref={privilegePhoneRef}
                                    className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center"
                                />
                                {validationErrors.phoneNumber && (
                                    <p className="text-red-500 text-xs mt-1">{validationErrors.phoneNumber}</p>
                                )}
                                <input
                                    type="text"
                                    placeholder="Enter OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
                                    ref={otpRef}
                                    className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center"
                                />
                                {validationErrors.otp && (
                                    <p className="text-red-500 text-xs mt-1">{validationErrors.otp}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 5: Employee Selection */}
                {step === 5 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Order Created by Employee Details</h2>
                        <select
                            value={employee}
                            onChange={(e) => setEmployee(e.target.value)}
                            onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
                            ref={employeeRef}
                            className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center"
                        >
                            <option value="" disabled>Sales Order Created By</option>
                            {employees.map((emp) => (
                                <option key={emp} value={emp}>{emp}</option>
                            ))}
                        </select>
                        {validationErrors.employee && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.employee}</p>
                        )}
                    </div>
                )}

                {/* Step 6: Order Preview with Payment Method */}
                {step === 6 && (
                    <div className="bg-white p-8 rounded space-y-4 text-gray-800">
                        <div className='flex justify-between'>
                            <h2 className="text-xl font-semibold">Order Summary</h2>
                            <button onClick={handlePrint} ref={printButtonRef} className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-5 py-2 transition">
                                <PrinterIcon className='w-5 h-5' />
                            </button>
                        </div>
                        <div className=" mb-6">
                            <p><strong>Sales Order ID:</strong> {salesOrderId}</p>
                            <p><strong>Description:</strong> {description}</p>
                            <p><strong>Patient ID:</strong> {patientId}</p>
                            <p><strong>Billed by Employee Name:</strong> {employee}</p>
                        </div>
                        <table className="w-full border border-gray-300 rounded-md">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="py-2 px-4 border-b">Product ID</th>
                                    <th className="py-2 px-4 border-b">Price</th>
                                    <th className="py-2 px-4 border-b">Quantity</th>
                                    <th className="py-2 px-4 border-b">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productEntries.map((product, index) => {
                                    const subtotal = (parseFloat(product.price) || 0) * (parseInt(product.quantity) || 0);
                                    return (
                                        <tr key={index} className="text-center">
                                            <td className="py-2 px-4 border-b">{product.id}</td>
                                            <td className="py-2 px-4 border-b">{product.price}</td>
                                            <td className="py-2 px-4 border-b">{product.quantity}</td>
                                            <td className="py-2 px-4 border-b">{subtotal.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="mt-6">
                            <p><strong>Total Amount:</strong> {calculateTotal().toFixed(2)}</p>
                            <p><strong>Advance Paid:</strong> {parseFloat(advanceDetails) || 0}</p>
                            <p><strong>Balance Due:</strong> {(calculateTotal() - (parseFloat(advanceDetails) || 0)).toFixed(2)}</p>
                        </div>
                        <label className="block font-bold mt-6 mb-1">Payment Method</label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            ref={paymentMethodRef}
                            onKeyDown={(e) => handleEnterKey(e, printButtonRef)}
                            className="border border-gray-300 w-1/2 px-4 py-3 rounded-lg text-center"
                        >
                            <option value="" disabled>Select Payment Method</option>
                            <option value="cash">Cash</option>
                            <option value="credit">Card</option>
                            <option value="online">UPI (Paytm/PhonePe/GPay)</option>
                        </select>
                        {validationErrors.paymentMethod && (
                            <p className="text-red-500 text-xs mt-1">{validationErrors.paymentMethod}</p>
                        )}
                    </div>
                )}


                {/* Navigation Buttons */}
                <div className="flex justify-center mt-6">
                    {step > 1 && (
                        <button onClick={prevStep} className="bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg">
                            Previous
                        </button>
                    )}
                    {step < 6 && (
                        <button ref={nextButtonRef} onClick={nextStep} className="bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg">
                            Next
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default SalesOrderGeneration;

// client/src/pages/SalesOrderGeneration.jsx
import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import axios from 'axios';
import { CalendarIcon, DocumentTextIcon, PrinterIcon } from '@heroicons/react/24/outline';

const SalesOrderGeneration = ({ isCollapsed }) => {
    const [step, setStep] = useState(1);
    const [salesOrderId, setSalesOrderId] = useState('');
    const [productIds, setProductIds] = useState(['']);
    const [stockStatus, setStockStatus] = useState('');
    const [quantity, setQuantity] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [patientId, setPatientId] = useState('');
    const [patientDetails, setPatientDetails] = useState(null);
    const [privilegeCard, setPrivilegeCard] = useState(false);
    const [redeemOption, setRedeemOption] = useState('add');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [employee, setEmployee] = useState('');
    const [advanceDetails, setAdvanceDetails] = useState(null);
    const [employees] = useState(['John Doe', 'Jane Smith', 'Alex Brown']); // Dummy employee list

    useEffect(() => {
        setSalesOrderId(nanoid());
    }, []);

    // Function to fetch stock status from the backend
    const fetchStockStatus = async (productId) => {
        try {
            const response = await axios.get(`/api/stock-status/${productId}`);
            const { status } = response.data; // Assume the API returns { status: "in_stock" or "out_of_stock" }
            setStockStatus((prevStatus) => ({
                ...prevStatus,
                [productId]: status,
            }));
        } catch (error) {
            console.error('Error fetching stock status:', error);
        }
    };

    const handleProductIdChange = (index, value) => {
        // Update the specific product ID in the array
        const updatedProductIds = [...productIds];
        updatedProductIds[index] = value;
        setProductIds(updatedProductIds);

        // If this is the last input and it has a value, add a new empty field
        if (index === productIds.length - 1 && value) {
            setProductIds([...updatedProductIds, '']);
        }
    };

    const handleScan = (index, e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (index === productIds.length - 1 && productIds[index]) {
                setProductIds([...productIds, '']);
            }
        }
    };

    const nextStep = (e) => {
        e.preventDefault();
        setStep((prevStep) => Math.min(prevStep + 1, 7));
    };

    const prevStep = (e) => {
        e.preventDefault();
        setStep((prevStep) => Math.max(prevStep - 1, 1));
    };

    // Function to fetch patient and advance payment details from backend
    const handlePatientDetailsFetch = async () => {
        try {
            const response = await axios.get(`/api/patient-details/${patientId}`);
            setPatientDetails({
                name: response.data.name,
                age: response.data.age,
                condition: response.data.condition,
            });
            setAdvanceDetails(response.data.advanceAmount); // Assuming advanceAmount is returned by the backend
        } catch (error) {
            console.error('Error fetching patient details:', error);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className={`transition-all duration-300 ${isCollapsed ? 'ml-2' : 'ml-2'} mt-16 p-4 max-w-5xl`}>
            <h1 className="text-2xl font-semibold text-gray-700 mb-8">Sales Order Generation</h1>

            {/* Progress Tracker */}
            <div className="flex justify-around items-center mb-8">
                {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className={`flex-1 h-2 mx-1 rounded-xl ${step > i + 1 ? 'bg-[#5db76d]' : 'bg-gray-300'} transition-all duration-300`} />
                ))}
            </div>

            <form className="space-y-8 bg-white p-6 rounded-lg" onSubmit={(e) => e.preventDefault()}>

                {/* Step 1: Sales Order ID and Product ID */}
                {step === 1 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Product Information</h2>
                        <label className="block text-gray-700 font-medium mb-1">Generated Sales Order ID</label>
                        <input
                            type="text"
                            value={salesOrderId}
                            readOnly
                            className="border border-gray-300 px-4 py-3 rounded-lg bg-gray-200 text-gray-700 w-full"
                        />

                        <label className="block text-gray-700 font-medium mb-1">Product ID or Barcode</label>
                        {productIds.map((productId, index) => (
                            <input
                                key={index}
                                type="text"
                                placeholder="Enter Product ID or Scan Barcode"
                                value={productId}
                                onChange={(e) => handleProductIdChange(index, e.target.value)}
                                onKeyDown={(e) => handleScan(index, e)}
                                className="border border-gray-300 px-4 py-3 rounded-lg w-full mb-2"
                            />
                        ))}
                    </div>
                )}

                {/* Step 2: Stock Status based on fetched data */}
                {step === 2 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Stock Status</h2>
                        {productIds.map((productId, index) => (
                            productId && (
                                <div key={index} className="flex items-center justify-between">
                                    <span className="text-gray-700 font-medium">
                                        Product ID: {productId}
                                    </span>
                                    <span className={`px-2 py-1 rounded-lg ${stockStatus[productId] === 'in_stock' ? 'bg-green-500 text-white' : 'bg-red-600 text-white'}`}>
                                        {stockStatus[productId] === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                                    </span>
                                </div>
                            )
                        ))}
                    </div>
                )}

                {/* Step 3: Quantity and Description */}
                {step === 3 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Product Details</h2>
                        {stockStatus === 'in_stock' ? (
                            <>
                                <label className="block text-gray-700 font-medium mb-1">Quantity</label>
                                <input
                                    type="text"
                                    placeholder="Enter Quantity"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                                />
                                <label className="block text-gray-700 font-medium mb-1">Description</label>
                                <textarea
                                    placeholder="Enter Description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                                />
                            </>
                        ) : (
                            <p className="text-center text-gray-600 font-medium">
                                This product is currently <span className="text-red-500">out of stock</span>. Please check back later.
                            </p>
                        )}
                    </div>
                )}

                {/* Step 4: Patient ID, Advance Payment, and Amount */}
                {step === 4 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Patient & Payment Information</h2>

                        {/* Patient ID Input */}
                        <label className="block text-gray-700 font-medium mb-1">Enter Patient ID</label>
                        <input
                            type="text"
                            placeholder="Enter Patient ID"
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        />

                        {/* Fetch Patient Details Button */}
                        <button
                            type="button"
                            onClick={handlePatientDetailsFetch}
                            className="mt-2 bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] text-white px-4 py-2 rounded-lg transition"
                        >
                            Fetch Patient Details
                        </button>

                        {/* Displaying Fetched Patient Details */}
                        {patientDetails && (
                            <div className="mt-4 bg-gray-100 p-4 rounded border border-gray-200">
                                <p><strong>Name:</strong> {patientDetails.name}</p>
                                <p><strong>Age:</strong> {patientDetails.age}</p>
                                <p><strong>Condition:</strong> {patientDetails.condition}</p>
                            </div>
                        )}

                        {/* Displaying Fetched Advance Payment Details */}
                        {advanceDetails !== null && (
                            <div className="mt-4 bg-gray-100 p-4 rounded border border-gray-200">
                                <p><strong>Advance Paid:</strong> ${advanceDetails}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 5: Privilege Card & OTP */}
                {step === 5 && (
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
                                        className={`px-4 py-2 rounded-lg w-full font-medium transition-colors duration-200 ${redeemOption === 'redeem' ? 'bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                    >
                                        Redeem Points
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRedeemOption('add')}
                                        className={`px-4 py-2 rounded-lg w-full font-medium transition-colors duration-200 ${redeemOption === 'add' ? 'bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                    >
                                        Add Points
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Enter Phone Number"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                                />
                                <input
                                    type="text"
                                    placeholder="Enter OTP"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Step 6: Employee Selection */}
                {step === 6 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Employee</h2>
                        <select
                            value={employee}
                            onChange={(e) => setEmployee(e.target.value)}
                            className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        >
                            <option value="">Select Employee</option>
                            {employees.map((emp) => (
                                <option key={emp} value={emp}>{emp}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Step 7: Order Preview */}
                {step === 7 && (
                    <div className="bg-white p-8 rounded space-y-4 text-gray-800">
                        <div className='flex justify-between'>
                            <h2 className="text-xl font-semibold">Order Summary</h2>
                            <button onClick={handlePrint} className="  bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] text-white rounded-lg px-5 py-2 transition">
                                <PrinterIcon className='w-5 h-5' />
                            </button>
                        </div>
                        <p><strong>Sales Order ID:</strong> {salesOrderId}</p>
                        <p><strong>Product ID:</strong> {productIds}</p>
                        <p><strong>Stock Status:</strong> {stockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}</p>
                        <p><strong>Quantity:</strong> {quantity}</p>
                        <p><strong>Description:</strong> {description}</p>
                        <p><strong>Patient ID:</strong> {patientId}</p>
                        <p><strong>Privilege Card:</strong> {privilegeCard ? 'Yes' : 'No'}</p>
                        <p><strong>Employee:</strong> {employee}</p>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-center mt-6 ">
                    {step > 1 && (
                        <button onClick={prevStep} className="bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] text-white mx-2 px-4 py-2 rounded-lg  ">
                            Previous
                        </button>
                    )}
                    {step < 7 && (
                        <button onClick={nextStep} className="bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] text-white mx-2 px-4 py-2 rounded-lg">
                            Next
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default SalesOrderGeneration;

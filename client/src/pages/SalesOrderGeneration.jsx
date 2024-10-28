// client/src/pages/SalesOrderGeneration.jsx
import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { CalendarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const SalesOrderGeneration = () => {
    const [step, setStep] = useState(1);
    const [salesOrderId, setSalesOrderId] = useState('');
    const [productId, setProductId] = useState('');
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
    const [employees] = useState(['John Doe', 'Jane Smith', 'Alex Brown']); // Dummy employee list

    useEffect(() => {
        setSalesOrderId(nanoid());
    }, []);

    const nextStep = (e) => {
        e.preventDefault();
        setStep((prevStep) => Math.min(prevStep + 1, 7));
    };

    const prevStep = (e) => {
        e.preventDefault();
        setStep((prevStep) => Math.max(prevStep - 1, 1));
    };

    const handlePatientDetailsFetch = () => {
        setPatientDetails({
            name: 'Patient Name',
            age: 45,
            condition: 'Sample Condition',
        });
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-10">
            <h1 className="text-2xl font-semibold text-gray-700 mb-8">Sales Order Generation</h1>

            {/* Progress Tracker */}
            <div className="flex justify-around items-center mb-8">
                {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className={`flex-1 h-2 rounded-xl ${step > i + 1 ? 'bg-[#05668d]' : 'bg-gray-300'} transition-all duration-300`} />
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
                        <input
                            type="text"
                            placeholder="Enter Product ID or Scan Barcode"
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            className="border border-gray-300 px-4 py-3 rounded-lg w-full"
                        />
                    </div>
                )}

                {/* Step 2: Stock Status */}
                {step === 2 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Stock Status</h2>
                        <div className="flex space-x-4">
                            <button
                                type="button"
                                onClick={() => setStockStatus('in_stock')}
                                className={`px-4 py-2 rounded-lg w-full font-medium transition-colors duration-200 ${stockStatus === 'in_stock' ? 'bg-[#05668d] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                In Stock
                            </button>
                            <button
                                type="button"
                                onClick={() => setStockStatus('out_of_stock')}
                                className={`px-4 py-2 rounded-lg w-full font-medium transition-colors duration-200 ${stockStatus === 'out_of_stock' ? 'bg-[#05668d] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                Out of Stock
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Quantity and Description if in stock or message if out of stock */}
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

                {/* Step 4: Patient ID and Amount */}
                {step === 4 && (
                    <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700">Patient & Payment Information</h2>
                        <label className="block text-gray-700 font-medium mb-1">Enter Patient ID</label>
                        <input
                            type="text"
                            placeholder="Enter Patient ID"
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        />
                        <button
                            type="button"
                            onClick={handlePatientDetailsFetch}
                            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
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
                                        className={`px-4 py-2 rounded-lg w-full font-medium transition-colors duration-200 ${redeemOption === 'redeem' ? 'bg-[#05668d] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                    >
                                        Redeem Points
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRedeemOption('add')}
                                        className={`px-4 py-2 rounded-lg w-full font-medium transition-colors duration-200 ${redeemOption === 'add' ? 'bg-[#05668d] text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                        <h2 className="text-xl font-semibold">Order Summary</h2>
                        <p><strong>Sales Order ID:</strong> {salesOrderId}</p>
                        <p><strong>Product ID:</strong> {productId}</p>
                        <p><strong>Stock Status:</strong> {stockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}</p>
                        <p><strong>Quantity:</strong> {quantity}</p>
                        <p><strong>Description:</strong> {description}</p>
                        <p><strong>Patient ID:</strong> {patientId}</p>
                        <p><strong>Privilege Card:</strong> {privilegeCard ? 'Yes' : 'No'}</p>
                        <p><strong>Employee:</strong> {employee}</p>
                        <button onClick={handlePrint} className="mt-4 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition">
                            Print Bill
                        </button>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-6">
                    {step > 1 && (
                        <button onClick={prevStep} className="hover:bg-[#028090] hover:text-white px-4 py-2 rounded-lg bg-gray-300 text-black">
                            Previous
                        </button>
                    )}
                    {step < 7 && (
                        <button onClick={nextStep} className="hover:bg-[#028090] hover:text-white px-4 py-2 rounded-lg bg-gray-300 text-black">
                            Next
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default SalesOrderGeneration;

// client/src/pages/WorkOrderGeneration.jsx
import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { CalendarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const WorkOrderGeneration = () => {
  const [step, setStep] = useState(1);
  const [workOrderId, setWorkOrderId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [mrNumber, setMrNumber] = useState('');
  const [patientDetails, setPatientDetails] = useState(null);
  const [employee, setEmployee] = useState('');
  const [employees] = useState(['John Doe', 'Jane Smith', 'Alex Brown']); // Dummy employee list

  useEffect(() => {
    setWorkOrderId(nanoid());
  }, []);

  const nextStep = (e) => {
    e.preventDefault();
    setStep((prevStep) => Math.min(prevStep + 1, 6));
  };

  const prevStep = (e) => {
    e.preventDefault();
    setStep((prevStep) => Math.max(prevStep - 1, 1));
  };

  const handleMRNumberSearch = () => {
    setPatientDetails({
      name: 'Patient Name',
      age: 35,
      condition: 'Condition Description',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      <h1 className="text-2xl font-semibold text-gray-700 mb-8">Work Order Generation</h1>

      {/* Progress Tracker */}
      <div className="flex justify-around items-center mb-8">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-xl ${step > i + 1 ? 'bg-[#05668d]' : 'bg-gray-300'} transition-all duration-300`} />
        ))}
      </div>

      <form className="space-y-8 bg-white p-6 rounded-lg" onSubmit={(e) => e.preventDefault()}>

        {/* Step 1: Work Order ID and Product ID */}
        {step === 1 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">Product Information</h2>
            <label className="block text-gray-700 font-medium mb-1">Generated Work Order ID</label>
            <input
              type="text"
              value={workOrderId}
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

        {/* Step 2: Quantity and Description */}
        {step === 2 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">Product Details</h2>
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
          </div>
        )}

        {/* Step 3: Due Date */}
        {step === 3 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">Due Date</h2>
            <label className="block text-gray-700 font-medium mb-1">Select Due Date</label>
            <div className="relative">
              <CalendarIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="date"
                placeholder="Due Date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border border-gray-300 w-full px-10 py-3 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Step 4: MR Number and Patient Details */}
        {step === 4 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">MR Number</h2>
            <input
              type="text"
              placeholder="Enter MR Number of Patient"
              value={mrNumber}
              onChange={(e) => setMrNumber(e.target.value)}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg"
            />
            <button
              type="button"
              onClick={handleMRNumberSearch}
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

        {/* Step 5: Employee Selection */}
        {step === 5 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">Order Created Employee Details</h2>
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg"
            >
              <option value="">Work Order Created By</option>
              {employees.map((emp) => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
        )}

        {/* Step 6: Order Preview */}
        {step === 6 && (
          <div className="bg-white p-8 rounded space-y-4 text-gray-800">
            <h2 className="text-xl font-semibold">Order Summary</h2>
            <p><strong>Work Order ID:</strong> {workOrderId}</p>
            <p><strong>Product ID:</strong> {productId}</p>
            <p><strong>Quantity:</strong> {quantity}</p>
            <p><strong>Description:</strong> {description}</p>
            <p><strong>Due Date:</strong> {dueDate}</p>
            <p><strong>MR Number of Patient:</strong> {mrNumber}</p>
            <p><strong>Work Order created by:</strong> {employee}</p>
            <button onClick={handlePrint} className="mt-4 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition">
              Print Order
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
          {step < 6 && (
            <button onClick={nextStep} className="hover:bg-[#028090] hover:text-white px-4 py-2 rounded-lg bg-gray-300 text-black">
              Next
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default WorkOrderGeneration;

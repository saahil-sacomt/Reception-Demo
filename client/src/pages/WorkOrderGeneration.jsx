// client/src/pages/WorkOrderGeneration.jsx
import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { CalendarIcon, PrinterIcon } from '@heroicons/react/24/outline';

const WorkOrderGeneration = ({ isCollapsed }) => {
  const [step, setStep] = useState(1);
  const [workOrderId, setWorkOrderId] = useState('');
  const [productIds, setProductIds] = useState(['']);
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [advanceDetails, setAdvanceDetails] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [mrNumber, setMrNumber] = useState('');
  const [patientDetails, setPatientDetails] = useState(null);
  const [employee, setEmployee] = useState('');
  const [employees] = useState(['John Doe', 'Jane Smith', 'Alex Brown']);
  const [allowPrint, setAllowPrint] = useState(false);

  // Refs for each input field to control focus
  const quantityRef = useRef(null);
  const descriptionRef = useRef(null);
  const advanceDetailsRef = useRef(null);
  const dueDateRef = useRef(null);
  const mrNumberRef = useRef(null);
  const fetchButtonRef = useRef(null); // Ref for the fetch button
  const employeeRef = useRef(null);

  useEffect(() => {
    setWorkOrderId(nanoid());
  }, []);

  useEffect(() => {
    focusFirstFieldOfStep();
  }, [step]);

  const focusFirstFieldOfStep = () => {
    if (step === 1) document.getElementById(`productId-0`)?.focus();
    if (step === 2) quantityRef.current?.focus();
    if (step === 3) dueDateRef.current?.focus();
    if (step === 4) mrNumberRef.current?.focus();
    if (step === 5) employeeRef.current?.focus();
  };

  const handleEnterKey = (e, nextFieldRef) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      nextFieldRef?.current?.focus();
    }
  };

  const handleProductIdEnter = (e, index) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (index === productIds.length - 1 && productIds[index]) {
        setProductIds([...productIds, '']);
      } else {
        document.getElementById(`productId-${index + 1}`)?.focus();
      }
    }
  };

  const handleProductIdChange = (index, value) => {
    const updatedProductIds = [...productIds];
    updatedProductIds[index] = value;
    setProductIds(updatedProductIds);
  };

  const nextStep = () => {
    setStep((prevStep) => Math.min(prevStep + 1, 6));
  };

  const prevStep = () => {
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

  // Updated global Shift + Enter handler for consistent step navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        if (step < 6) {
          nextStep();
        } else if (step === 6 && allowPrint) {
          handlePrint();
        } else if (step === 6) {
          setAllowPrint(true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [step, allowPrint]);

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? 'mx-20' : 'mx-20 px-20'} justify-center mt-16 p-4 mx-auto`}>
      <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">Work Order Generation</h1>

      {/* Progress Tracker */}
      <div className="flex justify-around items-center mb-8">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-xl mx-1 ${step > i + 1 ? 'bg-[#5db76d]' : 'bg-gray-300'} transition-all duration-300`} />
        ))}
      </div>

      <form className="space-y-8 bg-white p-6 rounded-lg max-w-2xl mx-auto" onSubmit={(e) => e.preventDefault()}>
        {/* Step 1: Work Order ID and Product IDs */}
        {step === 1 && (
          <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-4 text-center">
            <h2 className="text-lg font-semibold text-gray-700">Product Information</h2>
            <label className="block text-gray-700 font-medium mb-1">Generated Work Order ID</label>
            <input
              type="text"
              value={workOrderId}
              readOnly
              className="border border-gray-300 px-4 py-3 rounded-lg bg-gray-200 text-gray-700 w-full text-center"
            />
            <label className="block text-gray-700 font-medium mb-1">Product IDs</label>
            <div className="space-y-2">
              {productIds.map((id, index) => (
                <input
                  key={index}
                  type="text"
                  id={`productId-${index}`}
                  placeholder="Enter Product ID or Scan Barcode"
                  value={id}
                  onChange={(e) => handleProductIdChange(index, e.target.value)}
                  onKeyDown={(e) => handleProductIdEnter(e, index)}
                  className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center"
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Quantity, Description, and Advance Details */}
        {step === 2 && (
          <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-4 text-center">
            <h2 className="text-lg font-semibold text-gray-700">Product Details</h2>
            <label className="block text-gray-700 font-medium mb-1">Quantity</label>
            <input
              type="text"
              placeholder="Enter Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => handleEnterKey(e, descriptionRef)}
              ref={quantityRef}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center"
            />
            <label className="block text-gray-700 font-medium mb-1">Description</label>
            <textarea
              placeholder="Enter Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => handleEnterKey(e, advanceDetailsRef)}
              ref={descriptionRef}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center"
            />
            <label className="block text-gray-700 font-medium mb-1">Advance Details</label>
            <input
              placeholder="Enter money paid in advance"
              value={advanceDetails}
              onChange={(e) => setAdvanceDetails(e.target.value)}
              onKeyDown={(e) => handleEnterKey(e, dueDateRef)}
              ref={advanceDetailsRef}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center"
            />
          </div>
        )}

        {/* Step 3: Due Date */}
        {step === 3 && (
          <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-4 text-center">
            <h2 className="text-lg font-semibold text-gray-700">Due Date</h2>
            <label className="block text-gray-700 font-medium mb-1">Select Due Date</label>
            <div className="relative">
              <CalendarIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onKeyDown={(e) => handleEnterKey(e, mrNumberRef)}
                ref={dueDateRef}
                className="border border-gray-300 w-full px-10 py-3 rounded-lg text-center"
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
              onKeyDown={(e) => handleEnterKey(e, fetchButtonRef)} // Move focus to fetch button
              ref={mrNumberRef}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg"
            />
            <button
              type="button"
              onClick={handleMRNumberSearch}
              ref={fetchButtonRef} // Assigning ref to the fetch button
              className="mt-2 text-white px-4 py-2 rounded-lg bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] transition"
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
            <h2 className="text-lg font-semibold text-gray-700">Order Created by Employee Details</h2>
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              ref={employeeRef}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg"
            >
              <option value="" disabled>Work Order Created By</option>
              {employees.map((emp) => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
        )}

        {/* Step 6: Order Preview */}
        {step === 6 && (
          <div className="bg-white p-8 rounded space-y-4 text-gray-800">
            <div className='flex justify-between'>
              <h2 className="text-xl font-semibold">Order Summary</h2>
              <button onClick={handlePrint} className="bg-[#5db76d] hover:bg-green-600 text-white rounded-lg px-5 py-2 transition">
                <PrinterIcon className='w-5 h-5' />
              </button>
            </div>
            <p><strong>Work Order ID:</strong> {workOrderId}</p>
            <p><strong>Product IDs:</strong> {productIds.join(', ')}</p>
            <p><strong>Quantity:</strong> {quantity}</p>
            <p><strong>Description:</strong> {description}</p>
            <p><strong>Due Date:</strong> {dueDate}</p>
            <p><strong>MR Number:</strong> {mrNumber}</p>
            <p><strong>Employee:</strong> {employee}</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-center mt-6">
          {step > 1 && (
            <button onClick={prevStep} className="bg-[#5db76d] hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg">
              Previous
            </button>
          )}
          {step < 6 && (
            <button onClick={nextStep} className="bg-[#5db76d] hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg">
              Next
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default WorkOrderGeneration;

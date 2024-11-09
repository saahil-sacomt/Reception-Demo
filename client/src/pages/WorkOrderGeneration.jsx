// client/src/pages/WorkOrderGeneration.jsx
import { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { CalendarIcon, PrinterIcon } from '@heroicons/react/24/outline';
import axios from 'axios';


const branchCode = 'NTA';

const getFinancialYear = () => {
  const currentYear = new Date().getFullYear();
  const nextYear = (currentYear + 1) % 100;
  return `${currentYear % 100}-${nextYear}`;
};

const WorkOrderGeneration = ({ isCollapsed }) => {
  const [step, setStep] = useState(1);
  const [workOrderId, setWorkOrderId] = useState('');
  const [productEntries, setProductEntries] = useState([{ id: '', price: '', quantity: '' }]);
  const [description, setDescription] = useState('');
  const [advanceDetails, setAdvanceDetails] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [mrNumber, setMrNumber] = useState('');
  const [patientDetails, setPatientDetails] = useState(null);
  const [employee, setEmployee] = useState('');
  const [employees] = useState(['John Doe', 'Jane Smith', 'Alex Brown']);
  const [allowPrint, setAllowPrint] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [isB2B, setIsB2B] = useState(false);
  const [initialCount, setInitialCount] = useState(0);


  // References for managing field focus
  const descriptionRef = useRef(null);
  const advanceDetailsRef = useRef(null);
  const dueDateRef = useRef(null);
  const mrNumberRef = useRef(null);
  const fetchButtonRef = useRef(null);
  const employeeRef = useRef(null);
  const paymentMethodRef = useRef(null);
  const printButtonRef = useRef(null);
  const nextButtonRef = useRef(null);

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };




  useEffect(() => {
    const fetchInitialCount = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/initial-count');
        setInitialCount(response.data.initialCount);
      } catch (error) {
        console.error('Error fetching initial count:', error);
      }
    };

    fetchInitialCount();
  }, []);


  // Generate work order ID based on financial year and initial count
  useEffect(() => {
    const financialYear = getFinancialYear();
    setWorkOrderId(`WO(${branchCode})-${initialCount}-${financialYear}`);
  }, [initialCount]);

  useEffect(() => {
    focusFirstFieldOfStep();
  }, [step]);

  const focusFirstFieldOfStep = () => {
    if (step === 1) document.getElementById(`productId-0`)?.focus();
    if (step === 2) descriptionRef.current?.focus();
    if (step === 3) dueDateRef.current?.focus();
    if (step === 4) mrNumberRef.current?.focus();
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
      // Shift + Enter to add a new product entry
      e.preventDefault();
      if (index === productEntries.length - 1 && productEntries[index].id) {
        addNewProductEntry();
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Regular Enter key to move focus within the row
      e.preventDefault();
      if (field === 'id') {
        document.getElementById(`productPrice-${index}`)?.focus();
      } else if (field === 'price') {
        document.getElementById(`productQuantity-${index}`)?.focus();
      } else if (field === 'quantity' && index === productEntries.length - 1) {
        nextStep();
      }
    }
  };


  const addNewProductEntry = () => {
    setProductEntries([...productEntries, { id: '', price: '', quantity: '' }]);
    setTimeout(() => document.getElementById(`productId-${productEntries.length}`)?.focus(), 0);
  };

  const calculateTotal = (entries) => {
    // Ensure entries is an array before calling reduce
    if (!Array.isArray(entries)) return 0;

    return entries.reduce((total, product) => {
      const price = parseFloat(product.price) || 0;
      const quantity = parseInt(product.quantity) || 0;
      return total + (price * quantity);
    }, 0);
  };


  const determineTaxRate = (entries) => {
    const hasSunglasses = entries.some(product => product.category === 'sunglasses');
    return hasSunglasses ? 18 : 12; // Tax rate logic
  };

  const saveWorkOrder = async () => {
    const totalAmount = calculateTotal(productEntries);
    const taxRate = determineTaxRate(productEntries);

    // Prepare the payload with all form data
    const payload = {
      workOrderId,
      productEntries,
      description,
      advanceDetails,
      dueDate,
      mrNumber,
      patientDetails,
      employee,
      paymentMethod,
      total_amount: totalAmount,
      tax_rate: taxRate,
      is_b2b: isB2B,
    };

    try {
      const response = await axios.post('http://localhost:5000/api/work-orders', payload);

      if (response.status === 201) {
        alert('Work Order saved successfully!');
        // Increment the initial count after saving the work order
        setInitialCount((prevCount) => {
          const newCount = prevCount + 1;
          const financialYear = getFinancialYear();
          setWorkOrderId(`WO(${branchCode})-${newCount}-${financialYear}`);
          return newCount;
        });
      } else {
        alert('Failed to save work order. Please try again.');
      }
    } catch (error) {
      console.error('Error saving work order:', error);
      alert('An error occurred while saving the work order.');
    }
  };

  const nextStep = () => {
    let errors = {};

    if (step === 1) {
      // Validate product entries: Each entry must have id, price, and quantity
      productEntries.forEach((product, index) => {
        if (!product.id) errors[`productId-${index}`] = 'Product ID is required';
        if (!product.price) errors[`productPrice-${index}`] = 'Price is required';
        if (!product.quantity) errors[`productQuantity-${index}`] = 'Quantity is required';
      });
    } else if (step === 2) {
      if (!advanceDetails) errors.advanceDetails = 'Advance details are required';
    } else if (step === 3) {
      if (!dueDate) errors.dueDate = 'Due date is required';
    } else if (step === 4) {
      if (!mrNumber) errors.mrNumber = 'MR Number is required';
    } else if (step === 5) {
      if (!employee) errors.employee = 'Employee selection is required';
    } else if (step === 6) {
      if (!paymentMethod) errors.paymentMethod = 'Payment method is required';
    }

    // If there are errors, do not proceed to the next step
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Clear errors and proceed to the next step
    setValidationErrors({});
    if (step < 6) setStep((prevStep) => prevStep + 1);
    else if (step === 6 && allowPrint) handlePrint();
    else if (step === 6) {
      saveWorkOrder();
      setAllowPrint(true);
    }
  };


  const prevStep = () => setStep((prevStep) => Math.max(prevStep - 1, 1));

  const handleMRNumberSearch = () => {
    setPatientDetails({ name: 'Patient Name', age: 35, condition: 'Condition Description' });
    nextButtonRef.current?.focus();
  };

  const handlePrint = () => window.print();

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
      <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">Work Order Generation</h1>

      {/* Progress Tracker */}
      <div className="flex items-center mb-8 w-2/3 mx-auto">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-xl mx-1 ${step > i + 1 ? 'bg-[#5db76d]' : 'bg-gray-300'} transition-all duration-300`} />
        ))}
      </div>

      <form className="space-y-8 bg-white p-6 rounded-lg max-w-2xl mx-auto" onSubmit={(e) => e.preventDefault()}>
        {/* Step 1: Work Order ID and Product Entries with ID, Price, and Quantity */}
        {step === 1 && (
          <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 text-center">Product Information</h2>
            <label className="block text-gray-700 font-medium mb-1">Generated Work Order ID</label>
            <input
              type="text"
              value={workOrderId}
              readOnly
              className="border border-gray-300 px-4 py-3 rounded-lg bg-gray-200 text-gray-700 w-full text-center"
            />
            <label className="block text-gray-700 font-medium mb-4">Product Details</label>
            <div className="space-y-6">
              {productEntries && Array.isArray(productEntries) && productEntries.map((product, index) => (
                <div key={index} className="flex space-x-2 items-center">
                  {/* Product ID Input */}
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
                      <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                        {validationErrors[`productId-${index}`]}
                      </p>
                    )}
                  </div>

                  {/* Product Price Input */}
                  <div className="relative w-1/4">
                    <input
                      type="text"
                      id={`productPrice-${index}`}
                      placeholder="Price"
                      value={product.price}
                      onChange={(e) => handleProductEntryChange(index, 'price', e.target.value)}
                      onKeyDown={(e) => handleProductEntryShiftEnter(e, index, 'price')}
                      className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center appearance-none"
                    />
                    {validationErrors[`productPrice-${index}`] && (
                      <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                        {validationErrors[`productPrice-${index}`]}
                      </p>
                    )}
                  </div>

                  {/* Product Quantity Input */}
                  <div className="relative w-1/4">
                    <input
                      type="text"
                      id={`productQuantity-${index}`}
                      placeholder="Quantity"
                      value={product.quantity}
                      onChange={(e) => handleProductEntryChange(index, 'quantity', e.target.value)}
                      onKeyDown={(e) => handleProductEntryShiftEnter(e, index, 'quantity')}
                      className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center appearance-none"
                    />
                    {validationErrors[`productQuantity-${index}`] && (
                      <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                        {validationErrors[`productQuantity-${index}`]}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addNewProductEntry}
                className=" bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
              >
                Add Product
              </button>

            </div>

          </div>
        )}

        {/* Step 2: Description and Advance Details */}
        {step === 2 && (
          <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-4 text-center">
            <h2 className="text-lg font-semibold text-gray-700">Product Details</h2>
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
              type="text"
              placeholder="Enter amount paid in advance"
              value={advanceDetails}
              onChange={(e) => setAdvanceDetails(e.target.value)}
              onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
              ref={advanceDetailsRef}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center appearance-none"
            />
            {validationErrors.advanceDetails && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.advanceDetails}</p>
            )}

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
                onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
                ref={dueDateRef}
                min={getTodayDate()}  // Set minimum date to today
                className="border border-gray-300 w-full px-10 py-3 rounded-lg text-center appearance-none"
              />
              {validationErrors.dueDate && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.dueDate}</p>
              )}
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
              onKeyDown={(e) => handleEnterKey(e, fetchButtonRef)}
              ref={mrNumberRef}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg"
            />
            {validationErrors.mrNumber && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.mrNumber}</p>
            )}
            <button
              type="button"
              onClick={() => {
                handleMRNumberSearch();
                nextButtonRef.current?.focus();
              }}
              ref={fetchButtonRef}
              className="mt-2 text-white px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 transition"
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

        {/* Step 5: Employee Selection & B2B Toggle */}
        {step === 5 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-6">
            <h2 className="text-lg font-semibold text-gray-700">Order Created by Employee Details</h2>
            {/* Employee Dropdown */}
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              ref={employeeRef}
              onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
            >
              <option value="" disabled>Select Employee</option>
              {employees.map((emp) => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
            {validationErrors.employee && (
              <p className="text-red-500 text-xs mt-1">{validationErrors.employee}</p>
            )}

            <div className="flex items-center space-x-4 mt-6">
  <label className="flex items-center cursor-pointer space-x-4">
    <span className="font-semibold text-gray-700">Is this a B2B order?</span>
    <div className="relative">
      <input
        type="checkbox"
        id="b2b-toggle"
        checked={isB2B}
        onChange={(e) => setIsB2B(e.target.checked)}
        className="sr-only"
      />
      <div
        className={`w-11 h-6 rounded-full transition-colors duration-300 ${
          isB2B ? 'bg-green-500' : 'bg-gray-300'
        }`}
      ></div>
      <div
        className={`absolute w-5 h-5 bg-white rounded-full top-0.5 left-0.5 transform transition-transform duration-300 ${
          isB2B ? 'translate-x-5' : 'translate-x-0'
        }`}
      ></div>
    </div>
  </label>
</div>



          </div>
        )}

        {/* Step 6: Order Preview in Bill Format with Payment Method */}
        {step === 6 && (
          <div className="bg-white p-8 rounded space-y-4 text-gray-800">
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">Invoice Summary</h2>
              <button
                onClick={handlePrint}
                ref={printButtonRef}
                className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-5 py-2 transition"
              >
                <PrinterIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-6">
              <p><strong>Work Order ID:</strong> {workOrderId}</p>
              <p><strong>Description:</strong> {description}</p>
              <p><strong>Due Date:</strong> {dueDate}</p>
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
              <div className="mt-6">
                <p><strong>Total Amount:</strong> {calculateTotal(productEntries).toFixed(2)}</p>
                <p><strong>Advance Paid:</strong> {parseFloat(advanceDetails) || 0}</p>
                <p><strong>Balance Due:</strong> {(calculateTotal(productEntries) - (parseFloat(advanceDetails) || 0)).toFixed(2)}</p>
              </div>
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

            <button
              onClick={saveWorkOrder}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition w-full mt-6"
            >
              Save Work Order
            </button>
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

export default WorkOrderGeneration;

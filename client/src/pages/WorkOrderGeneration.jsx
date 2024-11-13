// client/src/pages/WorkOrderGeneration.jsx
import React, { useState, useEffect, useRef } from "react";
import { CalendarIcon, PrinterIcon, TrashIcon } from "@heroicons/react/24/outline"; // Ensure this import path is correct and the package is installed
import supabase from '../supabaseClient';
import { convertUTCToIST } from '../utils/dateUtils';

const WorkOrderGeneration = ({ isCollapsed }) => {
  const [step, setStep] = useState(1);
  const [workOrderId, setWorkOrderId] = useState("");
  const [productEntries, setProductEntries] = useState([
    { id: "", name: "", price: "", quantity: "" },
  ]);
  const [description, setDescription] = useState("");
  const [advanceDetails, setAdvanceDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [mrNumber, setMrNumber] = useState("");
  const [patientDetails, setPatientDetails] = useState(null);
  const [employee, setEmployee] = useState("");
  const [employees] = useState(["John Doe", "Jane Smith", "Alex Brown"]);
  const [allowPrint, setAllowPrint] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [isB2B, setIsB2B] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);

  // Dummy branches
  const branches = [
    { name: 'Neyyattinkara', code: 'NTA' },
    { name: 'Old City', code: 'OCT' },
    { name: 'Downtown', code: 'DWN' },
  ];


  // Dummy dataset for products
  const productDatabase = [
    { id: "P001", name: "Sunglasses", price: "500" },
    { id: "P002", name: "Reading Glasses", price: "300" },
    { id: "P003", name: "Contact Lenses", price: "700" },
    { id: "P004", name: "Blue Light Glasses", price: "450" },
    { id: "P005", name: "Safety Goggles", price: "600" },
  ];

  // Utility function to get the current financial year
  const getFinancialYear = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // Months are zero-based

    let financialYearStart;
    let financialYearEnd;

    if (currentMonth >= 4) {
      financialYearStart = currentYear % 100;
      financialYearEnd = (currentYear + 1) % 100;
    } else {
      financialYearStart = (currentYear - 1) % 100;
      financialYearEnd = currentYear % 100;
    }

    return `${financialYearStart}-${financialYearEnd}`;
  };

  // Function to fetch product details based on ID
  const fetchProductDetails = (productId) => {
    return productDatabase.find((product) => product.id === productId) || null;
  };

  const resetForm = () => {
    setProductEntries([{ id: "", name: "", price: "", quantity: "" }]);
    setDescription("");
    setAdvanceDetails("");
    setDueDate("");
    setMrNumber("");
    setPatientDetails(null);
    setEmployee("");
    setPaymentMethod("");
    setGstNumber("");
    setValidationErrors({});
    setIsB2B(false);
    setAllowPrint(false);
    setSelectedBranch(null);
  };

  // GST Rate
  const GST_RATE = 12; // Total GST is 12% (6% CGST + 6% SGST)
  const HSN_CODE = "12345678"; // Dummy HSN Code

  // Calculate total with GST
  const calculateTotalWithGST = (entries) => {
    const subtotal = entries.reduce((total, product) => {
      const price = parseFloat(product.price) || 0;
      const quantity = parseInt(product.quantity) || 0;
      return total + price * quantity;
    }, 0);

    // Calculate CGST and SGST
    const cgst = (subtotal * 6) / 100;
    const sgst = (subtotal * 6) / 100;
    const totalWithGST = subtotal + cgst + sgst;

    return { subtotal, cgst, sgst, totalWithGST };
  };

  // References for managing field focus
  const descriptionRef = useRef(null);
  const dueDateRef = useRef(null);
  const mrNumberRef = useRef(null);
  const fetchButtonRef = useRef(null);
  const employeeRef = useRef(null);
  const paymentMethodRef = useRef(null);
  const gstNumberRef = useRef(null);
  const advanceDetailsRef = useRef(null);
  const printButtonRef = useRef(null);
  const saveButtonRef = useRef(null);
  const newWorkOrderButtonRef = useRef(null);
  const nextButtonRef = useRef(null);
  const step6Ref = useRef();

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    focusFirstFieldOfStep();
  }, [step, isB2B]);

  const focusFirstFieldOfStep = () => {
    if (step === 1) {
      if (!selectedBranch) {
        document.getElementById('branch-select')?.focus();
      } else {
        document.getElementById(`productId-0`)?.focus();
      }
    }
    if (step === 2) descriptionRef.current?.focus();
    if (step === 3) dueDateRef.current?.focus();
    if (step === 4) mrNumberRef.current?.focus();
    if (step === 5) {
      if (isB2B) gstNumberRef.current?.focus();
      else employeeRef.current?.focus();
    }
    if (step === 6) paymentMethodRef.current?.focus();
  };

  const handleEnterKey = (e, nextFieldRef, action) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextFieldRef) {
        nextFieldRef.current?.focus();
      } else if (action) {
        action();
      } else {
        nextStep();
      }
    }
  };

  const handleProductEntryChange = (index, field, value) => {
    const updatedEntries = [...productEntries];
    updatedEntries[index][field] = value;

    // Auto-fill product name and price when product ID is entered
    if (field === "id") {
      const productDetails = fetchProductDetails(value);
      if (productDetails) {
        updatedEntries[index].name = productDetails.name;
        updatedEntries[index].price = productDetails.price;
      } else {
        updatedEntries[index].name = "";
        updatedEntries[index].price = "";
      }
    }

    setProductEntries(updatedEntries);
  };

  const addNewProductEntry = () => {
    setProductEntries([
      ...productEntries,
      { id: "", name: "", price: "", quantity: "" },
    ]);
    setTimeout(
      () =>
        document
          .getElementById(`productId-${productEntries.length}`)
          ?.focus(),
      0
    );
  };

  const removeProductEntry = (index) => {
    const updatedEntries = productEntries.filter((_, i) => i !== index);
    setProductEntries(updatedEntries);
  };

  const handleProductEntryShiftEnter = (e, index, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift + Enter behavior: Add new product entry and focus on its 'id' field
        if (index === productEntries.length - 1) {
          addNewProductEntry();
          setTimeout(() => {
            document.getElementById(`productId-${productEntries.length}`)?.focus();
          }, 0);
        } else {
          // If not the last entry, focus on the next product's 'id' field
          document.getElementById(`productId-${index + 1}`)?.focus();
        }
      } else {
        // Regular Enter behavior
        if (field === "id") {
          // After entering Product ID, focus on Quantity
          document.getElementById(`productQuantity-${index}`)?.focus();
        } else if (field === "quantity") {
          // After entering Quantity, move to next step
          nextStep();
        }
      }
    }
  };

  const saveWorkOrder = async () => {
    if (isSaving) {
      alert('Please wait while the work order is being saved.');
      return;
    }

    // Validate Advance Details in Step 6
    if (isB2B && !gstNumber) {
      setValidationErrors({ gstNumber: "GST Number is required for B2B orders" });
      gstNumberRef.current?.focus();
      return;
    }

    if (!paymentMethod) {
      setValidationErrors({ paymentMethod: "Payment method is required" });
      paymentMethodRef.current?.focus();
      return;
    }

    if (!advanceDetails) {
      setValidationErrors({ advanceDetails: "Advance details are required" });
      advanceDetailsRef.current?.focus();
      return;
    }

    setIsSaving(true);
    const newWorkOrderId = workOrderId;
    if (!newWorkOrderId) {
      alert('Failed to generate Work Order ID');
      setIsSaving(false);
      return;
    }

    const { subtotal, cgst, sgst, totalWithGST } = calculateTotalWithGST(productEntries);

    // Get current date and time in IST format
    const currentUTCDateTime = new Date().toISOString();

    const payload = {
      work_order_id: newWorkOrderId,
      product_entries: productEntries,
      description,
      advance_details: parseFloat(advanceDetails) || 0,
      due_date: dueDate,
      mr_number: mrNumber,
      patient_details: patientDetails,
      employee,
      payment_method: paymentMethod,
      subtotal,
      cgst,
      sgst,
      total_amount: totalWithGST,
      hsn_code: HSN_CODE,
      is_b2b: isB2B,
      gst_number: isB2B ? gstNumber : null,
      created_at: currentUTCDateTime,
      updated_at: currentUTCDateTime,
    };

    console.log('Payload being sent:', payload);

    try {
      // Insert the work order into the 'work_orders' table
      const { data: workOrderData, error: workOrderError } = await supabase
        .from('work_orders')
        .insert([payload]);

      if (workOrderError) {
        console.error('Error inserting work order:', workOrderError);
        throw workOrderError;
      }

      // Insert products into the 'products' table
      const productsData = productEntries.map((product) => ({
        work_order_id: newWorkOrderId,
        product_name: product.name,
        product_id: product.id,
        price: parseFloat(product.price) || 0,
        hsn_code: HSN_CODE,
        quantity: parseInt(product.quantity) || 0,
        created_at: currentUTCDateTime,
      }));

      const { data: productsInsertData, error: productsInsertError } = await supabase
        .from('products')
        .insert(productsData);

      if (productsInsertError) {
        console.error('Error inserting products:', productsInsertError);
        throw productsInsertError;
      }

      alert('Work Order and Products saved successfully!');
      setAllowPrint(true);
      setTimeout(() => {
        printButtonRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error saving work order:', error);
      alert('Failed to save work order. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    let errors = {};

    if (step === 1) {
      if (!selectedBranch) {
        errors.branch = "Branch selection is required";
      }
      // Validate product entries: Each entry must have id, price, and quantity
      productEntries.forEach((product, index) => {
        if (!product.id)
          errors[`productId-${index}`] = "Product ID is required";
        if (!product.price)
          errors[`productPrice-${index}`] = "Price is required";
        if (!product.quantity)
          errors[`productQuantity-${index}`] = "Quantity is required";
      });
    } else if (step === 2) {
      if (!description)
        errors.description = "Description is required";
    } else if (step === 3) {
      if (!dueDate) errors.dueDate = "Due date is required";
    } else if (step === 4) {
      if (!mrNumber) errors.mrNumber = "MR Number is required";
    } else if (step === 5) {
      if (isB2B && !gstNumber) {
        errors.gstNumber = "GST Number is required for B2B orders";
      }
      if (!employee) {
        errors.employee = "Employee selection is required";
      }
    } else if (step === 6) {
      if (!paymentMethod) {
        errors.paymentMethod = "Payment method is required";
      }
      if (!advanceDetails) {
        errors.advanceDetails = "Advance details are required";
      }
    }

    // If there are errors, do not proceed to the next step
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Focus on the first error field
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey === 'branch') {
        document.getElementById('branch-select')?.focus();
      } else if (firstErrorKey.startsWith('productId')) {
        const index = firstErrorKey.split('-')[1];
        document.getElementById(`productId-${index}`)?.focus();
      } else if (firstErrorKey === 'description') {
        descriptionRef.current?.focus();
      } else if (firstErrorKey === 'dueDate') {
        dueDateRef.current?.focus();
      } else if (firstErrorKey === 'mrNumber') {
        mrNumberRef.current?.focus();
      } else if (firstErrorKey === 'gstNumber') {
        gstNumberRef.current?.focus();
      } else if (firstErrorKey === 'employee') {
        employeeRef.current?.focus();
      } else if (firstErrorKey === 'paymentMethod') {
        paymentMethodRef.current?.focus();
      } else if (firstErrorKey === 'advanceDetails') {
        advanceDetailsRef.current?.focus();
      }
      return;
    }

    // Clear errors and proceed to the next step
    setValidationErrors({});
    if (step < 6) setStep((prevStep) => prevStep + 1);
  };

  const prevStep = () => setStep((prevStep) => Math.max(prevStep - 1, 1));

  const handleMRNumberSearch = () => {
    // Simulate fetching patient details
    setPatientDetails({
      name: "John Doe",
      age: 35,
      condition: "Myopia",
    });
    nextButtonRef.current?.focus();
  };

  const generateNewWorkOrderId = async () => {
    try {
      const financialYear = getFinancialYear();

      // Fetch the last work order ID from the database for the selected branch
      const { data: lastWorkOrders, error } = await supabase
        .from('work_orders')
        .select('work_order_id, created_at')
        .ilike('work_order_id', `%(${selectedBranch.code})%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      let lastCount = 0;

      if (lastWorkOrders && lastWorkOrders.length > 0) {
        const lastWorkOrderId = lastWorkOrders[0].work_order_id;
        // Extract the count from the last work order ID
        const parts = lastWorkOrderId.split('-');
        const countPart = parts[1];
        lastCount = parseInt(countPart, 10);
      }

      const newCount = lastCount + 1;
      const newWorkOrderId = `WO(${selectedBranch.code})-${newCount}-${financialYear}`;

      return newWorkOrderId; // Return the new ID
    } catch (error) {
      console.error('Error generating Work Order ID:', error);
      return null;
    }
  };

  const handleGenerateWorkOrder = async () => {
    if (!selectedBranch) {
      alert('Please select a branch.');
      return;
    }
    const newId = await generateNewWorkOrderId();
    if (newId) {
      setWorkOrderId(newId);
    } else {
      console.error("Failed to generate Work Order ID");
    }
  };

  useEffect(() => {
    if (selectedBranch) {
      handleGenerateWorkOrder();
    }
  }, [selectedBranch]);


  return (
    <div
      className={` transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
        } justify-center mt-16 p-4 mx-auto`}
    >
      <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">
        Work Order Generation
      </h1>

      {/* Progress Tracker */}
      <div className="flex items-center mb-8 w-2/3 mx-auto">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-xl mx-1 ${step > i + 1 ? "bg-[#5db76d]" : "bg-gray-300"
              } transition-all duration-300`}
          />
        ))}
      </div>


      <form
        className="space-y-8 bg-white p-6 rounded-lg max-w-3xl mx-auto"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Step 1: Branch Selection, Work Order ID, and Product Entries */}
        {step === 1 && (
          <div className="w-fit bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 text-center">
              Branch and Product Information
            </h2>
            {/* Branch Selection */}
            <div className="relative">
              <label className="block text-gray-700 font-medium mb-1">
                Select Branch
              </label>
              <select
                id="branch-select"
                value={selectedBranch ? selectedBranch.code : ""}
                onChange={(e) => {
                  const branch = branches.find(b => b.code === e.target.value);
                  setSelectedBranch(branch || null);
                }}
                className="border border-gray-300 w-1/2 px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
              >
                <option value="" disabled>Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch.code} value={branch.code}>
                    {branch.name}
                  </option>
                ))}
              </select>
              {validationErrors.branch && (
                <p className="text-red-500 text-xs mt-1">
                  {validationErrors.branch}
                </p>
              )}
            </div>

            {/* Generated Work Order ID */}
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Generated Work Order ID
              </label>
              <input
                type="text"
                value={workOrderId}
                readOnly
                className="border border-gray-300 px-4 py-3 rounded-lg bg-gray-200 text-gray-700 w-full text-center"
              />
            </div>

            {/* Product Details */}
            <label className="block text-gray-700 font-medium mb-4">
              Product Details
            </label>
            <div className="space-y-6">
              {productEntries &&
                Array.isArray(productEntries) &&
                productEntries.map((product, index) => (
                  <div key={index} className="flex space-x-2 items-center">
                    {/* Product ID Input */}
                    <div className="relative w-2/4">
                      <input
                        type="text"
                        id={`productId-${index}`}
                        placeholder="Product ID / Scan Barcode"
                        value={product.id || ""}
                        onChange={(e) => handleProductEntryChange(index, "id", e.target.value)}
                        onKeyDown={(e) => handleProductEntryShiftEnter(e, index, "id")}
                        className="border border-gray-300 px-4 py-3 rounded-lg w-full"
                      />
                      {validationErrors[`productId-${index}`] && (
                        <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                          {validationErrors[`productId-${index}`]}
                        </p>
                      )}
                    </div>

                    {/* Product Name Input (auto-filled) */}
                    <div className="relative w-1/2">
                      <input
                        type="text"
                        id={`productName-${index}`}
                        placeholder="Product Name"
                        value={product.name || ""}
                        onChange={(e) =>
                          handleProductEntryChange(
                            index,
                            "name",
                            e.target.value
                          )
                        }
                        className="border border-gray-300 px-4 py-3 rounded-lg w-full"
                      />
                    </div>

                    {/* Product Price Input (auto-filled) */}
                    <div className="relative w-1/4">
                      <input
                        type="text"
                        id={`productPrice-${index}`}
                        placeholder="Price"
                        value={product.price || ""}
                        onChange={(e) =>
                          handleProductEntryChange(
                            index,
                            "price",
                            e.target.value
                          )
                        }
                        onKeyDown={(e) =>
                          handleProductEntryShiftEnter(e, index, "price")
                        }
                        className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center"
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
                        value={product.quantity || ""}
                        onChange={(e) => handleProductEntryChange(index, "quantity", e.target.value)}
                        onKeyDown={(e) => handleProductEntryShiftEnter(e, index, "quantity")}
                        className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center appearance-none"
                      />
                      {validationErrors[`productQuantity-${index}`] && (
                        <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                          {validationErrors[`productQuantity-${index}`]}
                        </p>
                      )}
                    </div>

                    {/* Delete Product Entry Button */}
                    <button
                      type="button"
                      onClick={() => removeProductEntry(index)}
                      className="text-red-500 hover:text-red-700 transition"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}

              <button
                type="button"
                onClick={addNewProductEntry}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
              >
                Add Product
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Description Only */}
        {step === 2 && (
          <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-4 text-center">
            <h2 className="text-lg font-semibold text-gray-700">
              Product Description
            </h2>
            <label className="block text-gray-700 font-medium mb-1">
              Description
            </label>
            <textarea
              placeholder="Enter Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
              ref={descriptionRef}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg text-left"
            />
            {validationErrors.description && (
              <p className="text-red-500 text-xs mt-1">
                {validationErrors.description}
              </p>
            )}
          </div>
        )}

        {/* Step 3: Due Date */}
        {step === 3 && (
          <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-4 text-center">
            <h2 className="text-lg font-semibold text-gray-700">Due Date</h2>
            <label className="block text-gray-700 font-medium mb-1">
              Select Due Date
            </label>
            <div className="relative">
              <CalendarIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
                ref={dueDateRef}
                min={getTodayDate()} // Set minimum date to today
                className="border border-gray-300 w-full px-10 py-3 rounded-lg text-center appearance-none"
              />
              {validationErrors.dueDate && (
                <p className="text-red-500 text-xs mt-1">
                  {validationErrors.dueDate}
                </p>
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
              <p className="text-red-500 text-xs mt-1">
                {validationErrors.mrNumber}
              </p>
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
                <p>
                  <strong>Name:</strong> {patientDetails.name}
                </p>
                <p>
                  <strong>Age:</strong> {patientDetails.age}
                </p>
                <p>
                  <strong>Condition:</strong> {patientDetails.condition}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Employee Selection, B2B Toggle, and GST Number if B2B */}
        {step === 5 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-6">
            <h2 className="text-lg font-semibold text-gray-700">
              Order Created by Employee Details
            </h2>
            {/* Employee Dropdown - Always Visible */}
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              ref={employeeRef}
              onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
            >
              <option value="" disabled>
                Select Employee
              </option>
              {employees.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
            {validationErrors.employee && (
              <p className="text-red-500 text-xs mt-1">
                {validationErrors.employee}
              </p>
            )}

            <div className="flex items-center space-x-4 mt-6">
              <label className="flex items-center cursor-pointer space-x-4">
                <span className="font-semibold text-gray-700">
                  Is this a B2B order?
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    id="b2b-toggle"
                    checked={isB2B}
                    onChange={(e) => {
                      setIsB2B(e.target.checked);
                      // Reset GST Number when toggling off B2B
                      if (!e.target.checked) setGstNumber("");
                    }}
                    className="sr-only"
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors duration-300 ${isB2B ? "bg-green-500" : "bg-gray-300"
                      }`}
                  ></div>
                  <div
                    className={`absolute w-5 h-5 bg-white rounded-full top-0.5 left-0.5 transform transition-transform duration-300 ${isB2B ? "translate-x-5" : "translate-x-0"
                      }`}
                  ></div>
                </div>
              </label>
            </div>

            {/* GST Number Input for B2B Orders */}
            {isB2B && (
              <div className="relative w-full mt-4">
                <label className="block text-gray-700 font-medium mb-1">
                  GST Number
                </label>
                <input
                  type="text"
                  placeholder="Enter GST Number"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
                  ref={gstNumberRef}
                  className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                />
                {validationErrors.gstNumber && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.gstNumber}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 6: Payment Method, Advance Details, Save and Print */}
        {step === 6 && (
          <>
            {/* Wrap the content you want to print with step6Ref */}
            <div ref={step6Ref}>
              {/* Invoice Summary */}
              <div className="printable-area print:block print:absolute print:inset-0 print:w-full bg-white p-8 rounded-lg text-gray-800">
                {/* Invoice Header */}
                <div className="invoice-header text-center mb-6">
                  <h1 className="text-3xl font-bold">Screenetra Eye Care</h1>
                  <p className="text-sm text-gray-600">GST Number: 32AAUCS7002H1ZV</p>
                  <h2 className="text-2xl font-semibold">Invoice Summary</h2>
                </div>

                {/* Invoice Details */}
                <div className="invoice-details grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p>
                      <span className="font-semibold">Work Order ID:</span> <span className="font-normal">{workOrderId}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Description:</span> <span className="font-normal">{description}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Due Date:</span> <span className="font-normal">{dueDate}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Customer MR Number:</span> <span className="font-normal">{mrNumber}</span>
                    </p>
                    {patientDetails && (
                      <p>
                        <span className="font-semibold">Customer Name:</span> <span className="font-normal">{patientDetails.name}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <p>
                      <span className="font-semibold">Billed by Employee:</span> <span className="font-normal">{employee || 'N/A'}</span>
                    </p>
                    {isB2B && (
                      <p>
                        <span className="font-semibold">B2B GST Number:</span> <span className="font-normal">{gstNumber}</span>
                      </p>
                    )}
                    <p>
                      <span className="font-semibold">HSN Code:</span> <span className="font-normal">{HSN_CODE}</span>
                    </p>
                  </div>
                </div>

                {/* Product Table */}
                <table className="w-full border border-gray-300 rounded-md mb-6">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border-b">Product ID</th>
                      <th className="py-2 px-4 border-b">Product Name</th>
                      <th className="py-2 px-4 border-b">Price</th>
                      <th className="py-2 px-4 border-b">Quantity</th>
                      <th className="py-2 px-4 border-b">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productEntries.map((product, index) => {
                      const subtotal =
                        (parseFloat(product.price) || 0) *
                        (parseInt(product.quantity) || 0);
                      return (
                        <tr key={index} className="text-center">
                          <td className="py-2 px-4 border-b">{product.id}</td>
                          <td className="py-2 px-4 border-b">{product.name}</td>
                          <td className="py-2 px-4 border-b">₹ {parseFloat(product.price).toFixed(2)}</td>
                          <td className="py-2 px-4 border-b">{product.quantity}</td>
                          <td className="py-2 px-4 border-b">₹ {subtotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Financial Summary */}
                <div className="financial-summary grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold">Subtotal:</span> <span className="font-normal">₹ {calculateTotalWithGST(productEntries).subtotal.toFixed(2)}</span>
                    </p>
                    <p>
                      <span className="font-semibold">CGST (6%):</span> <span className="font-normal">₹ {calculateTotalWithGST(productEntries).cgst.toFixed(2)}</span>
                    </p>
                    <p>
                      <span className="font-semibold">SGST (6%):</span> <span className="font-normal">₹ {calculateTotalWithGST(productEntries).sgst.toFixed(2)}</span>
                    </p>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold">Total Amount (incl. GST):</span> <span className="font-normal">₹ {calculateTotalWithGST(productEntries).totalWithGST.toFixed(2)}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Advance Paid:</span> <span className="font-normal">₹ {parseFloat(advanceDetails).toFixed(2)}</span>
                    </p>
                    <p>
                      <span className="font-semibold">Balance Due:</span> <span className="font-normal">₹ {(calculateTotalWithGST(productEntries).totalWithGST - parseFloat(advanceDetails)).toFixed(2)}</span>
                    </p>
                  </div>
                </div>

                {/* Payment Method and Advance Details on the Same Line */}
                <div className="flex flex-col md:flex-row items-center justify-between my-6 space-x-4">
                  {/* Payment Method */}
                  <div className="w-full md:w-1/2 mb-4 md:mb-0">
                    <label htmlFor="paymentMethod" className="block font-semibold mb-1">
                      Payment Method:
                    </label>
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      ref={paymentMethodRef}
                      onKeyDown={(e) => handleEnterKey(e, advanceDetailsRef)}
                      className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                    >
                      <option value="" disabled>Select Payment Method</option>
                      <option value="cash">Cash</option>
                      <option value="credit">Card</option>
                      <option value="online">UPI (Paytm/PhonePe/GPay)</option>
                    </select>
                    {validationErrors.paymentMethod && (
                      <p className="text-red-500 text-xs ml-1">
                        {validationErrors.paymentMethod}
                      </p>
                    )}
                  </div>

                  {/* Advance Details */}
                  <div className="w-full md:w-1/2 mb-4 md:mb-0">
                    <label htmlFor="advanceDetails" className="block font-semibold mb-1">
                      Advance Details:
                    </label>
                    <input
                      type="text"
                      id="advanceDetails"
                      placeholder="Enter amount paid in advance"
                      value={advanceDetails}
                      onChange={(e) => setAdvanceDetails(e.target.value)}
                      onKeyDown={(e) => handleEnterKey(e, saveButtonRef)}
                      ref={advanceDetailsRef}
                      className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                    />
                    {validationErrors.advanceDetails && (
                      <p className="text-red-500 text-xs ml-1">
                        {validationErrors.advanceDetails}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Save Work Order and Print Buttons on the Same Line */}
              <div className="flex justify-center text-center space-x-4 mt-6">
                <button
                  onClick={() => {
                    if (!isSaving) saveWorkOrder();
                  }}
                  ref={saveButtonRef}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!isSaving) {
                        saveWorkOrder();
                      }
                      setTimeout(() => {
                        printButtonRef.current?.focus();
                      }, 100);
                    }
                  }}
                  className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition w-fit"
                >
                  {isSaving ? "Saving..." : "Save Work Order"}
                </button>

                {allowPrint && (
                  <button
                    onClick={() => window.print()}
                    ref={printButtonRef}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        printButtonRef.current?.click();
                        setTimeout(() => {
                          newWorkOrderButtonRef.current?.focus();
                        }, 100);
                      }
                    }}
                    className="flex items-center bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition w-fit ml-2"
                  >
                    <PrinterIcon className="w-5 h-5 mr-2" />
                    Print
                  </button>
                )}

                <button
                  onClick={async () => {
                    await handleGenerateWorkOrder();
                    resetForm();
                    setStep(1);
                  }}
                  ref={newWorkOrderButtonRef}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg flex items-center justify-center w-fit"
                >
                  Create New Work Order
                </button>
              </div>
            </div>
          </>
        )}
        {/* Navigation Buttons */}
        <div className="flex justify-center mt-6">
          {step > 1 && (
            <button
              onClick={prevStep}
              className="bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg"
            >
              Previous
            </button>
          )}
          {step < 6 && (
            <button
              ref={nextButtonRef}
              onClick={nextStep}
              className="bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg"
            >
              Next
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default WorkOrderGeneration;

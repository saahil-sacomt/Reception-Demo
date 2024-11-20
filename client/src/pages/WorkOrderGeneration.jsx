// client/src/pages/WorkOrderGeneration.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { CalendarIcon, PrinterIcon, TrashIcon } from "@heroicons/react/24/outline";
import supabase from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import EmployeeVerification from "../components/EmployeeVerification";
import { useNavigate } from 'react-router-dom';
import logo from '../assets/sreenethraenglishisolated.png';

const WorkOrderGeneration = ({ isCollapsed }) => {
  const { branch, name, user } = useAuth();

  const [step, setStep] = useState(1);
  const [workOrderId, setWorkOrderId] = useState("");
  const [isPrinted, setIsPrinted] = useState(false);

  const [productEntries, setProductEntries] = useState([
    { id: "", name: "", price: "", quantity: "" },
  ]);
  const [advanceDetails, setAdvanceDetails] = useState();
  const [dueDate, setDueDate] = useState("");
  const [mrNumber, setMrNumber] = useState("");
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [patientDetails, setPatientDetails] = useState(null);
  const [employee, setEmployee] = useState("");
  const [employees] = useState(["John Doe", "Jane Smith", "Alex Brown"]);
  const [allowPrint, setAllowPrint] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [isB2B, setIsB2B] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState([]);


  const navigate = useNavigate();

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

  // Fetch product suggestions from Supabase based on user input
  // Fetch suggestions for Product ID or Product Name
  const fetchProductSuggestions = async (query, type) => {
    if (!query) return [];
    try {
      const column = type === "id" ? "product_id" : "product_name";
      const { data, error } = await supabase
        .from("products")
        .select(`product_id, product_name, mrp`)
        .ilike(column, `%${query}%`)
        .limit(10);

      if (error) {
        console.error(`Error fetching ${type} suggestions:`, error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error(`Unexpected error fetching ${type} suggestions:`, err);
      return [];
    }
  };


  const handleProductInput = async (index, value) => {
    setProductEntries((prevEntries) => {
      const updatedEntries = [...prevEntries];
      updatedEntries[index].id = value; // Update the input value
      return updatedEntries;
    });

    if (value) {
      const suggestions = await fetchProductSuggestions(value);
      setProductSuggestions(suggestions); // Keep suggestions updated
    } else {
      setProductSuggestions([]); // Clear suggestions when input is empty
    }
  };

  const validateField = (index, field) => {
    const errors = { ...validationErrors };

    if (field === "id" && !productEntries[index].id) {
      errors[`productId-${index}`] = "Product ID is required";
    } else if (field === "price" && !productEntries[index].price) {
      errors[`productPrice-${index}`] = "Price is required";
    } else if (field === "quantity" && !productEntries[index].quantity) {
      errors[`productQuantity-${index}`] = "Quantity is required";
    } else {
      delete errors[`${field}-${index}`];
    }

    setValidationErrors(errors);
  };


  const handleProductSelection = async (index, productId) => {
    try {
      const productDetails = await fetchProductDetailsFromSupabase(productId, "id");
      if (productDetails) {
        setProductEntries((prevEntries) => {
          const updatedEntries = [...prevEntries];
          updatedEntries[index] = {
            id: productDetails.product_id,
            name: productDetails.product_name,
            price: productDetails.mrp || "",
            quantity: "", // Reset quantity on product selection
          };
          return updatedEntries;
        });

        // Automatically move focus to the Quantity field
        setTimeout(() => {
          quantityRefs.current[index]?.focus();
        }, 100);
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
    }
  };




  const resetForm = () => {
    setProductEntries([{ id: "", name: "", price: "", quantity: "" }]);
    setAdvanceDetails(0);
    setDueDate("");
    setMrNumber("");
    setPatientDetails(null);
    setEmployee("");
    setPaymentMethod("");
    setGstNumber("");
    setValidationErrors({});
    setIsB2B(false);
    setAllowPrint(false);
    setWorkOrderId("");
    generateNewWorkOrderId();
  };

  // GST Rate
  const GST_RATE = 12; // Total GST is 12% (6% CGST + 6% SGST)
  const HSN_CODE = "9001"; // Dummy HSN Code

  // Calculate totals
  const calculateTotals = (entries) => {
    const subtotal = entries.reduce((total, product) => {
      const price = parseFloat(product.price) || 0;
      const quantity = parseInt(product.quantity) || 0;
      return total + price * quantity;
    }, 0);

    const cgst = (subtotal * 6) / 100 || 0;
    const sgst = (subtotal * 6) / 100 || 0;

    return { subtotal, cgst, sgst };
  };

  // References for managing field focus
  const dueDateRef = useRef(null);
  const mrNumberRef = useRef(null);
  const employeeRef = useRef(null);
  const paymentMethodRef = useRef(null);
  const gstNumberRef = useRef(null);
  const advanceDetailsRef = useRef(null);
  const printButtonRef = useRef(null);
  const saveButtonRef = useRef(null);
  const newWorkOrderButtonRef = useRef(null);
  const nextButtonRef = useRef(null);
  const fetchButtonRef = useRef(null);
  const quantityRefs = useRef([]);


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
      document.getElementById(`productId-0`)?.focus();
    }
    if (step === 2) {
      dueDateRef.current?.focus();
    }
    if (step === 3) {
      mrNumberRef.current?.focus();
    }
    if (step === 4) {
      if (isB2B) gstNumberRef.current?.focus();
      else employeeRef.current?.focus();
    }
    if (step === 5) {
      paymentMethodRef.current?.focus();
    }
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

  const fetchProductDetailsFromSupabase = async (value, type) => {
    try {
      const column = type === "id" ? "product_id" : "product_name";
      const { data, error } = await supabase
        .from("products")
        .select("product_id, product_name, mrp")
        .eq(column, value);

      if (error) {
        console.error(`Error fetching product details by ${type}:`, error.message);
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error(`Unexpected error fetching product details by ${type}:`, err);
      return null;
    }
  };

  // Update handleProductEntryChange to use the Supabase fetch function
  // Update handleProductEntryChange to fetch product by ID or name
  const handleProductEntryChange = async (index, field, value) => {
    const updatedEntries = [...productEntries];
    updatedEntries[index][field] = value;

    if (field === "id" || field === "name") {
      const productDetails = await fetchProductDetailsFromSupabase(value);
      if (productDetails) {
        updatedEntries[index].id = productDetails.product_id; // Ensure ID is updated
        updatedEntries[index].name = productDetails.product_name;
        updatedEntries[index].price = productDetails.mrp;
      } else {
        updatedEntries[index].id = "";
        updatedEntries[index].name = "";
        updatedEntries[index].price = "";
      }
    }

    setProductEntries(updatedEntries);
  };



  // Function to handle Exit button functionality
  const handleExit = () => {
    const confirmExit = window.confirm(
      isPrinted ? "Form has been printed. Do you want to exit?" : "Are you sure you want to exit without saving or printing?"
    );
    if (confirmExit) {
      resetForm();
      navigate("/home");
    } else {
      setIsPrinted(false); // Reset printing state
    }
  };


  const addNewProductEntry = () => {
    setProductEntries([
      ...productEntries,
      { id: "", name: "", price: "", quantity: "" },
    ]);
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      addNewProductEntry();
    }

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

  const handleProductEntryShiftEnter = async (e, index, field) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (field === "id" || field === "name") {
        // Fetch product details and move focus
        const value = productEntries[index][field];
        const productDetails = await fetchProductDetailsFromSupabase(value, field);

        if (productDetails) {
          setProductEntries((prevEntries) => {
            const updatedEntries = [...prevEntries];
            updatedEntries[index] = {
              id: productDetails.product_id,
              name: productDetails.product_name,
              price: productDetails.mrp || "",
              quantity: prevEntries[index].quantity || "", // Preserve quantity
            };
            return updatedEntries;
          });

          // Move focus to Quantity field
          setTimeout(() => {
            quantityRefs.current[index]?.focus();
          }, 100);
        }
      } else if (field === "quantity") {
        // Validate the current field and proceed to the next step
        validateField(index, "quantity");
        nextStep();
      }
    }
  };
  const handleBlur = (index, field) => {
    validateField(index, field);
  };


  // Memoize the calculation to optimize performance
  // Memoize calculated values
  const { subtotal = 0, cgst = 0, sgst = 0 } = useMemo(
    () => calculateTotals(productEntries),
    [productEntries]
  );

  // Balance calculations
  const advance = parseFloat(advanceDetails) || 0;
  const balanceDue = subtotal - advance;

  const saveWorkOrder = async () => {
    if (isSaving) {
      alert('Please wait while the work order is being saved.');
      return;
    }
    setIsSaving(true);

    if (!employee) {
      setValidationErrors({ employee: "Employee selection is required." });
      employeeRef.current?.focus();
      setIsSaving(false);
      return;
    }

    // Validate Advance Details in Step 5
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


    // Validate all product entries
    let productErrors = {};
    productEntries.forEach((product, index) => {
      if (!product.id) productErrors[`productId-${index}`] = "Product ID is required";
      if (!product.price) productErrors[`productPrice-${index}`] = "Price is required";
      if (!product.quantity) productErrors[`productQuantity-${index}`] = "Quantity is required";
    });

    if (Object.keys(productErrors).length > 0) {
      setValidationErrors(productErrors);
      // Focus on the first product error
      const firstErrorKey = Object.keys(productErrors)[0];
      document.getElementById(firstErrorKey)?.focus();
      return;
    }

    setIsSaving(true);
    const newWorkOrderId = workOrderId;
    if (!newWorkOrderId) {
      alert('Failed to generate Work Order ID');
      setIsSaving(false);
      return;
    }

    // Get current date and time in UTC format
    const currentUTCDateTime = new Date().toISOString();

    const payload = {
      work_order_id: newWorkOrderId,
      product_entries: productEntries,
      advance_details: advance,
      due_date: dueDate,
      mr_number: mrNumber,
      patient_details: patientDetails,
      employee,
      payment_method: paymentMethod,
      subtotal,
      cgst,
      sgst,
      total_amount: subtotal,
      hsn_code: HSN_CODE,
      is_b2b: isB2B,
      gst_number: isB2B ? gstNumber : null,
      created_at: currentUTCDateTime,
      updated_at: currentUTCDateTime,
      branch: branch,
    };

    console.log('Payload being sent:', payload);

    try {
      const { data, error } = await supabase
        .from("work_orders")
        .insert([payload]);

      if (error) {
        console.error("Error saving work order:", error);
        alert("Failed to save work order.");
      } else {
        alert("Work order saved successfully!");
        setAllowPrint(true);
        // Move focus to Print button
        setTimeout(() => {
          printButtonRef.current?.focus();
        }, 100); // Slight delay to ensure UI is updated
      }


    } catch (err) {
      console.error("Unexpected error saving work order:", err);
      alert("An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    let errors = {};

    if (step === 1) {
      // Validate Step 1: Product Entries
      productEntries.forEach((product, index) => {
        if (!product.id) errors[`productId-${index}`] = "Product ID is required";
        if (!product.quantity) errors[`productQuantity-${index}`] = "Quantity is required";
      });
    } else if (step === 2) {
      // Validate Step 2: Due Date
      if (!dueDate) errors.dueDate = "Due date is required";
    } else if (step === 3) {
      // Validate Step 3: MR Number
      if (!mrNumber) errors.mrNumber = "MR Number is required";
    } else if (step === 4) {
      if (!employee) {
        errors.employee = "Employee selection is required.";
      } else if (!isPinVerified) {
        errors.employeeVerification = "Employee must be verified to proceed.";
      }
      if (isB2B && !gstNumber) {
        errors.gstNumber = "GST Number is required for B2B orders.";
      }



    } else if (step === 5) {
      // Validate Step 5: Payment Method and Advance Details
      if (!paymentMethod) errors.paymentMethod = "Payment method is required";
      if (!advanceDetails) errors.advanceDetails = "Advance details are required";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Focus on the first error field
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey.startsWith('productId') || firstErrorKey.startsWith('productPrice') || firstErrorKey.startsWith('productQuantity')) {
        const index = firstErrorKey.split('-')[1];
        document.getElementById(`${firstErrorKey}-${index}`)?.focus();
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
    if (step < 5) setStep((prevStep) => prevStep + 1);
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
      if (!branch) {
        console.error("Branch not found for the user");
        return;
      }

      const financialYear = getFinancialYear();
      const { data: lastWorkOrders, error } = await supabase
        .from('work_orders')
        .select('work_order_id, created_at')
        .ilike('work_order_id', `%(${branch})%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching last work order:", error);
        return;
      }

      let lastCount = 0;
      if (lastWorkOrders && lastWorkOrders.length > 0) {
        const lastWorkOrderId = lastWorkOrders[0].work_order_id;
        const countPart = lastWorkOrderId.split('-')[1];
        lastCount = parseInt(countPart, 10);
      }

      const newCount = lastCount + 1;
      const newWorkOrderId = `WO(${branch})-${newCount}-${financialYear}`;
      setWorkOrderId(newWorkOrderId);
    } catch (error) {
      console.error("Error generating Work Order ID:", error);
    }
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      if (isPrinted) {
        resetForm();
        navigate("/home");
      }
    };

    window.onafterprint = handleAfterPrint;

    return () => {
      window.onafterprint = null; // Cleanup the event listener
    };
  }, [isPrinted, navigate]);


  useEffect(() => {
    if (branch) {
      generateNewWorkOrderId();
    }
  }, [branch]);

  return (
    <div
      className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"} justify-center mt-16 p-4 mx-auto`}
    >
      <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">
        Work Order Generation
      </h1>

      {/* Progress Tracker */}
      <div className="flex items-center mb-8 w-2/3 mx-auto">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-xl mx-1 ${step > i + 1 ? "bg-[#5db76d]" : "bg-gray-300"} transition-all duration-300`}
          />
        ))}
      </div>

      <form
        className="space-y-8 bg-white p-6 rounded-lg max-w-3xl mx-auto"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Step 1: Work Order ID and Product Entries */}
        {step === 1 && (
          <div className="w-fit bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
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
            <label className="block text-gray-700 font-medium mb-4">Product Details</label>
            <div className="space-y-6">
              {productEntries.map((product, index) => (
                <div key={index} className="flex space-x-2 items-center">
                  {/* Product ID Input */}
                  <div className="relative w-2/4">
                    <input
                      type="text"
                      id={`productId-${index}`}
                      placeholder="Enter Product ID or Scan Barcode"
                      value={productEntries[index].id}
                      onChange={async (e) => {
                        const value = e.target.value;

                        // Update the product ID dynamically
                        setProductEntries((prevEntries) => {
                          const updatedEntries = [...prevEntries];
                          updatedEntries[index].id = value;
                          return updatedEntries;
                        });

                        // Fetch product suggestions dynamically
                        const suggestions = await fetchProductSuggestions(value, "id");
                        setProductSuggestions(suggestions);

                        // Automatically fetch details and focus quantity if exact match
                        if (suggestions.length === 1 && suggestions[0].product_id === value) {
                          await handleProductSelection(index, suggestions[0].product_id);
                        }
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();

                          const selectedProduct = productSuggestions.find(
                            (prod) => prod.product_id === productEntries[index].id
                          );

                          // Fetch product details if a valid ID is entered or selected
                          if (selectedProduct) {
                            await handleProductSelection(index, selectedProduct.product_id);
                          } else if (productEntries[index].id) {
                            await handleProductSelection(index, productEntries[index].id);
                          }
                        }

                        // Shift + Enter for adding a new product entry
                        if (e.key === "Enter" && e.shiftKey) {
                          e.preventDefault();
                          addNewProductEntry();
                        }
                      }}
                      onBlur={async () => {
                        const selectedProduct = productSuggestions.find(
                          (prod) => prod.product_id === productEntries[index].id
                        );

                        // Fetch product details on blur if a valid ID exists
                        if (selectedProduct || productEntries[index].id) {
                          await handleProductSelection(index, productEntries[index].id);
                        }
                      }}
                      list={`productIdSuggestions-${index}`}
                      className="border border-gray-300 px-4 py-3 rounded-lg w-full"
                    />
                    <datalist id={`productIdSuggestions-${index}`}>
                      {productSuggestions.map((suggestion) => (
                        <option key={suggestion.product_id} value={suggestion.product_id} />
                      ))}
                    </datalist>
                  </div>

                  {/* Product Name (Read-Only) */}
                  <div className="relative w-1/2">
                    <input
                      type="text"
                      value={product.name}
                      readOnly
                      className="border border-gray-300 px-4 py-3 rounded-lg w-full bg-gray-100"
                    />
                  </div>

                  {/* Product Price (Read-Only) */}
                  <div className="relative w-1/4">
                    <input
                      type="text"
                      value={product.price}
                      readOnly
                      className="border border-gray-300 px-4 py-3 rounded-lg w-full bg-gray-100"
                    />
                  </div>

                  {/* Quantity Input */}
                  <div className="relative w-1/4">
                    <input
                      type="number"
                      id={`productQuantity-${index}`}
                      placeholder="Quantity"
                      value={product.quantity}
                      ref={(el) => (quantityRefs.current[index] = el)}
                      onChange={(e) =>
                        handleProductEntryChange(index, "quantity", e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          nextStep();
                        }
                      }}
                      className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center"
                    />
                  </div>

                  {/* Delete Button */}
                  {productEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProductEntry(index)}
                      className="text-red-500 hover:text-red-700 transition"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add New Product Button */}
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


        {/* Step 2: Due Date */}
        {step === 2 && (
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

        {/* Step 3: MR Number and Patient Details */}
        {step === 3 && (
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
                // No need to focus next button here as focus is managed in handleMRNumberSearch
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

        {/* Step 4: Employee Selection, B2B Toggle, and GST Number if B2B */}
        {step === 4 && (
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
            {employee && (
              <EmployeeVerification
                employee={employee}
                onVerify={(isVerified) => {
                  setIsPinVerified(isVerified);
                  if (isVerified) {
                    setTimeout(() => nextButtonRef.current?.focus(), 100);
                  }
                }}
              />
            )}
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
                    className={`w-11 h-6 rounded-full transition-colors duration-300 ${isB2B ? "bg-green-500" : "bg-gray-300"}`}
                  ></div>
                  <div
                    className={`absolute w-5 h-5 bg-white rounded-full top-0.5 left-0.5 transform transition-transform duration-300 ${isB2B ? "translate-x-5" : "translate-x-0"}`}
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

        {/* Step 5: Payment Method, Advance Details, Save and Print */}
        {step === 5 && (
          <>
            {/* Printable Area */}
            <div className="printable-area print:block print:absolute print:inset-0 print:w-full bg-white p-8 rounded-lg text-gray-800">
              {/* Invoice Header */}
              <div className="flex justify-between items-center mb-8">
                {/* GST Number on the left */}
                <div>
                  <p className="text-sm text-gray-600 font-semibold">
                    GST Number: 32AAUCS7002H1ZV
                  </p>
                </div>
                {/* Company Logo on the right */}
                <div>
                  <img
                    src={logo} // Replace with your logo's file path
                    alt="Company Logo"
                    className="w-48 h-auto"
                  />
                </div>
              </div>

              {/* Invoice Details */}
              <div className="invoice-details grid grid-cols-1 md:grid-cols-2 gap-4 mt-20 mb-6">
                <h2 className="text-2xl font-semibold mt-2">Work Order Summary</h2>
                <div>
                  <p>
                    <span className="font-semibold">Work Order ID:</span> <span className="font-normal">{workOrderId}</span>
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
                </div>
              </div>

              {/* Product Table */}
              <table className="w-full border border-gray-300 rounded-md mb-6">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 border-b">Product ID</th>
                    <th className="py-2 px-4 border-b">Product Name</th>
                    <th className="py-2 px-4 border-b">HSN Code</th>
                    <th className="py-2 px-4 border-b">Price</th>
                    <th className="py-2 px-4 border-b">Quantity</th>
                    <th className="py-2 px-4 border-b">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {productEntries.map((product, index) => {
                    const productSubtotal = (parseFloat(product.price) || 0) * (parseInt(product.quantity) || 0);
                    return (
                      <tr key={index} className="text-center">
                        <td className="py-2 px-4 border-b">{product.id}</td>
                        <td className="py-2 px-4 border-b">{product.name}</td>
                        <td className="py-2 px-4 border-b">9001</td>
                        <td className="py-2 px-4 border-b">₹ {parseFloat(product.price).toFixed(2)}</td>
                        <td className="py-2 px-4 border-b">{product.quantity}</td>
                        <td className="py-2 px-4 border-b">₹ {productSubtotal.toFixed(2)}</td>
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
                    <span className="font-semibold">CGST (6%):</span> ₹{cgst.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">SGST (6%):</span> ₹{sgst.toFixed(2)}
                  </p>
                </div>

                {/* Right Column */}
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">Subtotal:</span> ₹{subtotal.toFixed(2)}
                  </p>

                  <p>
                    <span className="font-semibold">Advance Paid:</span> ₹{advance.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Balance Due:</span> ₹{balanceDue.toFixed(2)}
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
                    Advance Paying:
                  </label>
                  <input
                    type="number"
                    id="advanceDetails"
                    placeholder="Enter amount paid in advance"
                    value={advanceDetails}
                    onChange={(e) => setAdvanceDetails(e.target.value)}
                    onKeyDown={(e) => handleEnterKey(e, saveButtonRef)}
                    ref={advanceDetailsRef}
                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                  />
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

                      setTimeout(() => {
                        printButtonRef.current?.focus();
                      }, 0);
                    }
                  }
                }}
                className="flex items-center justify-center w-44 h-12 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"

              >
                {isSaving ? "Saving..." : "Save Work Order"}
              </button>

              {allowPrint && (
                <button
                  onClick={() => {
                    setIsPrinted(true); // Mark as printed
                    window.print();
                  }}
                  ref={printButtonRef}
                  className="flex items-center justify-center w-44 h-12 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"

                >
                  <PrinterIcon className="w-5 h-5 mr-2" />
                  Print
                </button>

              )}

              {/* Exit Button */}
              {allowPrint && (

                <button
                  onClick={handleExit}
                  className="flex items-center justify-center w-44 h-12 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"

                >
                  Exit
                </button>

              )}
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
          {step < 5 && (
            <button
              ref={nextButtonRef}
              onClick={nextStep}
              className="bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg"
              disabled={step === 4 && !isPinVerified}
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

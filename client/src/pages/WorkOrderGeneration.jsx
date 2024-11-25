// client/src/pages/WorkOrderGeneration.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { CalendarIcon, PrinterIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import supabase from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import EmployeeVerification from "../components/EmployeeVerification";
import { useNavigate, useParams } from 'react-router-dom';
import logo from '../assets/sreenethraenglishisolated.png';
import { useReactToPrint } from 'react-to-print';
import BillPrint from '../components/BillPrint';

const WorkOrderGeneration = ({ isCollapsed }) => {
  const { branch, name, user } = useAuth();
  const { orderId } = useParams(); // Get orderId from route params
  const isEditing = Boolean(orderId);

  const [step, setStep] = useState(1);
  const [workOrderId, setWorkOrderId] = useState("");
  const [isPrinted, setIsPrinted] = useState(false);

  const [productEntries, setProductEntries] = useState([
    { id: "", name: "", price: "", quantity: "" },
  ]);
  const [advanceDetails, setAdvanceDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [mrNumber, setMrNumber] = useState("");
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [patientDetails, setPatientDetails] = useState(null);
  const [employee, setEmployee] = useState("");
  const [employees, setEmployees] = useState([]);
  const [allowPrint, setAllowPrint] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [discount, setDiscount] = useState(""); // New state for discount
  const [validationErrors, setValidationErrors] = useState({});
  const [isB2B, setIsB2B] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [hasMrNumber, setHasMrNumber] = useState(null); // New state to track MR number presence

  // Customer details if MR number is not provided
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [modificationRequestId, setModificationRequestId] = useState(null);

  // Refs
  const dueDateRef = useRef(null);
  const mrNumberRef = useRef(null);
  const employeeRef = useRef(null);
  const paymentMethodRef = useRef(null);
  const gstNumberRef = useRef(null);
  const advanceDetailsRef = useRef(null);
  const discountRef = useRef(null); // Ref for discount field
  const printButtonRef = useRef(null);
  const saveButtonRef = useRef(null);
  const newWorkOrderButtonRef = useRef(null);
  const nextButtonRef = useRef(null);
  const fetchButtonRef = useRef(null);
  const quantityRefs = useRef([]);
  const yesButtonRef = useRef(null);
  const noButtonRef = useRef(null);
  const customerNameRef = useRef(null);
  const customerPhoneRef = useRef(null);
  const billPrintRef = useRef();

  const navigate = useNavigate();

  // Fetch employees from the Supabase `employees` table
  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("name")
        .eq("branch", branch); // Filter by branch if necessary

      if (error) {
        console.error("Error fetching employees:", error.message);
      } else {
        setEmployees(data.map((emp) => emp.name)); // Extract only names
      }
    } catch (err) {
      console.error("Unexpected error fetching employees:", err);
    }
  };

  useEffect(() => {
    if (branch) {
      fetchEmployees(); // Fetch employees when `branch` is available
    }
  }, [branch]);

  // Validation for Employee Dropdown
  const validateEmployeeSelection = () => {
    if (!employee) {
      setValidationErrors((prev) => ({ ...prev, employee: "Employee selection is required." }));
      employeeRef.current?.focus();
    } else {
      setValidationErrors((prev) => {
        const { employee, ...rest } = prev;
        return rest;
      });
    }
  };

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
      const suggestions = await fetchProductSuggestions(value, "id");
      setProductSuggestions(suggestions);
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
    } else if (field === "discount" && discount && (isNaN(discount) || discount < 0 || discount > 100)) {
      errors[`discount`] = "Enter a valid discount percentage (0-100)";
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
            quantity: prevEntries[index].quantity || "", // Preserve quantity
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
    setAdvanceDetails("");
    setDueDate("");
    setMrNumber("");
    setPatientDetails(null);
    setEmployee("");
    setPaymentMethod("");
    setDiscount(""); // Reset discount
    setGstNumber("");
    setValidationErrors({});
    setIsB2B(false);
    setAllowPrint(false);
    if (!isEditing) {
      setWorkOrderId("");
      generateNewWorkOrderId();
    }
    setHasMrNumber(null); // Reset MR number presence
    setCustomerName("");
    setCustomerPhone("");
  };

  // GST Rate
  const GST_RATE = 12; // Total GST is 12% (6% CGST + 6% SGST)
  const HSN_CODE = "9001"; // Dummy HSN Code

  // Calculate totals
  const calculateTotals = (entries, discountPercentage) => {
    const subtotal = entries.reduce((total, product) => {
      const price = parseFloat(product.price) || 0;
      const quantity = parseInt(product.quantity) || 0;
      return total + price * quantity;
    }, 0);

    // Ensure discountPercentage is between 0 and 100
    const validDiscountPercentage = Math.min(Math.max(discountPercentage || 0, 0), 100);
    const discountAmount = (subtotal * validDiscountPercentage) / 100;
    const discountedSubtotal = Math.max(subtotal - discountAmount, 0); // Prevent negative subtotal

    const cgst = (subtotal * 6) / 100 || 0;
    const sgst = (subtotal * 6) / 100 || 0;

    // Exclude cgst and sgst from totalAmount
    const totalAmount = Math.max(discountedSubtotal, 0); // Prevent negative total

    return { subtotal, discountAmount, discountedSubtotal, cgst, sgst, totalAmount };
  };

  // References for managing field focus
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    focusFirstFieldOfStep();
  }, [step, isB2B, isEditing]);

  const focusFirstFieldOfStep = () => {
    if (step === 1) {
      document.getElementById(`productId-0`)?.focus();
    }
    if (step === 2) {
      dueDateRef.current?.focus();
    }
    if (step === 3) {
      // Focus on the "Yes" button initially
      yesButtonRef.current?.focus();
    }
    if (step === 4) {
      if (isB2B) gstNumberRef.current?.focus();
      else employeeRef.current?.focus();
    }
    if (step === 5) {
      discountRef.current?.focus(); // Start with discount field
    }
  };

  // Updates in the Discount field handler
  const handleDiscountInput = (e) => {
    let value = e.target.value.replace(/^0+/, ""); // Remove leading zeros
    if (!value) value = ""; // Ensure empty string for invalid input
    const numericValue = Math.min(Math.max(parseFloat(value) || 0, 0), 100); // Clamp value between 0 and 100
    setDiscount(numericValue.toString()); // Set cleaned value
  };

  // Add advance amount validation
  const validateAdvanceAmount = () => {
    if (parseFloat(advanceDetails) > totalAmount) {
      alert("Advance amount cannot exceed the total amount.");
      return false;
    }
    return true;
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

  // Print handler using react-to-print
  const handlePrint = useReactToPrint({
    content: () => billPrintRef.current,
    documentTitle: `WorkOrder-${workOrderId}`,
    onAfterPrint: () => {
      setIsPrinted(true); // Mark as printed
      resetForm();
      navigate("/home");
    },
  });

  const addNewProductEntry = () => {
    setProductEntries((prevEntries) => {
      const updatedEntries = [
        ...prevEntries,
        { id: "", name: "", price: "", quantity: "" },
      ];
      // Focus on the new product id field
      setTimeout(() => {
        document
          .getElementById(`productId-${updatedEntries.length - 1}`)
          ?.focus();
      }, 0);
      return updatedEntries;
    });
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

  // Memoize calculated values
  const { subtotal = 0, discountAmount = 0, discountedSubtotal = 0, cgst = 0, sgst = 0, totalAmount = 0 } = useMemo(
    () => calculateTotals(productEntries, parseFloat(discount)),
    [productEntries, discount]
  );

  // Balance calculations
  const advance = parseFloat(advanceDetails) || 0;
  const balanceDue = totalAmount - advance;

  const saveWorkOrder = async () => {
    if (isSaving) {
      alert("Please wait while the work order is being saved.");
      return;
    }

    setIsSaving(true);

    // Validate advance amount
    if (!validateAdvanceAmount()) {
      setIsSaving(false);
      return;
    }

    // Validation Checks
    const validations = [
      { condition: !employee, errorKey: "employee", message: "Employee selection is required.", ref: employeeRef },
      { condition: isB2B && !gstNumber, errorKey: "gstNumber", message: "GST Number is required for B2B orders.", ref: gstNumberRef },
      { condition: discount && (isNaN(discount) || discount < 0 || discount > 100), errorKey: "discount", message: "Enter a valid discount percentage (0-100).", ref: discountRef },
      { condition: !paymentMethod, errorKey: "paymentMethod", message: "Payment method is required.", ref: paymentMethodRef },
    ];

    for (const validation of validations) {
      if (validation.condition) {
        setValidationErrors((prev) => ({ ...prev, [validation.errorKey]: validation.message }));
        validation.ref?.current?.focus();
        setIsSaving(false);
        return;
      }
    }

    // Validate product entries
    const productErrors = {};
    productEntries.forEach((product, index) => {
      if (!product.id) productErrors[`productId-${index}`] = "Product ID is required.";
      if (!product.price) productErrors[`productPrice-${index}`] = "Price is required.";
      if (!product.quantity) productErrors[`productQuantity-${index}`] = "Quantity is required.";
    });

    // Step 3 Validation for MR number or customer details
    if (step === 3) {
      if (hasMrNumber === null) {
        productErrors["hasMrNumber"] = "Please indicate if you have an MR Number.";
      } else if (hasMrNumber) {
        if (!mrNumber) productErrors["mrNumber"] = "MR Number is required.";
      } else {
        if (!customerName) productErrors["customerName"] = "Customer name is required.";
        if (!customerPhone) productErrors["customerPhone"] = "Customer phone number is required.";
      }
    }

    // Handle Product Validation Errors
    if (Object.keys(productErrors).length > 0) {
      setValidationErrors(productErrors);
      const firstErrorKey = Object.keys(productErrors)[0];
      document.getElementById(firstErrorKey)?.focus();
      setIsSaving(false);
      return;
    }

    // Clear errors
    setValidationErrors({});

    try {
      let customerId = null;

      if (hasMrNumber) {
        // Fetch existing customer by MR number
        const { data: existingCustomer, error: customerError } = await supabase
          .from("patients")
          .select("id")
          .eq("mr_number", mrNumber.trim())
          .single();

        if (customerError) {
          alert("No valid patient found with the provided MR Number.");
          setIsSaving(false);
          return;
        }

        customerId = existingCustomer?.id;
      } else {
        // Create new customer
        const { data: newCustomer, error: customerCreationError } = await supabase
          .from("customers")
          .insert({
            name: customerName.trim(),
            phone_number: customerPhone.trim(),
          })
          .select("id")
          .single();

        if (customerCreationError) {
          alert("Failed to create a new customer.");
          setIsSaving(false);
          return;
        }

        customerId = newCustomer?.id;
      }

      // Prepare the payload
      let payload = {
        product_entries: productEntries,
        advance_details: advance,
        due_date: dueDate,
        discount_percentage: discount ? parseFloat(discount) : 0,
        mr_number: hasMrNumber ? mrNumber : null,
        patient_details: hasMrNumber
          ? {
              mr_number: mrNumber,
              name: patientDetails?.name,
              age: patientDetails?.age,
              phone_number: patientDetails?.phoneNumber,
              gender: patientDetails?.gender,
              address: patientDetails?.address,
            }
          : { name: customerName, phone_number: customerPhone },
        employee,
        payment_method: paymentMethod,
        subtotal,
        discount_amount: discountAmount,
        discounted_subtotal: discountedSubtotal,
        cgst,
        sgst,
        total_amount: totalAmount,
        hsn_code: HSN_CODE,
        is_b2b: isB2B,
        gst_number: isB2B ? gstNumber : null,
        updated_at: new Date().toISOString(),
        branch: branch,
        customer_id: customerId,
        discount_percentage: discount ? parseFloat(discount) : 0,
        discount_amount: discountAmount,
        discounted_subtotal: discountedSubtotal,
      };

      if (isEditing) {
        payload.work_order_id = workOrderId;
        const { error } = await supabase
          .from("work_orders")
          .update(payload)
          .eq("work_order_id", workOrderId);

        if (error) {
          alert("Failed to update work order.");
        } else {
          alert("Work order updated successfully!");
          setAllowPrint(true);
        }
      } else {
        // Ensure workOrderId is set before inserting
        if (!workOrderId) {
          alert("Work Order ID is not generated yet. Please wait.");
          setIsSaving(false);
          return;
        }
        payload.work_order_id = workOrderId;
        payload.created_at = new Date().toISOString();

        const { error } = await supabase.from("work_orders").insert(payload);

        if (error) {
          if (error.status === 409) {
            alert("Work Order ID already exists. Please try saving again.");
            // Optionally, regenerate Work Order ID
            generateNewWorkOrderId();
          } else {
            alert("Failed to save work order.");
          }
        } else {
          alert("Work order saved successfully!");
          setAllowPrint(true);
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("An unexpected error occurred while saving the work order.");
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    let errors = {};

    if (step === 1) {
      // Validate Step 1: Product Entries
      productEntries.forEach((product, index) => {
        if (!product.id) errors[`productId-${index}`] = "Product ID is required.";
        if (!product.price) errors[`productPrice-${index}`] = "Price is required.";
        if (!product.quantity) errors[`productQuantity-${index}`] = "Quantity is required.";
      });
    } else if (step === 2) {
      // Validate Step 2: Due Date
      if (!dueDate) errors.dueDate = "Due date is required.";
    } else if (step === 3) {
      // Validate Step 3: MR Number or Customer Details
      if (hasMrNumber === null) {
        errors.hasMrNumber = "Please indicate if you have an MR Number.";
      } else if (hasMrNumber) {
        if (!mrNumber) errors.mrNumber = "MR Number is required.";
      } else {
        if (!customerName) errors.customerName = "Customer name is required.";
        if (!customerPhone) errors.customerPhone = "Customer phone number is required.";
      }
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
      // Validate Step 5: Discount, Payment Method, and Advance Details
      if (discount && (isNaN(discount) || discount < 0 || discount > 100)) {
        errors.discount = "Enter a valid discount percentage (0-100).";
      }
      if (!paymentMethod) errors.paymentMethod = "Payment method is required.";
      if (!advanceDetails) errors.advanceDetails = "Advance details are required.";
      if (step === 5 && !validateAdvanceAmount()) {
        return; // Prevent proceeding if advance amount validation fails
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Focus on the first error field
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey.startsWith('productId') || firstErrorKey.startsWith('productPrice') || firstErrorKey.startsWith('productQuantity')) {
        const index = firstErrorKey.split('-')[1];
        document.getElementById(firstErrorKey)?.focus();
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
      } else if (firstErrorKey === 'discount') {
        discountRef.current?.focus();
      } else if (firstErrorKey === 'hasMrNumber') {
        yesButtonRef.current?.focus();
      } else if (firstErrorKey === 'customerName') {
        customerNameRef.current?.focus();
      } else if (firstErrorKey === 'customerPhone') {
        customerPhoneRef.current?.focus();
      }
      return;
    }

    // Clear errors and proceed to the next step
    setValidationErrors({});
    if (step < 5) setStep((prevStep) => prevStep + 1);
  };

  const prevStep = () => setStep((prevStep) => Math.max(prevStep - 1, 1));

  const handleMRNumberSearch = async () => {
    if (!mrNumber.trim()) {
      alert("Please enter a valid MR Number.");
      mrNumberRef.current?.focus();
      return;
    }
    try {
      const { data, error } = await supabase
        .from('patients') // Correct table for MR number lookup
        .select('id, age, mr_number, phone_number, name, gender, address') // Added 'condition'
        .eq('mr_number', mrNumber.trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No data found
          alert("No patient found with the provided MR Number.");
        } else {
          console.error("Error fetching patient details:", error.message);
          alert("Failed to fetch patient details.");
        }
        setPatientDetails(null); // Clear previous details
        return;
      }

      if (data) {
        setPatientDetails({
          name: data.name,
          age: data.age,
          phoneNumber: data.phone_number,
          gender: data.gender,
          address: data.address,
          mr_number: data.mr_number, // Ensure 'condition' is fetched
        });
        // Move focus to the Next button
      setTimeout(() => {
        nextButtonRef.current?.focus();
      }, 0);
      }
    } catch (err) {
      console.error("Unexpected error fetching patient details:", err);
      alert("An unexpected error occurred while fetching patient details.");
      setPatientDetails(null);
    }
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
        const parts = lastWorkOrderId.split('-');
        if (parts.length >= 3) {
          const countPart = parts[1];
          lastCount = parseInt(countPart, 10) || 0;
        }
      }

      const newCount = lastCount + 1;
      const newWorkOrderId = `WO(${branch})-${newCount}-${financialYear}`;
      setWorkOrderId(newWorkOrderId);
      console.log("Generated Work Order ID:", newWorkOrderId);
    } catch (error) {
      console.error("Error generating Work Order ID:", error);
    }
  };

  const fetchWorkOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('work_order_id', orderId)
        .single();

      if (error) {
        console.error("Error fetching work order details:", error);
        alert("Failed to fetch work order details.");
        navigate("/home");
      } else {
        // Populate the form with existing data
        setWorkOrderId(data.work_order_id);
        setProductEntries(data.product_entries || [{ id: "", name: "", price: "", quantity: "" }]);
        setAdvanceDetails(data.advance_details || "");
        setDueDate(data.due_date || "");
        setDiscount(data.discount_percentage || "");
        setPaymentMethod(data.payment_method || "");
        setIsB2B(data.is_b2b || false);
        setGstNumber(data.gst_number || "");
        setEmployee(data.employee || "");
        setHasMrNumber(data.mr_number ? true : false);
        if (data.mr_number) {
          setMrNumber(data.mr_number);
          // Fetch patient details based on MR number
          try {
            const { data: patientData, error: patientError } = await supabase
              .from('patients')
              .select('name, age, phone_number, gender, address') // Ensure 'condition' is fetched
              .eq('mr_number', data.mr_number)
              .single();

            if (patientError) {
              console.error("Error fetching patient details for existing work order:", patientError.message);
              setPatientDetails(null);
            } else {
              setPatientDetails({
                name: patientData.name,
                age: patientData.age,
                phoneNumber: patientData.phone_number,
                gender: patientData.gender,
                address: patientData.address,
                mr_number: data.mr_number,
              });
            }
          } catch (err) {
            console.error("Unexpected error fetching patient details for existing work order:", err);
            setPatientDetails(null);
          }
        } else {
          setCustomerName(data.patient_details?.name || "");
          setCustomerPhone(data.patient_details?.phone_number || "");
        }
        // Fetch the corresponding modification request
        const { data: modData, error: modError } = await supabase
          .from('modification_requests')
          .select('*')
          .eq('order_id', orderId)
          .eq('status', 'approved') // Assuming the status was 'approved'
          .single();

        if (modError) {
          console.error("Error fetching modification request:", modError);
        } else {
          setModificationRequestId(modData.request_id);
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching work order details:", err);
      alert("An unexpected error occurred while fetching work order details.");
      navigate("/home");
    }
  };

  useEffect(() => {
    if (isEditing && orderId) {
      fetchWorkOrderDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, orderId]);

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
  }, [isPrinted, navigate, isEditing]);

  useEffect(() => {
    if (!isEditing && branch) {
      generateNewWorkOrderId();
    }
  }, [branch, isEditing]);

  useEffect(() => {
    if (step === 4) {
      setIsPinVerified(false);
    }
  }, [step]);

  // Initialize workOrderId when component mounts and branch is available
  useEffect(() => {
    if (!isEditing && branch && !workOrderId) {
      generateNewWorkOrderId();
    }
  }, [branch, isEditing, workOrderId]);

  return (
    <div
      className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"} justify-center mt-16 p-4 mx-auto`}
    >
      <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">
        {isEditing ? "Edit Work Order" : "Work Order Generation"}
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
                {isEditing ? "Work Order ID" : "Generated Work Order ID"}
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
                        if (e.key === "Enter" && e.shiftKey) {
                          e.preventDefault();
                          addNewProductEntry();
                        } else if (e.key === "Enter") {
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
                      className={`border border-gray-300 px-4 py-3 rounded-lg w-full ${validationErrors[`productId-${index}`] ? 'border-red-500' : ''}`}
                    />
                    <datalist id={`productIdSuggestions-${index}`}>
                      {productSuggestions.map((suggestion) => (
                        <option key={suggestion.product_id} value={suggestion.product_id} />
                      ))}
                    </datalist>
                    {validationErrors[`productId-${index}`] && (
                      <p className="text-red-500 text-xs mt-1">
                        {validationErrors[`productId-${index}`]}
                      </p>
                    )}
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
                        setProductEntries((prevEntries) => {
                          const updatedEntries = [...prevEntries];
                          updatedEntries[index].quantity = e.target.value;
                          return updatedEntries;
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (e.shiftKey) {
                            addNewProductEntry();
                          } else {
                            nextStep();
                          }
                        }
                      }}
                      className={`border border-gray-300 px-4 py-3 rounded-lg w-full text-center ${validationErrors[`productQuantity-${index}`] ? 'border-red-500' : ''}`}
                      onBlur={() => handleBlur(index, "quantity")}
                    />
                    {validationErrors[`productQuantity-${index}`] && (
                      <p className="text-red-500 text-xs mt-1">
                        {validationErrors[`productQuantity-${index}`]}
                      </p>
                    )}
                  </div>

                  {/* Delete Button */}
                  {productEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProductEntry(index)}
                      className="text-red-500 hover:text-red-700 transition"
                      aria-label={`Delete product entry ${index + 1}`}
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
                className={`border border-gray-300 w-full px-10 py-3 rounded-lg text-center appearance-none ${validationErrors.dueDate ? 'border-red-500' : ''}`}
              />
              {validationErrors.dueDate && (
                <p className="text-red-500 text-xs mt-1">
                  {validationErrors.dueDate}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: MR Number or Customer Details */}
        {step === 3 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-6">
            <h2 className="text-lg font-semibold text-gray-700">Customer Details</h2>

            {/* Prompt for MR Number */}
            <div className="flex items-center space-x-4">
              <span className="font-medium text-gray-700">Do you have an MR Number?</span>
              <button
                type="button"
                onClick={() => {
                  setHasMrNumber(true);
                  setValidationErrors((prev) => {
                    const { hasMrNumber, ...rest } = prev;
                    return rest;
                  });
                  // Move focus to MR Number input
                  setTimeout(() => {
                    mrNumberRef.current?.focus();
                  }, 0);
                }}
                ref={yesButtonRef}
                className={`px-4 py-2 rounded-lg focus:outline-none ${
                  hasMrNumber === true ? "bg-green-600 text-white" : "bg-green-500 text-white hover:bg-green-600"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasMrNumber(false);
                  setValidationErrors((prev) => {
                    const { hasMrNumber, ...rest } = prev;
                    return rest;
                  });
                  // Move focus to Customer Name input
                  setTimeout(() => {
                    customerNameRef.current?.focus();
                  }, 0);
                }}
                ref={noButtonRef}
                className={`px-4 py-2 rounded-lg focus:outline-none ${
                  hasMrNumber === false ? "bg-red-600 text-white" : "bg-red-500 text-white hover:bg-red-600"
                }`}
              >
                No
              </button>
            </div>
            {validationErrors.hasMrNumber && (
              <p className="text-red-500 text-xs mt-1">
                {validationErrors.hasMrNumber}
              </p>
            )}

            {/* Conditional Rendering based on MR Number Presence */}
            {hasMrNumber ? (
              <>
                {/* MR Number Input */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    MR Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter MR Number of Patient"
                    value={mrNumber}
                    onChange={(e) => {
                      setMrNumber(e.target.value);
                      setPatientDetails(null); // Reset patient details when MR number changes
                    }}
                    onKeyDown={(e) => handleEnterKey(e, fetchButtonRef)}
                    ref={mrNumberRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.mrNumber ? 'border-red-500' : ''}`}
                  />
                  {validationErrors.mrNumber && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.mrNumber}
                    </p>
                  )}
                </div>
                {/* Fetch Button */}
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
                {/* Display Patient Details */}
                {patientDetails && (
                  <div className="mt-4 bg-gray-100 p-4 rounded border border-gray-200">
                    <p>
                      <strong>Name:</strong> {patientDetails.name || 'N/A'}
                    </p>
                    <p>
                      <strong>Age:</strong> {patientDetails.age || 'N/A'}
                    </p>
                    <p>
                      <strong>Phone Number:</strong> {patientDetails.phoneNumber || 'N/A'}
                    </p>
                    <p>
                      <strong>Gender:</strong> {patientDetails.gender || 'N/A'}
                    </p>
                    <p>
                      <strong>Address:</strong> {patientDetails.address || 'N/A'}
                    </p>
                    
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Customer Name Input */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onKeyDown={(e) => handleEnterKey(e, customerPhoneRef)}
                    ref={customerNameRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.customerName ? 'border-red-500' : ''}`}
                  />
                  {validationErrors.customerName && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.customerName}
                    </p>
                  )}
                </div>
                {/* Customer Phone Number Input */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Customer Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Customer Phone Number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
                    ref={customerPhoneRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.customerPhone ? 'border-red-500' : ''}`}
                  />
                  {validationErrors.customerPhone && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.customerPhone}
                    </p>
                  )}
                </div>
              </>
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
              onBlur={validateEmployeeSelection}
              className={`border border-gray-300 w-full px-4 py-3 rounded-lg focus:outline-none focus:border-green-500 ${validationErrors.employee ? 'border-red-500' : ''}`}
            >
              <option value="" disabled>
                Select Employee
              </option>
              {employees.map((emp, index) => (
                <option key={index} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
            {validationErrors.employee && (
              <p className="text-red-500 text-xs mt-1">
                {validationErrors.employee}
              </p>
            )}

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

            {/* B2B Toggle */}
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
                  className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.gstNumber ? 'border-red-500' : ''}`}
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

        
        {/* Step 5: Discount, Payment Method, Advance Details, Save and Print */}
        {step === 5 && (
          <>
            {/* Printable Area */}
            <div className="printable-area print:block print:absolute print:inset-0 print:w-full bg-white p-8 pt-0 rounded-lg text-gray-800">
              

              {/* Invoice Details */}
              <div className="invoice-details grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <h2 className="text-2xl font-semibold mt-2">Bill</h2>
                <div>
                  <p>
                    <span className="font-semibold">Work Order ID:</span> <span className="font-normal">{workOrderId}</span>
                  </p>
                  <p>
                    <span className="font-semibold">Due Date:</span> <span className="font-normal">{dueDate}</span>
                  </p>
                  {hasMrNumber ? (
        <>
          <p>
            <span className="font-semibold">Customer MR Number:</span> <span className="font-normal">{mrNumber || 'N/A'}</span>
          </p>
          {patientDetails && (
            <>
              <p>
                <span className="font-semibold">Name:</span> <span className="font-normal">{patientDetails.name || 'N/A'}</span>
              </p>
              <p>
                <span className="font-semibold">Age:</span> <span className="font-normal">{patientDetails.age || 'N/A'}</span>
              </p>
              <p>
                <span className="font-semibold">Phone Number:</span> <span className="font-normal">{patientDetails.phoneNumber || 'N/A'}</span>
              </p>
              <p>
                <span className="font-semibold">Gender:</span> <span className="font-normal">{patientDetails.gender || 'N/A'}</span>
              </p>
              <p>
                <span className="font-semibold">Address:</span> <span className="font-normal">{patientDetails.address || 'N/A'}</span>
              </p>
            </>
          )}
        </>
      ) : (
                    <>
                      <p>
                        <span className="font-semibold">Customer Name:</span> <span className="font-normal">{customerName || 'N/A'}</span>
                      </p>
                      <p>
                        <span className="font-semibold">Customer Phone Number:</span> <span className="font-normal">{customerPhone || 'N/A'}</span>
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <p>
                    <span className="font-semibold">Billed by:</span> <span className="font-normal">{employee || 'N/A'}</span>
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
                        <td className="py-2 px-4 border-b">{HSN_CODE}</td>
                        <td className="py-2 px-4 border-b">{parseFloat(product.price).toFixed(2)}</td>
                        <td className="py-2 px-4 border-b">{product.quantity}</td>
                        <td className="py-2 px-4 border-b">{productSubtotal.toFixed(2)}</td>
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
                    <span className="font-semibold">Subtotal:</span> ₹{subtotal.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Discount ({discount || 0}%):</span> ₹{discountAmount.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Discounted Subtotal:</span> ₹{discountedSubtotal.toFixed(2)}
                  </p>
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
                    <span className="font-semibold">Total Amount:</span> ₹{totalAmount.toFixed(2)}
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
                {/* Discount Input Field */}
                <div className="w-full md:w-1/3 mb-4 md:mb-0">
                  <label htmlFor="discount" className="block font-semibold mb-1">
                    Discount (%):
                  </label>
                  <input
                    type="number"
                    id="discount"
                    placeholder="Enter discount percentage"
                    value={discount}
                    onChange={handleDiscountInput}
                    onKeyDown={(e) => handleEnterKey(e, paymentMethodRef)}
                    ref={discountRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.discount ? 'border-red-500' : ''}`}
                  />
                  {validationErrors.discount && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.discount}
                    </p>
                  )}
                </div>

                {/* Payment Method */}
                <div className="w-full md:w-1/3 mb-4 md:mb-0">
                  <label htmlFor="paymentMethod" className="block font-semibold mb-1">
                    Payment Method:
                  </label>
                  <select
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    ref={paymentMethodRef}
                    onKeyDown={(e) => handleEnterKey(e, advanceDetailsRef)}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.paymentMethod ? 'border-red-500' : ''}`}
                  >
                    <option value="" disabled>Select Payment Method</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Card</option>
                    <option value="online">UPI (Paytm/PhonePe/GPay)</option>
                  </select>
                  {validationErrors.paymentMethod && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.paymentMethod}
                    </p>
                  )}
                </div>

                {/* Advance Details */}
                <div className="w-full md:w-1/3 mb-4 md:mb-0">
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
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.advanceDetails ? 'border-red-500' : ''}`}
                  />
                  {validationErrors.advanceDetails && (
                    <p className="text-red-500 text-xs mt-1">
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

                      setTimeout(() => {
                        printButtonRef.current?.focus();
                      }, 0);
                    }
                  }
                }}
                className="flex items-center justify-center w-44 h-12 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                disabled={isSaving}
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
                  <XMarkIcon className="w-5 h-5 mr-2" />
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

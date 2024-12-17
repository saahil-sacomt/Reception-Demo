// client/src/pages/WorkOrderGeneration.jsx

import React, {
  useEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  CalendarIcon,
  PrinterIcon,
  TrashIcon,
  XMarkIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import supabase from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import EmployeeVerification from "../components/EmployeeVerification";
import { useNavigate, useParams } from "react-router-dom";
import logo from "../assets/sreenethraenglishisolated.png";
import { useGlobalState } from "../context/GlobalStateContext";

const today = new Date();
const dd = String(today.getDate()).padStart(2, "0");
const mm = String(today.getMonth() + 1).padStart(2, "0");
const yyyy = today.getFullYear();

const formattedDate = `${dd}/${mm}/${yyyy}`;

const formatDate = (date) => {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const WorkOrderGeneration = ({ isCollapsed }) => {
  const { branch } = useAuth();
  const { orderId } = useParams(); // Get orderId from route params
  const isEditing = Boolean(orderId);

  const { state, dispatch, resetState } = useGlobalState();
  const { workOrderForm } = state;

  const {
    step,
    workOrderId,
    isPrinted,
    productEntries,
    advanceDetails,
    dueDate,
    mrNumber,
    isPinVerified,
    patientDetails,
    employee,
    paymentMethod,
    discount,
    gstNumber,
    isB2B,
    hasMrNumber,
    customerName,
    customerPhone,
    customerAddress,
    customerAge,
    customerGender,
    submitted,
    modificationRequestId,
    isSaving,
    allowPrint,
    employees,
  } = workOrderForm;

  const navigate = useNavigate();
  const setSearchQuery = (query) => {
    dispatch({
      type: "SET_WORK_ORDER_FORM",
      payload: { searchQuery: query },
    });
  };

  const handleSearchQueryChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Initialize productSuggestions as an object for per-product index suggestions
  const [productSuggestions, setProductSuggestions] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

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
  const nextButtonRef = useRef(null);
  const fetchButtonRef = useRef(null);
  const quantityRefs = useRef([]);
  const yesButtonRef = useRef(null);
  const noButtonRef = useRef(null);
  const customerNameRef = useRef(null);
  const customerPhoneRef = useRef(null);
  const customerAddressRef = useRef(null);
  const customerAgeRef = useRef(null);
  const customerGenderRef = useRef(null);
  const backToListButtonRef = useRef(null); // New ref for back to list button

  // Generate a new Work Order ID
  const generateNewWorkOrderId = useCallback(async () => {
    try {
      console.log("Attempting to generate new Work Order ID...");

      // Define default starting Work Order IDs per branch
      const branchDefaultIds = {
        TVR: 3742, // Trivandrum
        NTA: 4701, // Neyyantinkara
        KOT1: 5701, // Kottarakara 1
        KOT2: 6701, // Kottarakara 2
        KAT: 7701, // Kattakada
        // Add other branches as needed
      };

      if (!branch) {
        console.error("Branch is undefined. Cannot generate Work Order ID.");
        alert("Branch information is missing. Please try again.");
        return;
      }

      console.log("Current Branch:", branch);
      console.log(
        "Default Work Order ID for this branch:",
        branchDefaultIds[branch] || 1001
      );

      // Fetch the last Work Order ID for the current branch
      const { data: lastWorkOrders, error } = await supabase
        .from("work_orders")
        .select("work_order_id")
        .eq("branch", branch) // Filter by branch
        .order("work_order_id", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching last work order:", error);
        // alert("Error generating Work Order ID. Please try again.");
        return;
      }

      console.log("Last Work Orders Retrieved for branch:", lastWorkOrders);

      let newWorkOrderId = branchDefaultIds[branch] || 1001; // Default if no work orders exist for branch

      if (lastWorkOrders && lastWorkOrders.length > 0) {
        const lastWorkOrderId = parseInt(lastWorkOrders[0].work_order_id, 10);
        console.log("Last Work Order ID for branch:", lastWorkOrderId);
        if (!isNaN(lastWorkOrderId)) {
          newWorkOrderId = lastWorkOrderId + 1;
        } else {
          console.warn(
            "Invalid lastWorkOrderId, defaulting to:",
            newWorkOrderId
          );
        }
      }

      dispatch({
        type: "SET_WORK_ORDER_FORM",
        payload: { workOrderId: newWorkOrderId.toString() },
      });
      console.log("Generated Work Order ID:", newWorkOrderId);
    } catch (error) {
      console.error("Error generating Work Order ID:", error);
      alert("An unexpected error occurred while generating Work Order ID.");
    }
  }, [dispatch, branch]);

  // Fetch employees from the Supabase `employees` table
  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("name")
        .eq("branch", branch); // Filter by branch if necessary

      if (error) {
        console.error("Error fetching employees:", error.message);
      } else {
        dispatch({
          type: "SET_WORK_ORDER_FORM",
          payload: { employees: data.map((emp) => emp.name) },
        });
      }
    } catch (err) {
      console.error("Unexpected error fetching employees:", err);
    }
  }, [branch, dispatch]);

  useEffect(() => {
    if (branch) {
      fetchEmployees(); // Fetch employees when `branch` is available
    }
  }, [branch, fetchEmployees]);

  // Validation for Employee Dropdown
  const validateEmployeeSelection = useCallback(() => {
    if (!employee) {
      setValidationErrors((prev) => ({
        ...prev,
        employee: "Employee selection is required.",
      }));
      employeeRef.current?.focus();
    } else {
      setValidationErrors((prev) => {
        const { employee, ...rest } = prev;
        return rest;
      });
    }
  }, [employee]);

  // Utility function to get the current financial year
  const getFinancialYear = useCallback(() => {
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
  }, []);

  // Fetch product suggestions from Supabase based on user input
  const fetchProductSuggestions = useCallback(async (query, type, index) => {
    if (!query) return [];

    try {
      const column = type === "id" ? "product_id" : "product_name";
      const { data, error } = await supabase
        .from("products")
        .select(`product_id, product_name, mrp, hsn_code`)
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
  }, []);

  // Fetch product details from Supabase
  const fetchProductDetailsFromSupabase = useCallback(async (value, type) => {
    try {
      const column = type === "id" ? "product_id" : "product_name";
      const { data, error } = await supabase
        .from("products")
        .select("product_id, product_name, mrp, hsn_code")
        .eq(column, value);

      if (error) {
        console.error(
          `Error fetching product details by ${type}:`,
          error.message
        );
        return null;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error(
        `Unexpected error fetching product details by ${type}:`,
        err
      );
      return null;
    }
  }, []);

  // Handle product selection and fetch details
  const handleProductSelection = useCallback(
    async (index, productId) => {
      try {
        const productDetails = await fetchProductDetailsFromSupabase(
          productId,
          "id"
        );
        if (productDetails) {
          dispatch({
            type: "SET_WORK_ORDER_FORM",
            payload: {
              productEntries: productEntries.map((entry, i) =>
                i === index
                  ? {
                      id: productDetails.product_id,
                      name: productDetails.product_name,
                      price: productDetails.mrp || "",
                      quantity: entry.quantity || "",
                      hsn_code: productDetails.hsn_code || "",
                    }
                  : entry
              ),
            },
          });

          // Automatically move focus to the Quantity field
          setTimeout(() => {
            quantityRefs.current[index]?.focus();
          }, 100);
        }
      } catch (error) {
        console.error("Error fetching product details:", error);
      }
    },
    [dispatch, productEntries, fetchProductDetailsFromSupabase]
  );

  // Handle product input
  const handleProductInput = useCallback(
    async (index, value) => {
      dispatch({
        type: "SET_WORK_ORDER_FORM",
        payload: {
          productEntries: productEntries.map((entry, i) =>
            i === index ? { ...entry, id: value } : entry
          ),
        },
      });

      if (value) {
        const suggestions = await fetchProductSuggestions(value, "id", index);
        setProductSuggestions((prev) => ({
          ...prev,
          [index]: suggestions,
        }));

        // Automatically fetch details and focus quantity if exact match
        if (suggestions.length === 1 && suggestions[0].product_id === value) {
          await handleProductSelection(index, suggestions[0].product_id);
        }
      } else {
        setProductSuggestions((prev) => ({
          ...prev,
          [index]: [],
        }));
      }
    },
    [dispatch, productEntries, fetchProductSuggestions, handleProductSelection]
  );

  // Validation handler for product fields
  const validateField = useCallback(
    (index, field) => {
      const errors = { ...validationErrors };

      if (field === "id" && !productEntries[index].id) {
        errors[`productId-${index}`] = "Product ID is required";
      } else if (field === "price" && !productEntries[index].price) {
        errors[`productPrice-${index}`] = "Price is required";
      } else if (field === "quantity" && !productEntries[index].quantity) {
        errors[`productQuantity-${index}`] = "Quantity is required";
      } else if (field === "discount" && (isNaN(discount) || discount < 0)) {
        errors[`discount`] =
          "Enter a valid discount amount (cannot be negative)";
      } else {
        delete errors[`${field}-${index}`];
      }

      setValidationErrors(errors);
    },
    [validationErrors, productEntries, discount]
  );

  // Function to reset the form
  const resetForm = useCallback(() => {
    dispatch({ type: "RESET_WORK_ORDER_FORM" });
    setProductSuggestions({});
    setValidationErrors({});
    navigate("/home");
  }, [dispatch, navigate]);

  // GST Rate and HSN Code
  const GST_RATE = 12; // Total GST is 12% (6% CGST + 6% SGST)

  // Calculate totals
  const calculateTotals = useCallback((entries, discountAmt) => {
    // Initialize variables
    let subtotal = 0;
    let validDiscountAmount = 0;
    let discountedSubtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let totalAmount = 0;
    let totalAmountWithGST = 0;
    let discountedTotal = 0;

    // Calculate subtotal (price excluding GST)
    subtotal = entries.reduce((total, product) => {
      const price = parseFloat(product.price) || 0; // MRP including GST
      const quantity = parseInt(product.quantity) || 0;
      const basePrice = price / 1.12; // Adjusted price excluding GST
      return total + basePrice * quantity;
    }, 0);

    // Calculate total amount including GST (price * quantity)
    totalAmountWithGST = entries.reduce((total, product) => {
      const price = parseFloat(product.price) || 0; // MRP including GST
      const quantity = parseInt(product.quantity) || 0;
      return total + price * quantity;
    }, 0);

    // Apply discount
    validDiscountAmount = Math.min(discountAmt || 0, subtotal);
    discountedSubtotal = Math.max(
      (subtotal * 1.12 - validDiscountAmount) / 1.12,
      0
    ); // Prevent negative subtotal

    // Calculate GST amounts
    cgst = discountedSubtotal * 0.06;
    sgst = discountedSubtotal * 0.06;

    // Calculate total amount including GST
    totalAmount = discountedSubtotal + cgst + sgst;

    discountedTotal = totalAmountWithGST - validDiscountAmount;

    return {
      subtotal,
      discountAmount: validDiscountAmount,
      discountedSubtotal,
      cgst,
      sgst,
      totalAmount,
      totalAmountWithGST,
      discountedTotal,
    };
  }, []);

  // Utility function to get today's date in YYYY-MM-DD format
  const getTodayDate = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const focusFirstFieldOfStep = useCallback(() => {
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
      discountRef.current?.focus(); // Start with discount amount field
    }
  }, [step, isB2B]);

  // Focus management based on the current step
  useEffect(() => {
    focusFirstFieldOfStep();
  }, [step, isB2B, isEditing, focusFirstFieldOfStep]);

  // Handle Exit button functionality
  const handleExit = useCallback(() => {
    const confirmExit = window.confirm(
      isPrinted
        ? "Form has been printed. Do you want to exit?"
        : "Are you sure you want to exit without saving or printing?"
    );
    if (confirmExit) {
      resetForm();
      resetState();
    } else {
      dispatch({ type: "SET_WORK_ORDER_FORM", payload: { isPrinted: false } });
    }
  }, [isPrinted, resetForm, resetState, dispatch]);

  // Implement handlePrint using window.print()
  const handlePrint = useCallback(() => {
    window.print();
    dispatch({ type: "SET_WORK_ORDER_FORM", payload: { isPrinted: true } });
    resetForm();
  }, [dispatch, resetForm]);

  // Add a new product entry
  const addNewProductEntry = useCallback(() => {
    dispatch({
      type: "SET_WORK_ORDER_FORM",
      payload: {
        productEntries: [
          ...productEntries,
          { id: "", name: "", price: "", quantity: "", hsn_code: "" },
        ],
      },
    });
    setTimeout(() => {
      document.getElementById(`productId-${productEntries.length}`)?.focus();
    }, 0);
  }, [dispatch, productEntries]);

  // Remove a product entry
  const removeProductEntry = useCallback(
    (index) => {
      const updatedEntries = productEntries.filter((_, i) => i !== index);
      dispatch({
        type: "SET_WORK_ORDER_FORM",
        payload: { productEntries: updatedEntries },
      });

      // Remove corresponding suggestions
      setProductSuggestions((prev) => {
        const updatedSuggestions = { ...prev };
        delete updatedSuggestions[index];
        return updatedSuggestions;
      });
    },
    [dispatch, productEntries]
  );

  // Memoize calculated values (ensure it's declared only once)
  const {
    subtotal = 0,
    discountAmount: validDiscountAmount = 0,
    discountedSubtotal = 0,
    cgst = 0,
    sgst = 0,
    totalAmount = 0,
    totalAmountWithGST = 0,
    discountedTotal = 0,
  } = useMemo(
    () => calculateTotals(productEntries, parseFloat(discount)),
    [productEntries, discount, calculateTotals]
  );

  // Balance calculations
  const advance = parseFloat(advanceDetails) || 0;
  const balanceDue = Math.max(totalAmount - advance, 0);
  // const excessAmount = advance - totalAmount;

  const validateAdvanceAmount = useCallback(() => {
    const advanceAmount = parseFloat(advanceDetails) || 0;
    if (advanceAmount > totalAmount + 1) {
      alert("Advance amount cannot exceed the total amount.");
      return false;
    }
    return true;
  }, [advanceDetails, totalAmount]);

  // Navigate to the next step with validations
  const nextStep = useCallback(() => {
    let errors = {};

    if (step === 1) {
      // Validate Step 1: Product Entries
      productEntries.forEach((product, index) => {
        if (!product.id)
          errors[`productId-${index}`] = "Product ID is required.";
        if (!product.price)
          errors[`productPrice-${index}`] = "Price is required.";
        if (!product.quantity)
          errors[`productQuantity-${index}`] = "Quantity is required.";
      });
    } else if (step === 2) {
      // Validate Step 2: Due Date
      if (!dueDate) errors.dueDate = "Due date is required.";
    } else if (step === 3) {
      // Validate Step 3: MR Number or customer details
      if (hasMrNumber === null) {
        errors.hasMrNumber = "Please indicate if you have an MR Number.";
      } else if (hasMrNumber) {
        if (!mrNumber) errors.mrNumber = "MR Number is required.";
      } else {
        if (!customerName) errors.customerName = "Name is required.";
        if (!customerPhone)
          errors.customerPhone = "Phone number is required.";
        if (!customerAddress)
          errors.customerAddress = "Address is required.";
        if (!customerAge) errors.customerAge = "Age is required.";
        if (customerAge && parseInt(customerAge) < 0)
          errors.customerAge = "Age cannot be negative.";
        if (!customerGender)
          errors.customerGender = "Gender is required.";
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
      // Validate Step 5: Discount Amount, Payment Method, and Advance Details
      if (
        discount &&
        (isNaN(discount) || discount < 0 || parseFloat(discount) > subtotal)
      ) {
        errors.discountAmount =
          "Enter a valid discount amount that does not exceed the subtotal.";
      }
      if (
        discount === subtotal &&
        advanceDetails !== "0" &&
        advanceDetails !== ""
      ) {
        errors.advanceDetails =
          "Advance cannot be collected when discount equals the total amount.";
      }
      if (!paymentMethod) errors.paymentMethod = "Payment method is required.";
      if (!advanceDetails && discount !== subtotal)
        errors.advanceDetails = "Advance details are required.";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Focus on the first error field
      const firstErrorKey = Object.keys(errors)[0];
      if (
        firstErrorKey.startsWith("productId") ||
        firstErrorKey.startsWith("productPrice") ||
        firstErrorKey.startsWith("productQuantity")
      ) {
        const index = firstErrorKey.split("-")[1];
        document.getElementById(firstErrorKey)?.focus();
      } else if (firstErrorKey === "dueDate") {
        dueDateRef.current?.focus();
      } else if (firstErrorKey === "mrNumber") {
        mrNumberRef.current?.focus();
      } else if (firstErrorKey === "gstNumber") {
        gstNumberRef.current?.focus();
      } else if (firstErrorKey === "employee") {
        employeeRef.current?.focus();
      } else if (firstErrorKey === "paymentMethod") {
        paymentMethodRef.current?.focus();
      } else if (firstErrorKey === "advanceDetails") {
        advanceDetailsRef.current?.focus();
      } else if (firstErrorKey === "discountAmount") {
        discountRef.current?.focus();
      } else if (firstErrorKey === "hasMrNumber") {
        yesButtonRef.current?.focus();
      } else if (firstErrorKey === "customerName") {
        customerNameRef.current?.focus();
      } else if (firstErrorKey === "customerPhone") {
        customerPhoneRef.current?.focus();
      } else if (firstErrorKey === "customerAddress") {
        customerAddressRef.current?.focus();
      } else if (firstErrorKey === "customerAge") {
        customerAgeRef.current?.focus();
      } else if (firstErrorKey === "customerGender") {
        customerGenderRef.current?.focus();
      }
      return;
    }

    // Clear errors and proceed to the next step
    setValidationErrors({});
    if (step < 5)
      dispatch({ type: "SET_WORK_ORDER_FORM", payload: { step: step + 1 } });
  }, [
    step,
    productEntries,
    dueDate,
    hasMrNumber,
    mrNumber,
    customerName,
    customerPhone,
    customerAddress,
    customerAge,
    customerGender,
    employee,
    isPinVerified,
    isB2B,
    gstNumber,
    discount,
    subtotal,
    advanceDetails,
    paymentMethod,
    dispatch,
  ]);

  // Save Work Order handler
  const saveWorkOrder = useCallback(async () => {
    if (isSaving) {
      alert("Please wait while the work order is being saved.");
      return;
    }
  
    if (submitted) {
      alert("Work order submitted already");
      return; // Prevent duplicate submissions
    }
  
    dispatch({ type: "SET_WORK_ORDER_FORM", payload: { isSaving: true } });
  
    // Validate advance amount
    if (!validateAdvanceAmount()) {
      dispatch({ type: "SET_WORK_ORDER_FORM", payload: { isSaving: false } });
      return;
    }
  
    // Validation Checks
    const validations = [
      {
        condition: !employee,
        errorKey: "employee",
        message: "Employee selection is required.",
        ref: employeeRef,
      },
      {
        condition: isB2B && !gstNumber,
        errorKey: "gstNumber",
        message: "GST Number is required for B2B orders.",
        ref: gstNumberRef,
      },
      {
        condition:
          discount &&
          (isNaN(discount) || discount < 0 || parseFloat(discount) > subtotal),
        errorKey: "discountAmount",
        message:
          "Enter a valid discount amount that does not exceed the subtotal.",
        ref: discountRef,
      },
      {
        condition:
          discount === subtotal &&
          advanceDetails !== "0" &&
          advanceDetails !== "",
        errorKey: "advanceDetails",
        message:
          "Advance cannot be collected when discount equals the total amount.",
        ref: advanceDetailsRef,
      },
      {
        condition: !paymentMethod,
        errorKey: "paymentMethod",
        message: "Payment method is required.",
        ref: paymentMethodRef,
      },
    ];
  
    for (const validation of validations) {
      if (validation.condition) {
        setValidationErrors((prev) => ({
          ...prev,
          [validation.errorKey]: validation.message,
        }));
        validation.ref?.current?.focus();
        dispatch({ type: "SET_WORK_ORDER_FORM", payload: { isSaving: false } });
        return;
      }
    }
  
    // Validate product entries
    const productErrors = {};
    productEntries.forEach((product, index) => {
      if (!product.id)
        productErrors[`productId-${index}`] = "Product ID is required.";
      if (!product.price)
        productErrors[`productPrice-${index}`] = "Price is required.";
      if (!product.quantity)
        productErrors[`productQuantity-${index}`] = "Quantity is required.";
    });
  
    // Step 3 Validation for MR number or customer details
    if (step === 3) {
      if (hasMrNumber === null) {
        productErrors["hasMrNumber"] =
          "Please indicate if you have an MR Number.";
      } else if (hasMrNumber) {
        if (!mrNumber) productErrors["mrNumber"] = "MR Number is required.";
      } else {
        if (!customerName)
          productErrors["customerName"] = "Name is required.";
        if (!customerPhone)
          productErrors["customerPhone"] = "Phone number is required.";
        if (!customerAddress)
          productErrors["customerAddress"] = "Address is required.";
        if (!customerAge)
          productErrors["customerAge"] = "Age is required.";
        if (customerAge && parseInt(customerAge) < 0)
          productErrors["customerAge"] = "Age cannot be negative.";
        if (!customerGender)
          productErrors["customerGender"] = "Gender is required.";
      }
    }
  
    // Handle Product Validation Errors
    if (Object.keys(productErrors).length > 0) {
      setValidationErrors(productErrors);
      const firstErrorKey = Object.keys(productErrors)[0];
      if (
        firstErrorKey.startsWith("productId") ||
        firstErrorKey.startsWith("productPrice") ||
        firstErrorKey.startsWith("productQuantity")
      ) {
        const index = firstErrorKey.split("-")[1];
        document.getElementById(firstErrorKey)?.focus();
      } else if (firstErrorKey === "dueDate") {
        dueDateRef.current?.focus();
      } else if (firstErrorKey === "mrNumber") {
        mrNumberRef.current?.focus();
      } else if (firstErrorKey === "gstNumber") {
        gstNumberRef.current?.focus();
      } else if (firstErrorKey === "employee") {
        employeeRef.current?.focus();
      } else if (firstErrorKey === "paymentMethod") {
        paymentMethodRef.current?.focus();
      } else if (firstErrorKey === "advanceDetails") {
        advanceDetailsRef.current?.focus();
      } else if (firstErrorKey === "discountAmount") {
        discountRef.current?.focus();
      } else if (firstErrorKey === "hasMrNumber") {
        yesButtonRef.current?.focus();
      } else if (firstErrorKey === "customerName") {
        customerNameRef.current?.focus();
      } else if (firstErrorKey === "customerPhone") {
        customerPhoneRef.current?.focus();
      } else if (firstErrorKey === "customerAddress") {
        customerAddressRef.current?.focus();
      } else if (firstErrorKey === "customerAge") {
        customerAgeRef.current?.focus();
      } else if (firstErrorKey === "customerGender") {
        customerGenderRef.current?.focus();
      }
      dispatch({ type: "SET_WORK_ORDER_FORM", payload: { isSaving: false } });
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
          alert("No valid customer found with the provided MR Number.");
          dispatch({
            type: "SET_WORK_ORDER_FORM",
            payload: { isSaving: false },
          });
          return;
        }
  
        customerId = null; // Assuming patient details are stored separately
      } else {
        // Create new customer
        const { data: newCustomer, error: customerCreationError } = await supabase
          .from("customers")
          .insert({
            name: customerName.trim(),
            phone_number: customerPhone.trim(),
            address: customerAddress.trim(),
            age: parseInt(customerAge, 10),
            gender: customerGender,
          })
          .select("customer_id") // Ensure correct field selection
          .single();
  
        if (customerCreationError) {
          console.error("Error creating customer:", customerCreationError.message);
          alert("Failed to create a new customer.");
          dispatch({
            type: "SET_WORK_ORDER_FORM",
            payload: { isSaving: false },
          });
          return;
        }
  
        customerId = newCustomer?.customer_id;
      }
  
      // Prepare the payload
      let payload = {
        product_entries: productEntries.map((entry) => ({
          product_id: entry.id,
          product_name: entry.name,
          price: parseFloat(entry.price),
          quantity: parseInt(entry.quantity),
          hsn_code: entry.hsn_code,
        })),
        advance_details: advance,
        due_date: dueDate,
        mr_number: hasMrNumber ? mrNumber : null,
        patient_details: hasMrNumber
          ? {
              mr_number: mrNumber.trim(),
              name: patientDetails?.name || "",
              age: patientDetails?.age || "",
              phone_number: patientDetails?.phoneNumber || "",
              gender: patientDetails?.gender || "",
              address: patientDetails?.address || "",
            }
          : {
              name: customerName.trim(),
              phone_number: customerPhone.trim(),
              address: customerAddress.trim(),
              age: parseInt(customerAge, 10),
              gender: customerGender,
            },
        employee: workOrderForm.employee,
        payment_method: paymentMethod,
        subtotal,
        discount_amount: validDiscountAmount,
        discounted_subtotal: discountedSubtotal,
        cgst,
        sgst,
        total_amount: totalAmountWithGST,
        is_b2b: isB2B,
        gst_number: isB2B ? gstNumber : null,
        updated_at: new Date().toISOString(),
        branch: branch,
        customer_id: customerId,
        discounted_total: discountedTotal, // from the computed totals
        amount_due: balanceDue,
      };
  
      if (isEditing) {
        payload.work_order_id = workOrderId;
        const { error } = await supabase
          .from("work_orders")
          .update(payload)
          .eq("work_order_id", workOrderId);
  
        if (error) {
          if (error.status === 409) {
            alert("Work Order ID already exists. Generating a new ID...");
            await generateNewWorkOrderId();
            await saveWorkOrder(); // Retry saving with the new ID
          } else {
            alert("Failed to update work order.");
          }
        } else {
          alert("Work order updated successfully!");
          dispatch({
            type: "SET_WORK_ORDER_FORM",
            payload: { allowPrint: true, submitted: true },
          });
  
          try {
            // Fetch the related modification_request(s)
            const { data: modReqData, error: modReqError } = await supabase
              .from("modification_requests")
              .select("id, status")
              .eq("order_id", workOrderId)
              .eq("order_type", "work_order")
              .in("status", ["approved", "pending"]) // Include 'pending' if applicable
              .order("id", { ascending: false }) // Order by latest first
              .limit(1); // Adjust if multiple modification_requests per work_order
  
            if (modReqError) {
              console.error("Error fetching modification request:", modReqError.message);
              alert("Failed to fetch modification request. Please contact support.");
              // Optionally, proceed without updating modification_request
            } else if (modReqData && modReqData.length > 0) {
              const modificationRequest = modReqData[0];
              console.log(
                "Attempting to update modification_request with ID:",
                modificationRequest.id
              );
  
              // Update the modification_request status to 'completed'
              const { error: modificationError } = await supabase
                .from("modification_requests")
                .update({ status: "completed", updated_at: new Date().toISOString() })
                .eq("id", modificationRequest.id);
  
              if (modificationError) {
                console.error(
                  "Error updating modification request status:",
                  modificationError.message
                );
                alert(
                  "Work order was updated, but failed to update modification request status. Please contact support."
                );
              } else {
                console.log("Modification request status updated to 'completed'.");
                alert("Modification request completed successfully.");
              }
            } else {
              console.log("No pending or approved modification request found for this work order.");
              // Optionally, handle cases where no modification_request exists
            }
          } catch (err) {
            console.error("Unexpected error updating modification request:", err);
            alert(
              "An unexpected error occurred while updating modification request status."
            );
          }
        }
      } else {
        // Ensure workOrderId is set before inserting
        if (!workOrderId) {
          alert("Work Order ID is not generated yet. Please wait.");
          dispatch({
            type: "SET_WORK_ORDER_FORM",
            payload: { isSaving: false },
          });
          return;
        }
        payload.work_order_id = workOrderId;
        payload.created_at = new Date().toISOString();
  
        const { error } = await supabase.from("work_orders").insert(payload);
  
        if (error) {
          if (error.status === 409) {
            alert("Work Order ID already exists. Please try saving again.");
            // Optionally, regenerate Work Order ID
            await generateNewWorkOrderId();
          } else {
            alert("Failed to save work order.");
          }
        } else {
          alert("Work order saved successfully!");
          dispatch({
            type: "SET_WORK_ORDER_FORM",
            payload: { allowPrint: true, submitted: true },
          });
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("An unexpected error occurred while saving the work order.");
    } finally {
      dispatch({ type: "SET_WORK_ORDER_FORM", payload: { isSaving: false } });
    }
  }, [
    isSaving,
    dispatch,
    validateAdvanceAmount,
    employee,
    isB2B,
    submitted,
    gstNumber,
    discount,
    subtotal,
    advanceDetails,
    paymentMethod,
    customerName,
    customerPhone,
    customerAddress,
    customerAge,
    customerGender,
    hasMrNumber,
    mrNumber,
    patientDetails,
    productEntries,
    validDiscountAmount,
    discountedSubtotal,
    cgst,
    sgst,
    totalAmount,
    workOrderId,
    isEditing,
    generateNewWorkOrderId,
    modificationRequestId,
  ]);
  

  // Navigate to the previous step
  const prevStep = useCallback(() => {
    dispatch({
      type: "SET_WORK_ORDER_FORM",
      payload: { step: Math.max(step - 1, 1) },
    });
  }, [dispatch, step]);

  // Handle MR Number search
  const handleMRNumberSearch = useCallback(async () => {
    if (!mrNumber.trim()) {
      alert("Please enter a valid MR Number.");
      mrNumberRef.current?.focus();
      return;
    }
    try {
      const { data, error } = await supabase
        .from("patients") // Correct table for MR number lookup
        .select("id, age, mr_number, phone_number, name, gender, address") // Ensure 'address' is fetched
        .eq("mr_number", mrNumber.trim())
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No data found
          alert("No patient found with the provided MR Number.");
        } else {
          console.error("Error fetching patient details:", error.message);
          alert("Failed to fetch patient details.");
        }
        dispatch({
          type: "SET_WORK_ORDER_FORM",
          payload: { patientDetails: null },
        }); // Clear previous details
        return;
      }

      if (data) {
        dispatch({
          type: "SET_WORK_ORDER_FORM",
          payload: {
            patientDetails: {
              name: data.name,
              age: data.age,
              phoneNumber: data.phone_number,
              gender: data.gender,
              address: data.address,
              mr_number: data.mr_number, // Ensure 'mr_number' is fetched
            },
          },
        });
        // Move focus to the Next button
        setTimeout(() => {
          nextButtonRef.current?.focus();
        }, 0);
      }
    } catch (err) {
      console.error("Unexpected error fetching patient details:", err);
      alert("An unexpected error occurred while fetching patient details.");
      dispatch({
        type: "SET_WORK_ORDER_FORM",
        payload: { patientDetails: null },
      });
    }
  }, [mrNumber, dispatch, nextButtonRef]);

  // Discount field handler
  const handleDiscountInput = useCallback(
    (e) => {
      let value = e.target.value.replace(/^0+/, ""); // Remove leading zeros
      if (!value) value = ""; // Ensure empty string for invalid input
      const numericValue = Math.min(
        Math.max(parseFloat(value) || 0, 0),
        subtotal
      ); // Clamp value between 0 and subtotal
      dispatch({
        type: "SET_WORK_ORDER_FORM",
        payload: { discount: numericValue.toString() },
      });
    },
    [dispatch, subtotal]
  );

  // Handle Enter key for navigation
  const handleEnterKey = useCallback(
    (e, nextFieldRef, action) => {
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
    },
    [nextStep]
  );

  // Fetch existing Work Order details for editing
  const fetchWorkOrderDetails = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
        .eq("work_order_id", orderId)
        .single();

      if (error) {
        console.error("Error fetching work order details:", error.message);
        alert("Failed to fetch work order details.");
        navigate("/home");
      } else {
        // Populate the form with existing data
        const formattedProductEntries = data.product_entries.map((entry) => ({
          id: entry.product_id,
          name: entry.product_name,
          price: entry.price.toString(),
          quantity: entry.quantity.toString(),
          hsn_code: entry.hsn_code,
        }));

        dispatch({
          type: "SET_WORK_ORDER_FORM",
          payload: {
            workOrderId: data.work_order_id,
            productEntries:
              formattedProductEntries.length > 0
                ? formattedProductEntries
                : [{ id: "", name: "", price: "", quantity: "", hsn_code: "" }],
            advanceDetails: data.advance_details || "",
            dueDate: data.due_date || "",
            discount: data.discount_amount
              ? data.discount_amount.toString()
              : "",
            paymentMethod: data.payment_method || "",
            isB2B: data.is_b2b || false,
            gstNumber: data.gst_number || "",
            employee: data.employee || "",
            hasMrNumber: data.mr_number ? true : false,
            modificationRequestId: data.modification_request_id || null,
          },
        });

        if (data.mr_number) {
          // **Handle Existing Patient**
          dispatch({
            type: "SET_WORK_ORDER_FORM",
            payload: { mrNumber: data.mr_number },
          });
          // Fetch patient details based on MR number
          try {
            const { data: patientData, error: patientError } = await supabase
              .from("patients")
              .select("name, age, phone_number, gender, address")
              .eq("mr_number", data.mr_number)
              .single();

            if (patientError) {
              console.error(
                "Error fetching patient details:",
                patientError.message
              );
              dispatch({
                type: "SET_WORK_ORDER_FORM",
                payload: { patientDetails: null },
              });
            } else {
              dispatch({
                type: "SET_WORK_ORDER_FORM",
                payload: {
                  patientDetails: {
                    name: patientData.name,
                    age: patientData.age,
                    phoneNumber: patientData.phone_number,
                    gender: patientData.gender,
                    address: patientData.address,
                    mr_number: data.mr_number,
                  },
                },
              });
            }
          } catch (err) {
            console.error("Unexpected error fetching patient details:", err);
            dispatch({
              type: "SET_WORK_ORDER_FORM",
              payload: { patientDetails: null },
            });
          }
        } else if (data.customer_id) {
          // **Handle Existing Customer**
          const { data: customerData, error: customerError } = await supabase
            .from("customers")
            .select("name, phone_number, address, age, gender")
            .eq("customer_id", data.customer_id)
            .single();

          if (customerError) {
            console.error(
              "Error fetching customer details:",
              customerError.message
            );
            dispatch({
              type: "SET_WORK_ORDER_FORM",
              payload: { customerDetails: null },
            });
          } else {
            dispatch({
              type: "SET_WORK_ORDER_FORM",
              payload: {
                customerName: customerData.name,
                customerPhone: customerData.phone_number,
                customerAddress: customerData.address,
                customerAge: customerData.age
                  ? customerData.age.toString()
                  : "",
                customerGender: customerData.gender || "",
              },
            });
          }
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching work order details:", err);
      alert("An unexpected error occurred while fetching work order details.");
      navigate("/home");
    }
  }, [dispatch, navigate, orderId]);

  // Handle Shift + Enter and Enter key for product entries
  const handleProductEntryShiftEnter = useCallback(
    async (e, index, field) => {
      if (e.key === "Enter") {
        e.preventDefault();

        if (field === "id" || field === "name") {
          // Fetch product details and move focus
          const value = productEntries[index][field];
          const productDetails = await fetchProductDetailsFromSupabase(
            value,
            field
          );

          if (productDetails) {
            dispatch({
              type: "SET_WORK_ORDER_FORM",
              payload: {
                productEntries: productEntries.map((entry, i) =>
                  i === index
                    ? {
                        id: productDetails.product_id,
                        name: productDetails.product_name,
                        price: productDetails.mrp || "",
                        quantity: entry.quantity || "",
                        hsn_code: productDetails.hsn_code || "",
                      }
                    : entry
                ),
              },
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
    },
    [
      productEntries,
      fetchProductDetailsFromSupabase,
      dispatch,
      validateField,
      nextStep,
    ]
  );

  useEffect(() => {
    // Only generate a new Work Order ID if the branch is available
    if (branch && !workOrderForm.isEditing && !workOrderId) {
      generateNewWorkOrderId();
    }
  }, [branch, generateNewWorkOrderId, workOrderForm.isEditing, workOrderId]);

  // Fetch existing work order details if editing
  useEffect(() => {
    if (isEditing) {
      fetchWorkOrderDetails();
    }
  }, [isEditing, fetchWorkOrderDetails]);

  // Handle after print event
  useEffect(() => {
    const handleAfterPrint = () => {
      if (isPrinted) {
        resetForm();
      }
    };

    window.onafterprint = handleAfterPrint;

    return () => {
      window.onafterprint = null; // Cleanup the event listener
    };
  }, [isPrinted, resetForm]);

  return (
    <div
      className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
        } justify-center mt-16 p-4 mx-auto`}
    >
      <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">
        {isEditing ? "Edit Work Order" : "Work Order Generation"}
      </h1>

      {/* Progress Tracker */}
      <div className=" flex items-center mb-8 w-2/3 mx-auto">
        {Array.from({ length: 5 }, (_, i) => (
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
            <label className="block text-gray-700 font-medium mb-4">
              Product Details
            </label>
            <div className="space-y-6">
              {productEntries.map((product, index) => (
                <div key={index} className="flex space-x-2 items-center">
                  {/* Product ID Input */}
                  <div className="relative w-2/4">
                    <input
                      type="text"
                      id={`productId-${index}`}
                      placeholder="Enter Product ID or Scan Barcode"
                      value={product.id}
                      onChange={async (e) => {
                        const value = e.target.value;
                        await handleProductInput(index, value);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && e.shiftKey) {
                          e.preventDefault();
                          addNewProductEntry();
                        } else if (e.key === "Enter") {
                          e.preventDefault();

                          const selectedProduct = productSuggestions[
                            index
                          ]?.find((prod) => prod.product_id === product.id);

                          // Fetch product details if a valid ID is entered or selected
                          if (selectedProduct) {
                            await handleProductSelection(
                              index,
                              selectedProduct.product_id
                            );
                          } else if (product.id) {
                            await handleProductSelection(index, product.id);
                          }
                        }
                      }}
                      onBlur={async () => {
                        const selectedProduct = productSuggestions[index]?.find(
                          (prod) => prod.product_id === product.id
                        );

                        // Fetch product details on blur if a valid ID exists
                        if (selectedProduct || product.id) {
                          await handleProductSelection(index, product.id);
                        }
                      }}
                      list={`productIdSuggestions-${index}`}
                      className={`border border-gray-300 px-4 py-3 rounded-lg w-full ${validationErrors[`productId-${index}`]
                        ? "border-red-500"
                        : ""
                        }`}
                      aria-label={`Product ID input ${index + 1}`}
                    />
                    <datalist id={`productIdSuggestions-${index}`}>
                      {productSuggestions[index]?.map((suggestion) => (
                        <option
                          key={suggestion.product_id}
                          value={suggestion.product_id}
                        />
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
                      aria-label={`Product Name input ${index + 1}`}
                    />
                  </div>

                  {/* Product Price (Read-Only) */}
                  <div className="relative w-1/4">
                    <input
                      type="number"
                      id={`productPrice-${index}`}
                      placeholder="Price"
                      value={product.price}
                      onChange={(e) => {
                        const updatedPrice = e.target.value;
                        dispatch({
                          type: "SET_WORK_ORDER_FORM",
                          payload: {
                            productEntries: productEntries.map((entry, i) =>
                              i === index
                                ? { ...entry, price: updatedPrice }
                                : entry
                            ),
                          },
                        });
                      }}
                      onBlur={() => validateField(index, "price")} // Validate on blur
                      className={`border border-gray-300 px-4 py-3 rounded-lg w-full text-center ${validationErrors[`productPrice-${index}`]
                        ? "border-red-500"
                        : ""
                        }`}
                      aria-label={`Product Price input ${index + 1}`}
                    />
                    {validationErrors[`productPrice-${index}`] && (
                      <p className="text-red-500 text-xs mt-1">
                        {validationErrors[`productPrice-${index}`]}
                      </p>
                    )}
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
                        dispatch({
                          type: "SET_WORK_ORDER_FORM",
                          payload: {
                            productEntries: productEntries.map((entry, i) =>
                              i === index
                                ? { ...entry, quantity: e.target.value }
                                : entry
                            ),
                          },
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
                      onBlur={() => validateField(index, "quantity")}
                      className={`border border-gray-300 px-4 py-3 rounded-lg w-full text-center ${validationErrors[`productQuantity-${index}`]
                        ? "border-red-500"
                        : ""
                        }`}
                      aria-label={`Product Quantity input ${index + 1}`}
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
                aria-label="Add new product entry"
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
                onChange={(e) =>
                  dispatch({
                    type: "SET_WORK_ORDER_FORM",
                    payload: { dueDate: e.target.value },
                  })
                }
                onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
                ref={dueDateRef}
                min={getTodayDate()} // Set minimum date to today
                className={`border border-gray-300 w-full px-10 py-3 rounded-lg text-center appearance-none ${validationErrors.dueDate ? "border-red-500" : ""
                  }`}
                aria-label="Select due date"
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
            <h2 className="text-lg font-semibold text-gray-700">
              Customer Details
            </h2>

            {/* Prompt for MR Number */}
            <div className="flex items-center space-x-4">
              <span className="font-medium text-gray-700">
                Do you have an MR Number?
              </span>
              <button
                type="button"
                onClick={() => {
                  dispatch({
                    type: "SET_WORK_ORDER_FORM",
                    payload: { hasMrNumber: true },
                  });
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
                className={`px-4 py-2 rounded-lg focus:outline-none ${hasMrNumber === true
                  ? "bg-green-600 text-white"
                  : "bg-green-500 text-white hover:bg-green-600"
                  }`}
                aria-pressed={hasMrNumber === true}
                aria-label="Select Yes for MR Number"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({
                    type: "SET_WORK_ORDER_FORM",
                    payload: { hasMrNumber: false },
                  });
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
                className={`px-4 py-2 rounded-lg focus:outline-none ${hasMrNumber === false
                  ? "bg-red-600 text-white"
                  : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                aria-pressed={hasMrNumber === false}
                aria-label="Select No for MR Number"
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
                    placeholder="Enter MR Number of Customer"
                    value={mrNumber}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: {
                          mrNumber: e.target.value,
                          patientDetails: null,
                        },
                      })
                    }
                    onKeyDown={(e) => handleEnterKey(e, fetchButtonRef)}
                    ref={mrNumberRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.mrNumber ? "border-red-500" : ""
                      }`}
                    aria-label="Enter MR Number"
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
                  }}
                  ref={fetchButtonRef}
                  className="mt-2 text-white px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 transition"
                  aria-label="Fetch customer details based on MR Number"
                >
                  Fetch Customer Details
                </button>
                {/* Display Customer Details */}
                {patientDetails && (
                  <div className="mt-4 bg-gray-100 p-4 rounded border border-gray-200">
                    <p>
                      <strong>Name:</strong> {patientDetails.name || "N/A"}
                    </p>
                    <p>
                      <strong>Age:</strong> {patientDetails.age || "N/A"}
                    </p>
                    <p>
                      <strong>Phone Number:</strong>{" "}
                      {patientDetails.phoneNumber || "N/A"}
                    </p>
                    <p>
                      <strong>Gender:</strong> {patientDetails.gender || "N/A"}
                    </p>
                    <p>
                      <strong>Address:</strong>{" "}
                      {patientDetails.address || "N/A"}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Customer Name Input */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Name"
                    value={customerName}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: { customerName: e.target.value },
                      })
                    }
                    onKeyDown={(e) => handleEnterKey(e, customerPhoneRef)}
                    ref={customerNameRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.customerName ? "border-red-500" : ""
                      }`}
                    aria-label="Enter Name"
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
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Phone Number"
                    value={customerPhone}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: { customerPhone: e.target.value },
                      })
                    }
                    onKeyDown={(e) => handleEnterKey(e, customerAddressRef)}
                    ref={customerPhoneRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.customerPhone ? "border-red-500" : ""
                      }`}
                    aria-label="Enter Phone Number"
                  />
                  {validationErrors.customerPhone && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.customerPhone}
                    </p>
                  )}
                </div>
                {/* Customer Address Input */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Address"
                    value={customerAddress}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: { customerAddress: e.target.value },
                      })
                    }
                    onKeyDown={(e) => handleEnterKey(e, customerAgeRef)}
                    ref={customerAddressRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.customerAddress ? "border-red-500" : ""
                      }`}
                    aria-label="Enter Customer Address"
                  />
                  {validationErrors.customerAddress && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.customerAddress}
                    </p>
                  )}
                </div>
                {/* Customer Age Input */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    placeholder="Enter Age"
                    value={customerAge}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: { customerAge: e.target.value },
                      })
                    }
                    onKeyDown={(e) => handleEnterKey(e, customerGenderRef)}
                    ref={customerAgeRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.customerAge ? "border-red-500" : ""
                      }`}
                    aria-label="Enter Age"
                  />
                  {validationErrors.customerAge && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.customerAge}
                    </p>
                  )}
                </div>
                {/* Customer Gender Input */}
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Gender
                  </label>
                  <select
                    value={customerGender}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: { customerGender: e.target.value },
                      })
                    }
                    onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
                    ref={customerGenderRef}
                    className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.customerGender ? "border-red-500" : ""
                      }`}
                    aria-label="Select Gender"
                  >
                    <option value="" disabled>
                      Select Gender
                    </option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {validationErrors.customerGender && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.customerGender}
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
              onChange={(e) =>
                dispatch({
                  type: "SET_WORK_ORDER_FORM",
                  payload: { employee: e.target.value },
                })
              }
              ref={employeeRef}
              onBlur={validateEmployeeSelection}
              className={`border border-gray-300 w-full px-4 py-3 rounded-lg focus:outline-none focus:border-green-500 ${validationErrors.employee ? "border-red-500" : ""
                }`}
              aria-label="Select Employee"
            >
              <option value="" disabled>
                Select Employee
              </option>
              {employees &&
                employees.map((emp, index) => (
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
                  dispatch({
                    type: "SET_WORK_ORDER_FORM",
                    payload: { isPinVerified: isVerified },
                  });
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
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: { isB2B: e.target.checked },
                      });
                      // Reset GST Number when toggling off B2B
                      if (!e.target.checked)
                        dispatch({
                          type: "SET_WORK_ORDER_FORM",
                          payload: { gstNumber: "" },
                        });
                    }}
                    className="sr-only"
                    aria-checked={isB2B}
                    aria-label="Toggle B2B Order"
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
                  onChange={(e) =>
                    dispatch({
                      type: "SET_WORK_ORDER_FORM",
                      payload: { gstNumber: e.target.value },
                    })
                  }
                  onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
                  ref={gstNumberRef}
                  className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.gstNumber ? "border-red-500" : ""
                    }`}
                  aria-label="Enter GST Number"
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
            <div className=" bg-white rounded-lg text-gray-800">
              <div className="printable-area print:mt-20 print:block print:absolute print:inset-0 print:w-full bg-white p-4 print:m-0 print:p-0 w-full">
                {/* Header Information */}
                <div className=" flex justify-between items-center mb-6">
                  <div className="flex items-center">
                    <h2 className="text-3xl font-bold">
                      {isEditing ? "Work Order (Modified)" : "Work Order"}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p>
                      Date: <strong>{formattedDate}</strong>
                    </p>
                    <p>
                      Work Order No:<strong> {workOrderId}</strong>
                    </p>

                    {hasMrNumber && (
                      <>
                        <p>
                          MR Number:<strong> {mrNumber}</strong>
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Customer Details */}
                <div className="mb-6">
                  <p>
                    Name:{" "}
                    <strong>
                      {" "}
                      {hasMrNumber
                        ? `${patientDetails?.name || "N/A"} | ${patientDetails?.age || "N/A"
                        } | ${patientDetails?.gender || "N/A"}`
                        : `${customerName || "N/A"} | ${customerAge || "N/A"
                        } | ${customerGender || "N/A"}`}
                    </strong>
                  </p>
                  <p>
                    Address:
                    <strong>
                      {" "}
                      {hasMrNumber
                        ? patientDetails?.address || "N/A"
                        : customerAddress || "N/A"}
                    </strong>
                  </p>
                  <p>
                    Phone:
                    <strong>
                      {" "}
                      {hasMrNumber
                        ? patientDetails?.phoneNumber || "N/A"
                        : customerPhone || "N/A"}
                    </strong>
                  </p>
                </div>

                {/* Product Table */}
                <table className="w-full border-collapse mb-6">
                  <thead>
                    <tr>
                      <th className="border px-4 py-2">#</th>
                      <th className="border px-4 py-2">Product ID</th>
                      <th className="border px-4 py-2">Product Name</th>
                      <th className="border px-4 py-2">HSN Code</th>
                      <th className="border px-4 py-2">Price</th>
                      <th className="border px-4 py-2">Quantity</th>
                      <th className="border px-4 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productEntries.map((product, index) => {
                      const adjustedPrice = parseFloat(product.price) || 0;
                      const adjustedSubtotal =
                        adjustedPrice * (parseInt(product.quantity) || 0);
                      return (
                        <tr key={index}>
                          <td className="border px-4 py-2 text-center">
                            {index + 1}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            {product.id || "N/A"}
                          </td>
                          <td className="border px-4 py-2">
                            {product.name || "N/A"}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            {product.hsn_code || "N/A"}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            ₹{adjustedPrice.toFixed(2)}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            {product.quantity || "N/A"}
                          </td>
                          <td className="border px-4 py-2 text-center">
                            ₹{adjustedSubtotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Financial Summary */}
                <div className="flex justify-between mb-6 space-x-8">
                  <div>
                    <p>
                      Amt. after discount:<strong> ₹{subtotal.toFixed(2)}</strong>
                    </p>

                    {/* <p>
                      Discounted Subtotal:
                      <strong> ₹{discountedSubtotal.toFixed(2)}</strong>
                    </p> */}

                    <p>
                      CGST (6%):<strong> ₹{cgst.toFixed(2)}</strong>
                    </p>
                    <p>
                      SGST (6%):<strong> ₹{sgst.toFixed(2)}</strong>
                    </p>
                    <p>
                      Payment Method:
                      <strong>
                        {" "}
                        {paymentMethod.charAt(0).toUpperCase() +
                          paymentMethod.slice(1)}
                      </strong>
                    </p>
                  </div>
                  <div className="text-right">
                    {/* <p>
                      Total Amount (Incl. GST):
                      <strong> ₹{totalAmountWithGST.toFixed(2)}</strong>
                    </p> */}
                    {/* <p>
                      Discount Amount:
                      <strong> ₹{validDiscountAmount.toFixed(2)}</strong>
                    </p> */}

                    <p>
                      Advance Paid:<strong> ₹{advance.toFixed(2)}</strong>
                    </p>
                    <p className="text-xl">
                      <strong>Total Amount (Incl. GST):{" "}
                        ₹{discountedTotal.toFixed(2)}</strong>
                    </p>
                    <p className="text-xl">
                      <strong>Amount Due: ₹{balanceDue.toFixed(2)}</strong>
                    </p>

                    {/* <p className="text-red-500">
                        Advance paid exceeds the total amount by ₹{excessAmount.toFixed(2)}.
                      </p> */}

                    <div className="mt-10 space-x-8">
                      <p>
                        Billed by:<strong> {employee || "N/A"}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="print:hidden flex flex-col md:flex-row items-center justify-between my-6 space-x-4">
                  {/* Discount Input Field */}
                  <div className="w-full print:w-1/3 mb-4 md:mb-0">
                    <label
                      htmlFor="discount"
                      className="block font-semibold mb-1"
                    >
                      Discount:
                    </label>
                    <input
                      type="number"
                      id="discount"
                      placeholder="Enter discount Amount"
                      value={discount || ""}
                      onChange={handleDiscountInput}
                      onKeyDown={(e) => handleEnterKey(e, paymentMethodRef)}
                      ref={discountRef}
                      className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.discount ? "border-red-500" : ""
                        }`}
                      aria-label="Enter Discount Amount"
                    />
                    {validationErrors.discount && (
                      <p className="text-red-500 text-xs mt-1">
                        {validationErrors.discount}
                      </p>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="w-full print:w-1/3 mb-4 md:mb-0">
                    <label
                      htmlFor="paymentMethod"
                      className="block font-semibold mb-1"
                    >
                      Payment Method:
                    </label>
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_WORK_ORDER_FORM",
                          payload: { paymentMethod: e.target.value },
                        })
                      }
                      ref={paymentMethodRef}
                      onKeyDown={(e) => handleEnterKey(e, advanceDetailsRef)}
                      className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.paymentMethod ? "border-red-500" : ""
                        }`}
                      aria-label="Select Payment Method"
                    >
                      <option value="" disabled>
                        Select Payment Method
                      </option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="online">UPI (Paytm/PhonePe/GPay)</option>
                    </select>

                    {validationErrors.paymentMethod && (
                      <p className="text-red-500 text-xs mt-1">
                        {validationErrors.paymentMethod}
                      </p>
                    )}
                  </div>

                  {/* Advance Details */}
                  <div className="w-full print:w-1/3 mb-4 md:mb-0">
                    <label
                      htmlFor="advanceDetails"
                      className="block font-semibold mb-1"
                    >
                      Advance Paying:
                    </label>
                    <input
                      type="number"
                      id="advanceDetails"
                      placeholder="Enter amount paid in advance"
                      value={advanceDetails}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_WORK_ORDER_FORM",
                          payload: { advanceDetails: e.target.value },
                        })
                      }
                      onKeyDown={(e) => handleEnterKey(e, saveButtonRef)}
                      ref={advanceDetailsRef}
                      className={`border border-gray-300 w-full px-4 py-3 rounded-lg ${validationErrors.advanceDetails ? "border-red-500" : ""
                        }`}
                      aria-label="Enter Advance Amount"
                    />

                    {validationErrors.advanceDetails && (
                      <p className="text-red-500 text-xs mt-1">
                        {validationErrors.advanceDetails}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Section */}
                <div className="flex-col justify-start mx-auto items-start text-left text-md">
                  <p className="mt-2 text-md">
                    Delivery On:<strong> {dueDate ? formatDate(dueDate) : "N/A"}</strong>
                  </p>

                  {isB2B && (
                    <p>
                      <strong>GST Number of work assigning:</strong>{" "}
                      {gstNumber || "N/A"}
                    </p>
                  )}
                  <p className="mt-2 text-xs">
                    Terms and Conditions:
                    <ol className="list-decimal list-inside">
                      <li>Work order valid only for two months.</li>
                      <li>
                        Branded Frames/Lenses – 12 Months warranty for
                        manufacturing defects/peeling off.
                      </li>
                    </ol>
                  </p>
                </div>
              </div>
            </div>

            {/* Save Work Order and Print Buttons */}
            <div className="flex justify-center text-center space-x-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  if (!isSaving && !submitted) saveWorkOrder();
                }}
                ref={saveButtonRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();

                    if (!isSaving) {
                      saveWorkOrder();
                      setTimeout(() => {
                        printButtonRef.current?.focus();
                      }, 100);
                    }
                  }
                }}
                className="flex items-center justify-center w-44 h-12 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                disabled={isSaving || submitted}
                aria-label="Save Work Order"
              >
                {isSaving
                  ? "Saving..."
                  : submitted
                    ? "Order Submitted"
                    : "Save Work Order"}
              </button>

              {allowPrint && (
                <button
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "SET_WORK_ORDER_FORM",
                      payload: { isPrinted: true },
                    });
                    handlePrint();
                  }}
                  ref={printButtonRef}
                  className="flex items-center justify-center w-44 h-12 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                  aria-label="Print Work Order"
                >
                  <PrinterIcon className="w-5 h-5 mr-2" />
                  Print
                </button>
              )}

              {/* Exit Button */}
              {allowPrint && (
                <button
                  type="button"
                  onClick={handleExit}
                  className="flex items-center justify-center w-44 h-12 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                  aria-label="Exit Work Order Generation"
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
              aria-label="Previous Step"
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
              aria-label="Next Step"
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

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
const getCurrentISTTime = () => {
  const now = new Date();
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  };
  return now.toLocaleTimeString('en-IN', options);
};

const WorkOrderGeneration = ({ isCollapsed }) => {

  const verifyProductId = useCallback(async (productId) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .single();

      if (error) {
        console.error('Supabase error:', error);
        return false;
      }

      return data !== null;
    } catch (err) {
      console.error('Error verifying product:', err);
      return false;
    }
  }, []);

  const { branch, subRole, role } = useAuth();
  // console.log("Branch in WorkOrderGeneration:", branch);
  console.log("SubRole in WorkOrderGeneration:", subRole);
  console.log("Branch:", branch);


  const { orderId } = useParams(); // Get orderId from route params
  const isEditing = Boolean(orderId);

  const { state, dispatch } = useGlobalState();
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
    is_insurance,
    insuranceName,
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

  useEffect(() => {
    // Only reset the form if we're starting a new work order
    // (not editing and no existing work order data)
    if (!isEditing && !workOrderId) {
      // Check if there's saved state in sessionStorage
      const savedState = sessionStorage.getItem('workOrderFormState');
      if (savedState) {
        try {
          // Restore the saved state
          const parsedState = JSON.parse(savedState);
          dispatch({
            type: 'RESTORE_WORK_ORDER_FORM',
            payload: parsedState
          });
        } catch (err) {
          console.error('Error restoring saved work order state:', err);
          // Reset only if restoration fails
          dispatch({ type: 'RESET_WORK_ORDER_FORM' });
        }
      }
    }

    // Remove the reset on unmount
    return () => {
      // Save current state to sessionStorage when unmounting
      sessionStorage.setItem(
        'workOrderFormState',
        JSON.stringify(workOrderForm)
      );
    };
  }, []);

  // Add this effect to clear storage after successful submission
  useEffect(() => {
    if (submitted && isPrinted) {
      // Clear saved state after successful completion
      sessionStorage.removeItem('workOrderFormState');
    }
  }, [submitted, isPrinted]);


  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [consultantName, setConsultantName] = useState('');
  const [consultantList, setConsultantList] = useState([

  ]);
  useEffect(() => {
    // Base consultant list for all branches
    const baseConsultants = [
      "Dr. Ashad Sivaraman",
      "Dr. Harshali Yadav",
      "Dr. Swapna Nair",
      "Dr. Anoop Sivaraman",
      "Dr. Anila George",
      "Dr. Arvin Ponnat",
      "Dr. Shabna",
      "Dr. Malavika. G",
      "Dr.Yasar Safar",

    ];

    // Additional consultants for Kottarakara branch
    const kottarakaraConsultants = [
      "Dr. Pinki",
      "Dr. Anuprabha",
      "Dr. Shihail Jinna",
      "Dr. Rajalekshmi",
      "Dr. Anupama Sreevalsan",
      "Dr. Devendra Maheswari",
      "Dr. Renjith Nathan"
    ];

    // Additional consultants for Trivandrum branch
    const trivandrumConsultants = [
      "Dr. Sandton"
    ];

    // Set appropriate consultant list based on branch
    if ((branch === "KOT2") || (branch === "KOT1")) {
      setConsultantList([...baseConsultants, ...kottarakaraConsultants]);
    } else if (branch === "TVR") {
      setConsultantList([...baseConsultants, ...trivandrumConsultants]);
    } else {
      setConsultantList(baseConsultants);
    }
  }, [branch]);

  const [useManualConsultant, setUseManualConsultant] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentISTTime());

  // Add this useEffect to update the time when the invoice is shown (step 3 for consulting)
  useEffect(() => {
    if (step === 3) {
      const timer = setInterval(() => {
        setCurrentTime(getCurrentISTTime());
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [step]);


  const fetchConsultants = useCallback(async () => {
    try {
      // const { data, error } = await supabase
      //   .from('consultants')
      //   .select('*');
      // if (error) throw error;
      // setConsultantList(data || []);
      console.log('fetching ');


    } catch (err) {
      console.error('Error fetching consultants:', err);
    }
  }, []);


  // Fetch consultants on mount
  useEffect(() => {
    fetchConsultants();
  }, [fetchConsultants]);
  const InsuranceModal = ({ isOpen, onClose, onSubmit }) => {
    const [name, setName] = useState('');

    return (
      isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Enter Insurance Details</h3>
            <input
              type="text"
              placeholder="Enter Insurance Provider Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSubmit(name);
                  onClose();
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )
    );
  };

  // Initialize productSuggestions as an object for per-product index suggestions
  const [productSuggestions, setProductSuggestions] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  // Refs
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



  const generateNewWorkOrderId = useCallback(async () => {
    try {
      console.log("Attempting to generate new Work Order ID...");

      if (!branch) {
        console.error("Branch is undefined. Cannot generate Work Order ID.");
        alert("Branch information is missing. Please try again.");
        return;
      }

      // Call the database function to get the next ID atomically
      const { data: nextId, error } = await supabase.rpc('get_next_work_order_id', {
        branch_code: branch,
        role_code: subRole  // This can be null
      });

      if (error) {
        console.error("Error generating Work Order ID:", error);
        alert("Error generating Work Order ID. Please try again.");
        return;
      }

      console.log("Database returned next ID:", nextId);

      // Determine the OP Number based on subRole
      let opNumber = "01";
      if (subRole) {
        const subRoleParts = subRole.split(" ");
        opNumber = subRoleParts.length > 1 ? subRoleParts[1] : "01";
      }

      // Format the work order ID based on role
      let newWorkOrderId;
      if (role && role.includes("opd")) {
        newWorkOrderId = `OPW-${opNumber}-${String(nextId).padStart(3, "0")}`;
      } else {
        newWorkOrderId = `CR-${opNumber}-${String(nextId).padStart(3, "0")}`;
      }

      console.log("Final Generated Work Order ID:", newWorkOrderId);

      dispatch({
        type: "SET_WORK_ORDER_FORM",
        payload: { workOrderId: newWorkOrderId.toString() },
      });
    } catch (error) {
      console.error("Error generating Work Order ID:", error);
      alert("An unexpected error occurred while generating Work Order ID.");
    }
  }, [dispatch, branch, subRole, role]);
  // Fetch employees from the Supabase `employees` table
  const fetchEmployees = useCallback(async () => {
    try {
      let query = supabase
        .from('employees')  // Returns a query builder
        .select('*');       // Keep chaining, do not destructure yet

      // Add conditions
      query = query.eq('branch', branch);

      if (role === 'opd') {
        query = query.eq('role', 'opd');
      } else if (role === 'counselling') {
        query = query.eq('role', 'counselling');
      }

      const { data, error } = await query;

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
    async (index, value, field) => {
      if (field === "id" && !value.trim()) {
        dispatch({
          type: "RESET_PRODUCT_FIELDS",
          payload: { index }
        });
        return;
      }
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
      }
      else {
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
  // const calculateTotals = useCallback((entries, discountAmt) => {
  //   // Initialize variables
  //   let subtotal = 0;
  //   let validDiscountAmount = 0;
  //   let discountedSubtotal = 0;
  //   let cgst = 0;
  //   let sgst = 0;
  //   let totalAmount = 0;
  //   let totalAmountWithGST = 0;
  //   let discountedTotal = 0;

  //   // Calculate subtotal (price excluding GST)
  //   subtotal = entries.reduce((total, product) => {
  //     const price = parseFloat(product.price) || 0; // MRP including GST
  //     const quantity = parseInt(product.quantity) || 0;
  //     const basePrice = price / 1.12; // Adjusted price excluding GST
  //     return total + basePrice * quantity;
  //   }, 0);

  //   // Calculate total amount including GST (price * quantity)
  //   totalAmountWithGST = entries.reduce((total, product) => {
  //     const price = parseFloat(product.price) || 0; // MRP including GST
  //     const quantity = parseInt(product.quantity) || 0;
  //     return total + price * quantity;
  //   }, 0);

  //   // Apply discount
  //   validDiscountAmount = Math.min(discountAmt || 0, subtotal);
  //   discountedSubtotal = Math.max(
  //     (subtotal * 1.12 - validDiscountAmount) / 1.12,
  //     0
  //   ); // Prevent negative subtotal

  //   // Calculate GST amounts
  //   cgst = discountedSubtotal * 0.06;
  //   sgst = discountedSubtotal * 0.06;

  //   // Calculate total amount including GST
  //   totalAmount = discountedSubtotal + cgst + sgst;

  //   discountedTotal = totalAmountWithGST - validDiscountAmount;

  //   return {
  //     subtotal,
  //     discountAmount: validDiscountAmount,
  //     discountedSubtotal,
  //     cgst,
  //     sgst,
  //     totalAmount,
  //     totalAmountWithGST,
  //     discountedTotal,
  //   };
  // }, []);

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
    totalAmountWithGST = entries.reduce((total, product) => {
      const price = parseFloat(product.price) || 0; // MRP including GST
      const quantity = parseInt(product.quantity) || 0;
      return total + price * quantity;
    }, 0);

    // Handle full discount case
    if (parseFloat(discountAmt) >= totalAmountWithGST) {
      return {
        subtotal: totalAmountWithGST,
        discountAmount: totalAmountWithGST,
        discountedSubtotal: 0,
        cgst: 0,
        sgst: 0,
        totalAmount: 0,
        totalAmountWithGST,
        discountedTotal: 0
      };
    }

    // Normal discount case
    subtotal = entries.reduce((total, product) => {
      const price = parseFloat(product.price) || 0;
      const quantity = parseInt(product.quantity) || 0;
      const basePrice = price / 1.12; // Adjusted price excluding GST
      return total + basePrice * quantity;
    }, 0);

    validDiscountAmount = Math.min(discountAmt || 0, totalAmountWithGST);
    discountedSubtotal = Math.max((subtotal * 1.12 - validDiscountAmount) / 1.12, 0);

    cgst = discountedSubtotal * 0.06;
    sgst = discountedSubtotal * 0.06;

    totalAmount = discountedSubtotal + cgst + sgst;
    discountedTotal = Math.max(totalAmountWithGST - validDiscountAmount, 0);

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
    if (step === 2) {
      document.getElementById(`productId-0`)?.focus();
    }
    // if (step === 2) {
    //   dueDateRef.current?.focus();
    // }
    if (step === 1) {
      // Focus on the "Yes" button initially
      yesButtonRef.current?.focus();
    }
    if (step === 3) {
      if (isB2B) gstNumberRef.current?.focus();
      else employeeRef.current?.focus();
    }
    if (step === 4) {
      discountRef.current?.focus(); // Start with discount amount field
    }
  }, [step, isB2B]);

  // Focus management based on the current step
  useEffect(() => {
    focusFirstFieldOfStep();
  }, [step, isB2B, isEditing, focusFirstFieldOfStep]);

  // Handle Exit button functionality
  const handleExit = useCallback(() => {
    if (isPrinted) {
      // Reset form state using dispatch
      dispatch({ type: 'RESET_WORK_ORDER_FORM' });
      resetForm();
      navigate('/home');
    } else {
      const confirmed = window.confirm('Are you sure you want to exit without printing?');
      if (confirmed) {
        dispatch({ type: 'RESET_WORK_ORDER_FORM' });
        resetForm();
        navigate('/home');
      }
    }
  }, [isPrinted, resetForm, dispatch, navigate]);

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

  const getCurrentISTDateTime = () => {
    const now = new Date();
    // Add IST offset (UTC+5:30)
    return new Date(now.getTime() + (5.5 * 60 * 60 * 1000)).toISOString();
  };

  // Navigate to the next step with validations
  const nextStep = useCallback(async () => {
    let errors = {};

    if (step === 2) {
      for (const [index, product] of productEntries.entries()) {
        if (!product.id) {
          errors[`productId-${index}`] = "Product ID is required.";
          continue;
        }

        try {
          const { data, error } = await supabase
            .from('products')
            .select('product_id')
            .eq('product_id', product.id)
            .single();

          console.log("Product verification response:", { data, error }); // Debug log

          if (error || !data) {
            alert(`Product ID ${product.id} not found . Add product from Purchase section.`);
            navigate('/employee-stock-management');
            return;
          }
        } catch (err) {
          console.error('Error verifying product:', err);
          alert(`Error verifying product ${product.id}. Please try again.`);
          return;
        }
      }

    } else if (step === 1) {
      // Validate Step 2: MR Number or customer details
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
    } else if (step === 3) {
      if (!employee) {
        errors.employee = "Employee selection is required.";
      } else if (!isPinVerified) {
        errors.employeeVerification = "Employee must be verified to proceed.";
      }
      if (isB2B && !gstNumber) {
        errors.gstNumber = "GST Number is required for B2B orders.";
      }
    } else if (step === 4) {
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
    if (step < 4)
      dispatch({ type: "SET_WORK_ORDER_FORM", payload: { step: step + 1 } });
  }, [
    step,
    productEntries,
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
    verifyProductId,
    navigate,
    // dispatch
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
    if (step === 1) {
      if (hasMrNumber === null) {
        productErrors["hasMrNumber"] =
          "Please indicate if you have an MR Number.";
      } else if (hasMrNumber) {
        if (!mrNumber) productErrors["mrNumber"] = "MR Number is required.";
      } else {
        // If MR No is false, throw an error
        alert("Cannot proceed, please contact reception.");
        dispatch({ type: "SET_WORK_ORDER_FORM", payload: { isSaving: false } });
        return;
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
          .select("*")
          .eq("mr_number", mrNumber.trim())
          .single();

        // console.log(customerId);
        customerId = existingCustomer.customer_id;

        if (customerError) {
          alert("No valid customer found with the provided MR Number.");
          dispatch({
            type: "SET_WORK_ORDER_FORM",
            payload: { isSaving: false },
          });
          return;
        }

        // customerId = null; // Assuming patient details are stored separately
      } else {
        window.alert(
          "Customer does not have an MR number. Contact to Reception "
        );
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
        consultant_name: consultantName,
        discounted_subtotal: discountedSubtotal,
        cgst,
        sgst,
        total_amount: totalAmountWithGST,
        is_b2b: isB2B,
        is_insurance: subRole.includes("Counselling") ? workOrderForm.isInsurance : null,
        insurance_name: insuranceName,
        gst_number: isB2B ? gstNumber : null,
        customer_id: customerId,

        updated_at: new Date().toISOString(),
        branch: branch,
        // customer_id: customerId,
        discounted_total: discountedTotal, // from the computed totals
        amount_due: balanceDue,
        sub_role: subRole,
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
        payload.created_at = getCurrentISTDateTime();

        const { error } = await supabase.from("work_orders").insert(payload);

        if (error) {
          if (error.status === 409) {
            alert("Work Order ID already exists. Please try saving again.");
            // Optionally, regenerate Work Order ID
            await generateNewWorkOrderId();
          } else {
            alert("Failed to save work order.");
            console.log(error);

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
    subRole,
    consultantName,
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
      const numericValue = Math.max(parseFloat(value) || 0, 0);
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
    if (!workOrderId && !workOrderForm.isEditing) {
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
        {Array.from({ length: 3 }, (_, i) => (
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
        {step === 2 && (
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


        {/* Step 2: MR Number or Customer Details */}
        {step === 1 && (
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
                  alert("Cannot proceed without MR number. Please contact reception to create new customer.");
                  dispatch({
                    type: "SET_WORK_ORDER_FORM",
                    payload: { hasMrNumber: null },
                  });
                  setTimeout(() => {
                    yesButtonRef.current?.focus();
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
              <div className="flex flex-col items-center justify-center p-8 bg-red-50 border-2 border-red-200 rounded-lg mt-4">
                <div className="text-red-600 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-red-700 mb-2">MR Number Required</h3>
                <div className="text-center mb-6">
                  <p className="text-gray-700 text-lg mb-2">
                    New customer registration can only be done at reception.
                  </p>
                  <p className="text-gray-600">
                    Please direct the customer to reception desk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "SET_WORK_ORDER_FORM",
                      payload: { hasMrNumber: null }
                    });
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Employee Selection, B2B Toggle, and GST Number if B2B */}
        {step === 3 && (
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


            {subRole?.includes("Counselling") ? (
              // Insurance Section for Counselling
              <div className="space-y-4 mt-6">
                <div className="flex items-center space-x-4">
                  <span className="font-medium">Is Insurance?</span>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: { isInsurance: true }
                      });
                      setShowInsuranceModal(true);
                    }}
                    className={`px-4 py-2 rounded-lg ${workOrderForm.isInsurance
                      ? "bg-green-600 text-white"
                      : "bg-green-100 text-green-600"
                      }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: {
                          isInsurance: false,
                          insuranceName: ''
                        }
                      });
                    }}
                    className={`px-4 py-2 rounded-lg ${workOrderForm.isInsurance === false
                      ? "bg-red-600 text-white"
                      : "bg-red-100 text-red-600"
                      }`}
                  >
                    No
                  </button>
                </div>

                {workOrderForm.isInsurance && workOrderForm.insuranceName && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">Insurance Provider:</span> {workOrderForm.insuranceName}
                    </p>
                  </div>
                )}

                <InsuranceModal
                  isOpen={showInsuranceModal}
                  onClose={() => setShowInsuranceModal(false)}
                  onSubmit={(name) => {
                    dispatch({
                      type: "SET_WORK_ORDER_FORM",
                      payload: { insuranceName: name }
                    });
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4 mt-6">
                <div className="flex items-center space-x-4">
                  <span className="font-medium">B2B Customer?</span>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: { isB2B: true }
                      });
                    }}
                    className={`px-4 py-2 rounded-lg ${isB2B ? "bg-green-600 text-white" : "bg-green-100 text-green-600"
                      }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({
                        type: "SET_WORK_ORDER_FORM",
                        payload: {
                          isB2B: false,
                          gstNumber: ''
                        }
                      });
                    }}
                    className={`px-4 py-2 rounded-lg ${isB2B === false ? "bg-red-600 text-white" : "bg-red-100 text-red-600"
                      }`}
                  >
                    No
                  </button>
                </div>

                {isB2B && (
                  <div className="mt-4">
                    <input
                      type="text"
                      ref={gstNumberRef}
                      placeholder="Enter GST Number"
                      value={gstNumber}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_WORK_ORDER_FORM",
                          payload: { gstNumber: e.target.value }
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                )}
              </div>
            )}


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
        {step === 4 && (
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
                      Time:<strong> {currentTime}</strong>
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
                  <label>Consultant:</label>
                  {!useManualConsultant && (
                    <select
                      value={consultantName}
                      onChange={(e) => setConsultantName(e.target.value)}
                    >
                      <option value="">Select Consultant</option>
                      {consultantList.map((consultant, idx) => (
                        <option key={idx} value={consultant}>
                          {consultant}
                        </option>
                      ))}
                    </select>
                  )}
                  {/* Checkbox to switch between dropdown and manual input */}
                  <div>
                    <label>
                      <input
                        type="checkbox"
                        checked={useManualConsultant}
                        onChange={(e) => {
                          setUseManualConsultant(e.target.checked);
                          if (!e.target.checked) {
                            setConsultantName("");
                          }
                        }}
                      />
                      Enter Manually
                    </label>
                  </div>
                  {/* Manually input consultant name if checkbox selected */}
                  {useManualConsultant && (
                    <input
                      type="text"
                      placeholder="Enter consultant name"
                      value={consultantName}
                      onChange={(e) => setConsultantName(e.target.value)}
                    />
                  )}
                </div>

                {/* Product Table */}
                <table className="w-full border-collapse mb-6">
                  <thead>
                    <tr>
                      <th className="border px-4 py-2">No.</th>
                      {/* <th className="border px-4 py-2">Product ID</th> */}
                      <th className="border px-4 py-2">Service Name</th>
                      {/* <th className="border px-4 py-2">Price</th> */}
                      {/* <th className="border px-4 py-2">Quantity</th> */}
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
                          {/* <td className="border px-4 py-2 text-center">
                            {product.id || "N/A"}
                          </td> */}
                          <td className="border px-4 py-2">
                            {product.name || "N/A"}
                          </td>

                          {/* <td className="border px-4 py-2 text-center">
                            ₹{adjustedPrice.toFixed(2)}
                          </td> */}
                          {/* <td className="border px-4 py-2 text-center">
                            {product.quantity || "N/A"}
                          </td> */}
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
                    {/* <p>
                      Amt. after discount:<strong> ₹{subtotal.toFixed(2)}</strong>
                    </p> */}

                    {/* <p>
                      Amt. after discount:
                      <strong> ₹{discountedSubtotal.toFixed(2)}</strong>
                    </p> */}

                    {/* <p>
                      CGST (6%):<strong> ₹{cgst.toFixed(2)}</strong>
                    </p>
                    <p>
                      SGST (6%):<strong> ₹{sgst.toFixed(2)}</strong>
                    </p> */}
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

                    {/* <p>
                      Advance Paid:<strong> ₹{advance.toFixed(2)}</strong>
                    </p> */}
                    <p className="text-xl">
                      <strong>Sub total :{" "}
                        ₹{discountedTotal.toFixed(2)}</strong>
                    </p>
                    <p className="text-xl">
                      <strong>Total Amt.: ₹{balanceDue.toFixed(2)}</strong>
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

                  {isB2B && (
                    <p>
                      <strong>GST Number of work assigning:</strong>{" "}
                      {gstNumber || "N/A"}
                    </p>
                  )}
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

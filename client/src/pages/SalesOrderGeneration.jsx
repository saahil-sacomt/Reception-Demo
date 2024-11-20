// client/src/pages/SalesOrderGeneration.jsx
import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { PrinterIcon, TrashIcon } from "@heroicons/react/24/outline";
import supabase from "../supabaseClient";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deductStockForMultipleProducts } from '../services/authService.js';
import EmployeeVerification from "../components/EmployeeVerification";
import { useModificationContext } from "../context/ModificationContext";
import logo from '../assets/sreenethraenglishisolated.png';



// Utility Functions
const mockOtp = "1234";
const convertUTCToIST = (utcDate) => {
  const date = new Date(utcDate);
  const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return istDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
};

const getCurrentUTCDateTime = () => {
  return new Date().toISOString();
};

// Function to fetch privilege card by phone number
const fetchPrivilegeCardByPhone = async (phone) => {
  const { data, error } = await supabase
    .from("privilegecards")
    .select("*")
    .eq("phone_number", phone)
    .single();

  if (error) {
    return null;
  }
  return data;
};
function calculateAmounts(
  productEntries,
  advanceDetails,
  privilegeCard,
  privilegeCardDetails,
  redeemPointsAmount,
  loyaltyPoints,
  selectedWorkOrder
) {
  const subtotal = productEntries.reduce((acc, product) => {
    const price = parseFloat(product.price) || 0;
    const quantity = parseInt(product.quantity) || 0;
    return acc + price * quantity;
  }, 0);

  // Calculate CGST and SGST for display only
  const cgstAmount = subtotal * 0.06;
  const sgstAmount = subtotal * 0.06;

  // Calculate remaining balance after advance
  const remainingBalance = subtotal - (parseFloat(advanceDetails) || 0);

  // Calculate discount if applicable
  let discount = 0;
  if (privilegeCard && privilegeCardDetails && redeemPointsAmount > 0) {
    const redeemAmount = parseFloat(redeemPointsAmount) || 0;
    discount = Math.min(redeemAmount, loyaltyPoints, remainingBalance);
  }

  // Calculate final amount payable
  const finalAmount = Math.max(remainingBalance - discount, 0);

  return {
    subtotal,
    cgstAmount, // For display only
    sgstAmount, // For display only
    remainingBalance,
    discount,
    finalAmount,
  };
}

// Function to calculate loyalty points
const calculateLoyaltyPoints = (
  subtotal,
  redeemPointsAmount,
  privilegeCard,
  privilegeCardDetails,
  currentLoyaltyPoints
) => {
  let pointsToRedeem = 0;
  if (privilegeCard && privilegeCardDetails) {
    pointsToRedeem = Math.min(
      parseFloat(redeemPointsAmount) || 0,
      currentLoyaltyPoints
    );
  }

  let updatedPoints = currentLoyaltyPoints - pointsToRedeem;

  const pointsToAdd = Math.floor(subtotal * 0.05);

  updatedPoints += pointsToAdd;

  return { updatedPoints, pointsToRedeem, pointsToAdd };
};

// Main Component
const SalesOrderGeneration = memo(({ isCollapsed, onModificationSuccess }) => {
  const { user, role, name, branch, loading: authLoading } = useAuth(); // Destructure branch from AuthContext

  const [step, setStep] = useState(0); // Adjusted step numbering
  const [salesOrderId, setSalesOrderId] = useState("");
  const [productEntries, setProductEntries] = useState([
    { id: "", name: "", price: "", quantity: "" },
  ]);

  const [patientDetails, setPatientDetails] = useState(null);
  const [privilegeCard, setPrivilegeCard] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [employee, setEmployee] = useState("");
  const [employees] = useState(["John Doe", "Jane Smith", "Alex Brown"]);
  const [allowPrint, setAllowPrint] = useState(false);
  const [advanceDetails, setAdvanceDetails] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [privilegeCardNumber, setPrivilegeCardNumber] = useState("");
  const privilegeCardRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isOtpSent, setIsOtpSent] = useState(false);
  const [privilegeCardDetails, setPrivilegeCardDetails] = useState(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [redeemPointsAmount, setRedeemPointsAmount] = useState(""); // New state for custom redemption amount
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [mrNumber, setMrNumber] = useState("");
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [pointsToAdd, setPointsToAdd] = useState(0);
  const [redeemOption, setRedeemOption] = useState(null); // 'barcode', 'phone', 'full', 'custom', or null
  const [searchQuery, setSearchQuery] = useState("");
  const [isGeneratingId, setIsGeneratingId] = useState(false);
  const [fetchTriggered, setFetchTriggered] = useState(false);
  // To handle loading state

  // Refs for input fields to control focus
  const mrNumberRef = useRef(null);
  const privilegePhoneRef = useRef(null);
  const otpRef = useRef(null);
  const employeeRef = useRef(null);
  const nextButtonRef = useRef(null);
  const paymentMethodRef = useRef(null);
  const redeemPointsAmountRef = useRef(null);
  const proceedButtonRef = useRef(null);
  const saveOrderRef = useRef(null);
  const printButtonRef = useRef(null);
  const newWorkOrderButtonRef = useRef(null);
  const quantityRefs = useRef([]);
  const workOrderInputRef = useRef(null);
  const firstWorkOrderButtonRef = useRef(null);
  const fetchButtonRef = useRef(null);
  const productRefs = useRef([]);
  const handleProductChange = (index, field, value) => {
    const updatedEntries = [...productEntries];
    updatedEntries[index][field] = value;
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


  const handleProductEntryChange = async (index, field, value) => {
    const updatedEntries = [...productEntries];
    updatedEntries[index][field] = value;

    if (field === "id" && value.trim()) {
      const suggestions = await fetchProductSuggestions(value.trim());
      if (suggestions.length > 0) {
        updatedEntries[index] = {
          ...updatedEntries[index],
          id: suggestions[0].product_id,
          name: suggestions[0].product_name,
          price: suggestions[0].mrp,
        };
      }
    }
    setProductEntries(updatedEntries);
  };


  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useLocation();
  const { orderId } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState([]);





  // Utility function to get the current financial year
  const getFinancialYear = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // Months are zero-based

    let financialYearStart;
    let financialYearEnd;

    if (currentMonth >= 4) {
      // If the month is April or after, the financial year starts this year
      financialYearStart = currentYear % 100;
      financialYearEnd = (currentYear + 1) % 100;
    } else {
      // If the month is before April, the financial year started last year
      financialYearStart = (currentYear - 1) % 100;
      financialYearEnd = currentYear % 100;
    }

    return `${financialYearStart}-${financialYearEnd}`;
  };

  const generateSalesOrderId = async () => {
    if (!branch) {
      console.error("Branch information is missing.");
      return null;
    }

    try {
      const financialYear = getFinancialYear();

      // Define date range for the financial year
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      const financialYearStart =
        currentMonth >= 4
          ? new Date(currentYear, 3, 1) // April 1st of this year
          : new Date(currentYear - 1, 3, 1); // April 1st of last year

      const financialYearEnd =
        currentMonth >= 4
          ? new Date(currentYear + 1, 2, 31) // March 31st of next year
          : new Date(currentYear, 2, 31); // March 31st of this year

      // Fetch the last sales order ID for the selected branch
      const { data: lastSalesOrders, error } = await supabase
        .from("sales_orders")
        .select("sales_order_id")
        .ilike("sales_order_id", `SO(${branch})%`)
        .gte("created_at", financialYearStart.toISOString())
        .lte("created_at", financialYearEnd.toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      let lastCount = 0;
      if (lastSalesOrders && lastSalesOrders.length > 0) {
        const lastOrderId = lastSalesOrders[0].sales_order_id;
        const parts = lastOrderId.split("-");
        lastCount = parseInt(parts[1], 10);
      }

      // Increment the count for the new Sales Order ID
      const newCount = lastCount + 1;
      const newSalesOrderId = `SO(${branch})-${newCount}-${financialYear}`;

      return newSalesOrderId;
    } catch (error) {
      console.error("Error generating Sales Order ID:", error);
      return null;
    }
  };

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

  const handleProductInputChange = async (index, value) => {
    const updatedEntries = [...productEntries];
    updatedEntries[index].id = value;
    setProductEntries(updatedEntries);

    if (value.trim()) {
      const suggestions = await fetchProductSuggestions(value);
      setSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };




  const fetchExistingSalesOrder = async (orderId) => {
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("sales_order_id", orderId)
        .single();

      if (error || !data) {
        setErrorMessage("Sales order not found");
        return;
      }

      // Populate form fields with the fetched data
      setSalesOrderId(data.sales_order_id);
      setProductEntries(data.items || [{ id: "", name: "", price: "", quantity: "" }]);
      setMrNumber(data.mr_number || "");
      setPhoneNumber(data.patient_phone || "");
      setAdvanceDetails(data.advance_details || 0);
      setEmployee(data.employee || "");
      setPaymentMethod(data.payment_method || "");
      setLoyaltyPoints(data.loyalty_points_redeemed || 0);
      setPrivilegeCard(true);
      setPrivilegeCardNumber(data.pc_number || "");
      setSelectedWorkOrder(data.work_order_id ? { work_order_id: data.work_order_id } : null);

      // Fetch privilege card details based on pc_number
      if (data.pc_number) {
        const privilegeData = await supabase
          .from("privilegecards")
          .select("*")
          .eq("pc_number", data.pc_number)
          .single();

        if (privilegeData.error || !privilegeData.data) {
          setPrivilegeCardDetails(null);
          setErrorMessage("Privilege Card not found for the given PC Number.");
        } else {
          setPrivilegeCardDetails(privilegeData.data);
          setLoyaltyPoints(privilegeData.data.loyalty_points || 0);
          setIsOtpVerified(true); // Skip OTP verification when editing
        }
      }

      setStep(1); // Move to the Product Details step
      setErrorMessage("");
    } catch (error) {
      console.error("Error fetching sales order:", error);
      setErrorMessage("Failed to fetch sales order");
    }
  };

  useEffect(() => {
    if (orderId) {
      setIsEditing(true);
      fetchExistingSalesOrder(orderId);
    }
  }, [orderId]);

  // Function to fetch and set a new Sales Order ID when the branch is available
  const fetchSalesOrderId = async () => {
    if (branch && !isEditing) { // Only generate ID if not editing
      setIsGeneratingId(true);
      const newSalesOrderId = await generateSalesOrderId();
      if (newSalesOrderId) {
        setSalesOrderId(newSalesOrderId);
        setErrorMessage("");
      } else {
        setErrorMessage("Failed to generate Sales Order ID.");
      }
      setIsGeneratingId(false);
    }
  };

  useEffect(() => {
    if (branch) {
      console.log("Fetching Sales Order ID for branch:", branch);
      fetchSalesOrderId();
    }
  }, [branch]);

  const {
    subtotal,
    cgstAmount,
    sgstAmount,
    remainingBalance,
    discount,
    finalAmount,
  } = useMemo(
    () =>
      calculateAmounts(
        productEntries,
        advanceDetails,
        privilegeCard,
        privilegeCardDetails,
        redeemPointsAmount,
        loyaltyPoints,
        selectedWorkOrder
      ),
    [
      productEntries,
      advanceDetails,
      privilegeCard,
      privilegeCardDetails,
      redeemPointsAmount,
      loyaltyPoints,
      selectedWorkOrder,
    ]
  );


  // Calculate discountAmount
  const discountAmount = discount;

  // Function to remove a product entry
  const removeProductEntry = (index) => {
    const updatedEntries = productEntries.filter((_, i) => i !== index);
    setProductEntries(updatedEntries);
  };

  // Function to fetch privilege card by pc_number
  const handleFetchPrivilegeCardByNumber = async () => {
    try {
      // Validate pc_number format if necessary
      if (!privilegeCardNumber.trim()) {
        setErrorMessage("Privilege Card Number is required.");
        return;
      }

      const { data, error } = await supabase
        .from("privilegecards")
        .select("*")
        .eq("pc_number", privilegeCardNumber)
        .single();

      if (error || !data) {
        console.error("Error fetching privilege card:", error);
        setErrorMessage("Privilege Card not found.");
      } else {
        setPrivilegeCardDetails(data);
        setLoyaltyPoints(data.loyalty_points || 0);
        setIsOtpVerified(true); // Skip OTP verification when using barcode
        setErrorMessage("");
        setTimeout(() => nextButtonRef.current?.focus(), 0);
      }
    } catch (error) {
      console.error("Error fetching privilege card:", error);
      setErrorMessage("Failed to fetch privilege card details.");
    }
  };

  // Fetch privilege card details via phone number
  const handleFetchPrivilegeCard = async () => {
    try {
      const card = await fetchPrivilegeCardByPhone(phoneNumber);
      if (card) {
        setPrivilegeCardDetails(card);
        setLoyaltyPoints(card.loyalty_points || 0);
        setErrorMessage("");
      } else {
        setErrorMessage("No Privilege Card associated with this phone number.");
      }
    } catch (error) {
      console.error("Error fetching privilege card:", error);
      setErrorMessage("Failed to fetch privilege card details.");
    }
  };

  // Handle fetching work orders
  async function handleFetchWorkOrders() {
    try {
      let query = supabase.from("work_orders").select("*");

      if (searchQuery.startsWith("WO(")) {
        query = query.eq("work_order_id", searchQuery);
      } else {
        query = query.eq("mr_number", searchQuery);
      }

      // Exclude work orders that are already used
      query = query.eq("is_used", false);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("Error fetching work orders:", error);
        setErrorMessage("Failed to fetch work orders.");
      } else {
        setWorkOrders(data);

        // Focus on the first work order button if found, otherwise on the proceed button
        setTimeout(() => {
          if (data.length > 0) {
            firstWorkOrderButtonRef.current?.focus();
          } else {
            proceedButtonRef.current?.focus();
          }
        }, 0);
      }
    } catch (error) {
      console.error("Error fetching work orders:", error);
      setErrorMessage("Failed to fetch work orders.");
    }
  }

  function handleSelectWorkOrder(workOrder) {
    setSelectedWorkOrder(workOrder);
    setShowWorkOrderModal(true);
  }

  function confirmWorkOrderSelection() {
    // Set relevant data from the work order
    setMrNumber(selectedWorkOrder.mr_number);
    setAdvanceDetails(selectedWorkOrder.advance_details || 0);

    if (selectedWorkOrder.product_entries) {
      setProductEntries(selectedWorkOrder.product_entries);
    }

    setShowWorkOrderModal(false);

    // Move to the next step
    setStep(3); // Adjusted step numbering
  }

  // Function to send OTP
  const handleSendOtp = () => {
    if (phoneNumber.length === 10 && /^\d+$/.test(phoneNumber)) {
      setIsOtpSent(true);
      setErrorMessage("");
      alert(`Mock OTP for testing purposes: ${mockOtp}`); // For testing, remove in production

      // Focus on OTP input after state updates
      setTimeout(() => {
        otpRef.current?.focus();
      }, 100);
    } else {
      setErrorMessage("Please enter a valid 10-digit phone number.");
    }
  };

  const handleVerifyOtp = async () => {
    if (otp === mockOtp) {
      setIsOtpVerified(true);
      setErrorMessage("");
      await handleFetchPrivilegeCard();
      setTimeout(() => {
        if (!errorMessage) {
          nextButtonRef.current?.focus();
        }
      }, 0); // Focus on the next button if no errors
    } else {
      setErrorMessage("Incorrect OTP. Please try again.");
    }
  };

  const handleNewPrivilegeCard = () => {
    navigate("/privilege-generation", {
      state: {
        from: "sales-order",
        step,
        formData: {
          productEntries,
          // description, // Removed description
          mrNumber,
          patientDetails,
          phoneNumber,
          otp,
          isOtpVerified,
          employee,
          paymentMethod,
          advanceDetails,
          privilegeCard,
          redeemPoints,
          redeemPointsAmount,
          loyaltyPoints,
          discountAmount,
          privilegeCardNumber,
        },
      },
    });
  };

  useEffect(() => {
    const locationState = location.state;
    if (locationState?.from === "privilege-generation") {
      setStep(locationState.step);

      const data = locationState.formData;
      if (data) {
        setProductEntries(data.productEntries);
        // setDescription(data.description); // Removed description
        setMrNumber(data.mrNumber);
        setPatientDetails(data.patientDetails);
        setPhoneNumber(data.phoneNumber);
        setOtp(data.otp);
        setIsOtpVerified(data.isOtpVerified);
        setEmployee(data.employee);
        setPaymentMethod(data.paymentMethod);
        setAdvanceDetails(data.advanceDetails);
        setPrivilegeCard(data.privilegeCard);
        setRedeemPoints(data.redeemPoints);
        setRedeemPointsAmount(data.redeemPointsAmount);
        setLoyaltyPoints(data.loyaltyPoints);
        setPrivilegeCardNumber(data.privilegeCardNumber || "");

        // If privilegeCardDetails are available, set them
        if (data.privilegeCardDetails) {
          setPrivilegeCardDetails(data.privilegeCardDetails);
        }
      }
    }
  }, [location]);

  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      focusFirstFieldOfStep();
    }, 100); // Add a slight delay to ensure the element is mounted

    return () => clearTimeout(focusTimeout);
  }, [step, privilegeCard, redeemOption]);

  const focusFirstFieldOfStep = () => {
    if (step === 0) workOrderInputRef.current?.focus();
    if (step === 1) document.getElementById(`productId-0`)?.focus();
    if (step === 2) mrNumberRef.current?.focus();
    if (step === 3 && privilegeCard) {
      if (redeemOption === "barcode") {
        privilegeCardRef.current?.focus();
      } else if (redeemOption === "phone") {
        privilegePhoneRef.current?.focus();
      }
    }
    if (step === 4) employeeRef.current?.focus();
    if (step === 5) paymentMethodRef.current?.focus();
  };

  const handleEnterKey = (e, nextFieldRef, prevFieldRef) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (e.shiftKey && prevFieldRef?.current) {
        prevFieldRef.current.focus();
      } else if (nextFieldRef?.current) {
        nextFieldRef.current.focus();
      } else {
        e.target.click();
      }
    }
  };


  // Function to fetch product details from Supabase
  const fetchProductDetailsFromDatabase = async (productId) => {
    try {
      // Fetch product details with correct headers
      const { data, error, count } = await supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("product_id", productId)

      // Check if no product was found
      if (error) {
        console.error("Error fetching product:", error.message);
        return null;
      }

      // Handle multiple rows scenario
      if (count > 1) {
        console.error("Multiple products found with the same ID");
        return null;
      }

      // Return the single product entry
      return data?.length === 1 ? data[0] : null;
    } catch (err) {
      console.error("Unexpected error fetching product details:", err);
      return null;
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

  const nextStep = async () => {
    const errors = {};

    // Validate each step before proceeding
    if (step === 0) {
      if (!searchQuery.trim())
        errors.searchQuery = "Work Order ID or MR Number is required";
      // Removed branchCode validation as branch is fetched from context
    } else if (step === 1) {
      productEntries.forEach((product, index) => {
        if (!product.id)
          errors[`productId-${index}`] = "Product ID is required";
        if (!product.price)
          errors[`productPrice-${index}`] = "Price is required";
        if (!product.quantity)
          errors[`productQuantity-${index}`] = "Quantity is required";
      });
    } else if (step === 2 && !mrNumber) {
      errors.mrNumber = "MR number is required";
    } else if (step === 3 && privilegeCard) {
      if (redeemOption === "phone") {
        if (!phoneNumber.trim())
          errors.phoneNumber = "Phone number is required";
        if (!otp.trim()) errors.otp = "OTP is required";
        if (!isOtpVerified) errors.otp = "Please verify the OTP";
      }
      if (
        redeemPoints &&
        (parseFloat(redeemPointsAmount) > loyaltyPoints ||
          parseFloat(redeemPointsAmount) < 0)
      ) {
        errors.redeemPointsAmount = "Invalid redemption amount";
      }
    } else if (step === 4 && !employee) {
      errors.employee = "Employee selection is required";
    } else if (step === 5 && !paymentMethod) {
      errors.paymentMethod = "Payment method is required";
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      if (step < 5) {
        setStep((prevStep) => prevStep + 1);
      }
    }
  };

  useEffect(() => {
    if (step === 3 && !privilegeCard) {
      // If the user doesn't have a privilege card, proceed to the next step
      nextStep();
    }
  }, [privilegeCard, step]);

  const prevStep = () => {
    setValidationErrors({});
    setIsPinVerified(false); // Reset PIN verification if going back
    setStep((prevStep) => (prevStep > 0 ? prevStep - 1 : 0));
  };



  const handleMRNumberSearch = () => {
    // Simulate fetching patient details
    setPatientDetails({
      name: "John Doe",
      age: 35,
      condition: "Myopia",
    });
    nextButtonRef.current?.focus();
  };

  useEffect(() => {
    if (location.state?.isFromApproval) {
      setStep(location.state.step || 1);
      setIsEditing(true);
    }
  }, [location]);



  const handleOrderCompletion = async () => {
    const currentUTCDateTime = getCurrentUTCDateTime();
    setIsLoading(true);

    try {
      // Step 1: Handle Loyalty Points Update (if applicable)
      if (privilegeCard && privilegeCardDetails) {
        const { updatedPoints, pointsToRedeem, pointsToAdd } = calculateLoyaltyPoints(
          subtotal,
          redeemPointsAmount,
          privilegeCard,
          privilegeCardDetails,
          loyaltyPoints
        );

        const { error: loyaltyError } = await supabase
          .from("privilegecards")
          .update({ loyalty_points: updatedPoints })
          .eq("pc_number", privilegeCardNumber);

        if (loyaltyError) {
          console.error("Error updating loyalty points:", loyaltyError);
          setErrorMessage("Failed to update loyalty points.");
          return;
        }

        setLoyaltyPoints(updatedPoints);
        setPointsToAdd(pointsToAdd);
      }

      // Step 2: Prepare Variables for Sales Order Data
      const sanitizedRedeemedPoints = privilegeCard ? parseInt(redeemPointsAmount) || 0 : 0;
      const sanitizedPointsAdded = privilegeCard ? pointsToAdd || 0 : 0;

      // Step 3: Handle Existing Sales Order Update
      if (isEditing) {
        const { error: updateError } = await supabase
          .from("sales_orders")
          .update({
            items: productEntries,
            advance_details: parseFloat(advanceDetails),
            mr_number: mrNumber,
            patient_phone: phoneNumber,
            employee: employee,
            payment_method: paymentMethod,
            subtotal: subtotal,
            cgst: parseFloat(cgstAmount),
            sgst: parseFloat(sgstAmount),
            total_amount: subtotal,
            discount: discountAmount,
            final_amount: finalAmount,
            loyalty_points_redeemed: sanitizedRedeemedPoints,
            loyalty_points_added: sanitizedPointsAdded,
            updated_at: currentUTCDateTime,
            branch: branch,
          })
          .eq("sales_order_id", salesOrderId);

        if (updateError) {
          console.error("Error updating sales order:", updateError);
          setErrorMessage("Failed to update sales order.");
          return;
        }

        alert("Sales order updated successfully!");



      } else {
        // Step 4: Insert New Sales Order
        const newSalesOrderId = await generateSalesOrderId();
        const { error: insertError } = await supabase
          .from("sales_orders")
          .insert({
            sales_order_id: newSalesOrderId,
            work_order_id: selectedWorkOrder ? selectedWorkOrder.work_order_id : null,
            items: productEntries,
            advance_details: parseFloat(advanceDetails),
            mr_number: mrNumber,
            patient_phone: phoneNumber,
            employee: employee,
            payment_method: paymentMethod,
            subtotal: subtotal,
            cgst: parseFloat(cgstAmount),
            sgst: parseFloat(sgstAmount),
            total_amount: subtotal,
            discount: discountAmount,
            final_amount: finalAmount,
            loyalty_points_redeemed: sanitizedRedeemedPoints,
            loyalty_points_added: sanitizedPointsAdded,
            created_at: currentUTCDateTime,
            updated_at: currentUTCDateTime,
            branch: branch,
          });

        if (insertError) {
          console.error("Error inserting sales order:", insertError);
          setErrorMessage("Failed to create sales order.");
          return;
        }

        alert("Sales order created successfully!");



        // Step 5: Mark Work Order as Used (if applicable)
        if (selectedWorkOrder) {
          const { error: workOrderError } = await supabase
            .from("work_orders")
            .update({ is_used: true })
            .eq("work_order_id", selectedWorkOrder.work_order_id);

          if (workOrderError) {
            console.error("Error marking work order as used:", workOrderError);
            setErrorMessage("Failed to update work order status.");
            return;
          }
        }

        const validProducts = productEntries.filter(
          (product) => product.id && product.quantity > 0
        );

        if (!validProducts || validProducts.length === 0) {
          console.error("No valid products to process");
          setErrorMessage("No valid products to deduct stock.");
          setIsLoading(false); // Ensure loading state is turned off
          return;
        }

        console.log("Valid Products for Deduction:", validProducts);

        // Step 6: Deduct Stock for Multiple Products in Bulk
        const deductions = validProducts.map((product) => ({
          product_id: product.id,
          branch_code: branch,
          purchase_quantity: product.quantity,
        }));

        const deductResponse = await deductStockForMultipleProducts(deductions, branch);
        if (!deductResponse.success) {
          console.error("Stock deduction failed:", deductResponse.error);
          setErrorMessage(`Failed to deduct stocks: ${deductResponse.error}`);
          return;
        }
      }

      // Step 7: Reset the Form After Successful Submission
      if (onModificationSuccess) {
        await supabase
          .from("modification_requests")
          .update({ status: "completed" })
          .eq("order_id", orderId);

        // Trigger the callback to notify EmployeeActionRequired
        console.log("Triggering onModificationSuccess with orderId:", orderId);
        onModificationSuccess(orderId);
      }

      setAllowPrint(true);


      alert("Order processed successfully!");
      setTimeout(() => {
        printButtonRef.current?.focus(); // Move focus to the Print button
      }, 100);

    } catch (error) {
      console.error("Error completing the order:", error);
      setErrorMessage("Failed to complete the order.");
    } finally {
      setIsLoading(false);
    }
  };


  // Function to reset the form
  const resetForm = () => {
    setProductEntries([{ id: "", name: "", price: "", quantity: "" }]);
    setPatientDetails(null);
    setPrivilegeCard(true);
    setPhoneNumber("");
    setOtp("");
    setIsOtpVerified(false);
    setEmployee("");
    setAllowPrint(false);
    setAdvanceDetails(0);
    setPaymentMethod("");
    setValidationErrors({});
    setErrorMessage("");
    setIsOtpSent(false);
    setPrivilegeCardDetails(null);
    setRedeemPoints(false);
    setRedeemPointsAmount("");
    setLoyaltyPoints(0);
    setMrNumber("");
    setWorkOrders([]);
    setSelectedWorkOrder(null);
    setShowWorkOrderModal(false);
    setPointsToAdd(0);
    setRedeemOption(null);
    setPrivilegeCardNumber("");
    setIsEditing(false); // Reset isEditing to false
    // Optionally retain the branch to allow multiple orders for the same branch
  };


  // Confirm and reset the form
  const handleExit = () => {
    if (window.confirm("Are you sure you want to exit? Unsaved changes will be lost.")) {
      resetForm();
      navigate("/home");
    }
  };


  const handlePrint = () => {
    setAllowPrint(true);
    window.print(); // Simply call print without extra state changes
  };



  const focusFlowForStep3 = (e, currentRef, nextRef) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      }
    }
  };

  return (
    <div
      className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
        } justify-center mt-16 p-4 mx-auto`}
    >
      {/* Modal for Work Order Details */}
      {showWorkOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-md shadow-md max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Work Order Details
            </h2>
            <div className="space-y-2">
              <p>
                <strong>Work Order ID:</strong> {selectedWorkOrder.work_order_id}
              </p>
              <p>
                <strong>Description:</strong> {selectedWorkOrder.description}
              </p>
              <p>
                <strong>Advance Amount Paid:</strong> ₹
                {parseFloat(selectedWorkOrder.advance_details).toFixed(2)}
              </p>
              <p>
                <strong>CGST:</strong> ₹
                {parseFloat(selectedWorkOrder.cgst).toFixed(2)}
              </p>
              <p>
                <strong>SGST:</strong> ₹
                {parseFloat(selectedWorkOrder.sgst).toFixed(2)}
              </p>
              <p>
                <strong>Created At:</strong>{" "}
                {convertUTCToIST(selectedWorkOrder.created_at)}
              </p>

              {/* Display Product Entries */}
              {selectedWorkOrder.product_entries &&
                selectedWorkOrder.product_entries.length > 0 && (
                  <div>
                    <h3 className="font-semibold mt-4">Product Entries:</h3>
                    <table className="w-full mt-2 border border-gray-300 rounded-md">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="py-1 px-2 border-b">Product ID</th>
                          <th className="py-1 px-2 border-b">Product Name</th>
                          <th className="py-1 px-2 border-b">Price</th>
                          <th className="py-1 px-2 border-b">Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWorkOrder.product_entries.map(
                          (product, index) => (
                            <tr key={index} className="text-center">
                              <td className="py-1 px-2 border-b">{product.id}</td>
                              <td className="py-1 px-2 border-b">{product.name}</td>
                              <td className="py-1 px-2 border-b">{product.price}</td>
                              <td className="py-1 px-2 border-b">{product.quantity}</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button" // Added type="button"
                onClick={confirmWorkOrderSelection}
                className="mr-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Confirm
              </button>
              <button
                type="button" // Added type="button"
                onClick={() => setShowWorkOrderModal(false)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">
        Sales Order Generation
      </h1>

      {/* Editing Indicator */}
      {isEditing && (
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg mb-6">
          <p>You are editing an existing Sales Order (ID: {salesOrderId}).</p>
        </div>
      )}

      {/* Progress Tracker */}
      <div className="flex items-center mb-8 w-2/3 mx-auto">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-xl mx-1 ${step > i ? "bg-[#5db76d]" : "bg-gray-300"
              } transition-all duration-300`}
          />
        ))}
      </div>

      {authLoading ? (
        <p className="text-center text-blue-500">Loading...</p>
      ) : !user ? (
        <p className="text-center text-red-500">User not authenticated.</p>
      ) : (
        <form
          className="space-y-8 bg-white p-6 rounded-lg max-w-3xl mx-auto"
          onSubmit={(e) => e.preventDefault()}
        >
          {/* Step 0: Fetch Work Orders */}
          {step === 0 && (
            <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Fetch Work Orders
              </h2>

              {/* Enter Work Order ID or MR Number */}
              <label className="block text-gray-700 font-medium mb-1">
                Enter Work Order ID or MR Number
              </label>
              <input
                type="text"
                placeholder="Work Order ID or MR Number"
                value={searchQuery}
                ref={workOrderInputRef}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFetchWorkOrders();
                  }
                }}
                className="border border-gray-300 w-full px-4 py-3 rounded-lg"
              />

              {validationErrors.searchQuery && (
                <p className="text-red-500 text-xs mt-1">
                  {validationErrors.searchQuery}
                </p>
              )}
              <button
                type="button" // Added type="button"
                onClick={handleFetchWorkOrders}
                ref={fetchButtonRef}
                className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
              >
                Fetch Work Orders
              </button>

              {workOrders.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-md font-semibold text-gray-700 mb-4">
                    Select a Work Order
                  </h3>
                  <ul className="space-y-4">
                    {workOrders.map((workOrder, index) => (
                      <li
                        key={workOrder.id}
                        className="bg-green-50 p-4 rounded-md shadow-md"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p>
                              <strong>Work Order ID:</strong> {workOrder.work_order_id}
                            </p>
                            <p>
                              <strong>Description:</strong> {workOrder.description}
                            </p>
                            <p>
                              <strong>Advance Paid:</strong> ₹
                              {parseFloat(workOrder.advance_details).toFixed(2)}
                            </p>
                            <p>
                              <strong>Created At:</strong>{" "}
                              {convertUTCToIST(workOrder.created_at)}
                            </p>
                          </div>
                          <button
                            type="button" // Added type="button"
                            ref={index === 0 ? firstWorkOrderButtonRef : null}
                            onClick={() => handleSelectWorkOrder(workOrder)}
                            id={`workOrderButton-${index}`}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
                          >
                            Select
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-4">
                  <p>No work orders found for this search.</p>
                  <button
                    type="button" // Added type="button"
                    onClick={() => setStep(1)}
                    ref={proceedButtonRef}
                    className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
                  >
                    Proceed to Step 1
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Product Details */}
          {/* Step 1: Product Details */}
          {step === 1 && (
            <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-6">
              <h2 className="text-lg font-semibold text-gray-700 text-center">
                Product Information
              </h2>
              <label className="block text-gray-700 font-medium mb-1">
                Generated Sales Order ID
              </label>
              <input
                type="text"
                value={salesOrderId}
                readOnly
                className="border border-gray-300 px-4 py-3 rounded-lg bg-gray-200 text-gray-700 w-full text-center"
              />
              <label className="block text-gray-700 font-medium mb-1">
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
                          placeholder="Enter Product ID"
                          value={productEntries[index].id}
                          onChange={async (e) => {
                            const value = e.target.value.trim();
                            if (value) {
                              const suggestions = await fetchProductSuggestions(value, "id");
                              setProductSuggestions(suggestions);
                            } else {
                              setProductSuggestions([]);
                            }
                            setProductEntries((prevEntries) => {
                              const updatedEntries = [...prevEntries];
                              updatedEntries[index].id = value; // Update ID field
                              return updatedEntries;
                            });
                          }}
                          onBlur={async () => {
                            const selectedProduct = productSuggestions.find(
                              (prod) => prod.product_id === productEntries[index].id
                            );
                            if (selectedProduct) {
                              // Automatically fetch data and move focus to quantity
                              const productDetails = await fetchProductDetailsFromDatabase(
                                selectedProduct.product_id
                              );
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
                                setTimeout(() => {
                                  quantityRefs.current[index]?.focus();
                                }, 100);
                              }
                            }
                          }}
                          onInput={async (e) => {
                            // Handle barcode scanner input
                            const value = e.target.value.trim();
                            if (value.length >= 5) { // Assuming barcode length >= 5
                              const productDetails = await fetchProductDetailsFromDatabase(value);
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
                                setTimeout(() => {
                                  quantityRefs.current[index]?.focus();
                                }, 100);
                              }
                            }
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const selectedProduct = productSuggestions.find(
                                (prod) => prod.product_id === productEntries[index].id
                              );
                              if (selectedProduct) {
                                const productDetails = await fetchProductDetailsFromDatabase(
                                  selectedProduct.product_id
                                );
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
                                  setTimeout(() => {
                                    quantityRefs.current[index]?.focus();
                                  }, 100);
                                }
                              }
                            } else if (e.key === "Enter" && e.shiftKey) {
                              e.preventDefault();
                              addNewProductEntry();
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
                        {validationErrors[`productId-${index}`] && (
                          <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                            {validationErrors[`productId-${index}`]}
                          </p>
                        )}
                      </div>

                      {/* Product Name Input (Read-Only) */}
                      <div className="relative w-1/2">
                        <input
                          type="text"
                          value={product.name}
                          readOnly
                          className="border border-gray-300 px-4 py-3 rounded-lg w-full bg-gray-100"
                        />
                      </div>

                      {/* Product Price Input (Read-Only) */}
                      <div className="relative w-1/4">
                        <input
                          type="text"
                          value={product.price}
                          readOnly
                          className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center bg-gray-100"
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
                          type="number"
                          id={`productQuantity-${index}`}
                          placeholder="Quantity"
                          value={product.quantity}
                          ref={(el) => (quantityRefs.current[index] = el)}
                          onChange={(e) =>
                            handleProductEntryChange(index, "quantity", e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              nextStep();
                            }
                          }}
                          className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center"
                        />
                        {validationErrors[`productQuantity-${index}`] && (
                          <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                            {validationErrors[`productQuantity-${index}`]}
                          </p>
                        )}
                      </div>

                      {/* Delete Button */}
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


          {/* Step 2: Patient Details */}
          {step === 2 && (
            <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Patient Information
              </h2>
              <label className="block text-gray-700 font-medium mb-1">
                Enter MR Number
              </label>
              <input
                type="text"
                placeholder="Enter MR Number"
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

          {/* Step 3: Privilege Card */}
          {step === 3 && (
            <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Privilege Card
              </h2>

              <p className="font-semibold mb-2">
                Do you have a Privilege Card?
              </p>
              <div className="flex space-x-4 mb-4">
                <button
                  type="button" // Added type="button"
                  onClick={() => {
                    setPrivilegeCard(true);
                    setRedeemOption(null); // Reset redeem option
                    setErrorMessage(""); // Clear previous errors
                    setTimeout(() => {
                      if (redeemOption === "barcode") {
                        privilegeCardRef.current?.focus();
                      } else {
                        privilegePhoneRef.current?.focus();
                      }
                    }, 0);
                  }}
                  className={`px-4 py-2 rounded-lg ${privilegeCard ? "bg-green-500 text-white" : "bg-gray-200"
                    }`}
                >
                  Yes
                </button>
                <button
                  type="button" // Added type="button"
                  onClick={() => {
                    setPrivilegeCard(false);
                    setRedeemOption(null); // Reset redeem option
                    setErrorMessage(""); // Clear previous errors
                    nextStep();
                  }}
                  className={`px-4 py-2 rounded-lg ${!privilegeCard ? "bg-green-500 text-white" : "bg-gray-200"
                    }`}
                >
                  No
                </button>
              </div>

              {privilegeCard && (
                <>
                  <p className="font-semibold mb-2">
                    How would you like to fetch your Privilege Card?
                  </p>
                  <div className="flex space-x-4 mb-4">
                    <button
                      type="button" // Added type="button"
                      onClick={() => setRedeemOption("barcode")}
                      className={`px-4 py-2 rounded-lg ${redeemOption === "barcode"
                        ? "bg-green-500 text-white"
                        : "bg-gray-200"
                        }`}
                    >
                      Scan Barcode
                    </button>
                    <button
                      type="button" // Added type="button"
                      onClick={() => setRedeemOption("phone")}
                      className={`px-4 py-2 rounded-lg ${redeemOption === "phone"
                        ? "bg-green-500 text-white"
                        : "bg-gray-200"
                        }`}
                    >
                      Use Phone Number
                    </button>
                  </div>

                  {/* Barcode Scan Option */}
                  {redeemOption === "barcode" && (
                    <>
                      <input
                        type="text"
                        placeholder="Enter Privilege Card Number (pc_number)"
                        value={privilegeCardNumber}
                        onChange={(e) => setPrivilegeCardNumber(e.target.value)}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center mb-2"
                        ref={privilegeCardRef}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleFetchPrivilegeCardByNumber();
                          }
                        }}
                      />
                      <button
                        type="button" // Added type="button"
                        onClick={handleFetchPrivilegeCardByNumber}
                        className="bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg w-full"
                      >
                        Fetch Privilege Card
                      </button>
                    </>
                  )}

                  {/* Phone Number and OTP Option */}
                  {redeemOption === "phone" && (
                    <>
                      {/* Phone Number Input */}
                      <input
                        type="text"
                        placeholder="Enter Phone Number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center mb-2"
                        ref={privilegePhoneRef}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSendOtp();
                          }
                        }}
                      />

                      {/* Send OTP Button */}
                      {!isOtpSent && (
                        <button
                          type="button" // Added type="button"
                          onClick={handleSendOtp}
                          className="mt-4 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg w-full"
                        >
                          Send OTP
                        </button>
                      )}

                      {isOtpSent && (
                        <>
                          {/* OTP Input */}
                          <input
                            type="text"
                            placeholder="Enter OTP"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center mb-2"
                            ref={otpRef}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleVerifyOtp();
                              }
                            }}
                          />
                          {validationErrors.otp && (
                            <p className="text-red-500 text-xs mt-1">
                              {validationErrors.otp}
                            </p>
                          )}

                          {/* Verify OTP Button */}
                          <button
                            type="button" // Added type="button"
                            onClick={handleVerifyOtp}
                            className="bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg w-full"
                          >
                            Verify OTP
                          </button>

                          {/* Display Error Messages */}
                          {errorMessage && (
                            <p className="text-red-600 text-center mt-2">
                              {errorMessage}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Show privilege card details if found */}
                  {isOtpVerified && privilegeCardDetails && (
                    <div className="mt-6 bg-gray-100 p-4 rounded border">
                      <p>
                        <strong>Customer Name:</strong>{" "}
                        {privilegeCardDetails.customer_name}
                      </p>
                      <p>
                        <strong>PC Number:</strong>{" "}
                        {privilegeCardDetails.pc_number}
                      </p>
                      <p>
                        <strong>Loyalty Points:</strong> {loyaltyPoints}
                      </p>

                      {/* Redeem Points Section */}
                      <div className="mt-4">
                        <p className="font-semibold">Redeem Loyalty Points:</p>
                        <div className="flex space-x-4 mt-2">
                          <button
                            type="button" // Added type="button"
                            onClick={() => {
                              setRedeemOption("full");
                              setRedeemPointsAmount(loyaltyPoints);
                              setRedeemPoints(true);
                            }}
                            className={`px-4 py-2 mb-2 rounded-lg ${redeemOption === "full"
                              ? "bg-green-500 text-white"
                              : "bg-gray-200"
                              }`}
                          >
                            Redeem Full Points
                          </button>
                          <button
                            type="button" // Added type="button"
                            onClick={() => {
                              setRedeemOption("custom");
                              setRedeemPointsAmount("");
                              setRedeemPoints(true);
                              setTimeout(
                                () => redeemPointsAmountRef.current?.focus(),
                                0
                              ); // Focus on custom amount input
                            }}
                            className={`px-4 py-2 mb-2 rounded-lg ${redeemOption === "custom"
                              ? "bg-green-500 text-white"
                              : "bg-gray-200"
                              }`}
                          >
                            Redeem Custom Amount
                          </button>
                        </div>

                        {/* When 'Redeem Full' is selected */}
                        {redeemOption === "full" && (
                          <div className="mt-2">
                            <input
                              type="number"
                              value={loyaltyPoints}
                              readOnly
                              className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center my-2 bg-gray-100"
                            />
                            <p className="text-center">
                              You are redeeming your full loyalty points.
                            </p>
                          </div>
                        )}

                        {/* When 'Redeem Custom' is selected */}
                        {redeemOption === "custom" && (
                          <div className="mt-2">
                            <input
                              type="number"
                              placeholder={`Enter amount to redeem (Max: ₹${loyaltyPoints})`}
                              value={redeemPointsAmount}
                              onChange={(e) =>
                                setRedeemPointsAmount(
                                  e.target.value === ""
                                    ? ""
                                    : Math.min(
                                      Number(e.target.value),
                                      loyaltyPoints
                                    )
                                )
                              }
                              className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center my-2"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  nextButtonRef.current?.focus();
                                }
                              }}
                              ref={redeemPointsAmountRef}
                            />
                            {(parseFloat(redeemPointsAmount) > loyaltyPoints ||
                              parseFloat(redeemPointsAmount) < 0) && (
                                <p className="text-red-500 text-xs mt-1">
                                  Please enter a valid amount up to your available
                                  points.
                                </p>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Prompt to create a new privilege card if not found */}
                  {isOtpVerified && !privilegeCardDetails && (
                    <div className="mt-6 bg-green-50 p-4 rounded">
                      <p className="text-center text-red-500">
                        No Privilege Card found for this{" "}
                        {redeemOption === "phone"
                          ? "phone number."
                          : "PC Number."}
                      </p>
                      <button
                        type="button" // Added type="button"
                        onClick={handleNewPrivilegeCard}
                        className="mt-4 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg w-full"
                      >
                        Create New Privilege Card
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Employee Selection */}
          {step === 4 && (
            <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Order Created by Employee Details
              </h2>
              <select
                value={employee}
                onChange={(e) => setEmployee(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && employee) {
                    employeeRef.current?.focus();
                  }
                }}
                ref={employeeRef}
                className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center"
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
                <p className="text-red-500 text-xs mt-1">{validationErrors.employee}</p>
              )}
            </div>
          )}

          {/* Step 5: Order Preview with Payment Method */}
          {step === 5 && (
            <div>
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
                <div className="grid grid-cols-2 gap-2 mt-20 mb-6">
                <h2 className="text-2xl font-semibold mt-2">Invoice Summary</h2>
                  <div>
                    <p>
                      <span className="font-semibold">Sales Order ID:</span>{" "}
                      {salesOrderId}
                    </p>
                    {/* Description removed */}
                    <p>
                      <span className="font-semibold">Customer MR Number:</span>{" "}
                      {mrNumber}
                    </p>
                    <p>
                      <span className="font-semibold">Customer Name:</span>{" "}
                      {patientDetails?.name ||
                        privilegeCardDetails?.customer_name ||
                        "N/A"}
                    </p>
                    <p>
                      <span className="font-semibold">Billed by:</span>{" "}
                      {employee}
                    </p>
                  </div>
                  
                </div>

                {/* Product Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full border border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-2 px-4 border-b text-left">
                          Product ID
                        </th>
                        <th className="py-2 px-4 border-b text-left">
                          Product Name
                        </th>
                        <th className="py-2 px-4 border-b text-left">
                          HSN Code
                        </th>
                        <th className="py-2 px-4 border-b text-right">
                          Price (₹)
                        </th>
                        <th className="py-2 px-4 border-b text-right">
                          Quantity
                        </th>
                        <th className="py-2 px-4 border-b text-right">
                          Subtotal (₹)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {productEntries.map((product, index) => {
                        const productSubtotal =
                          (parseFloat(product.price) || 0) *
                          (parseInt(product.quantity) || 0);
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="py-2 px-4 border-b">{product.id}</td>
                            <td className="py-2 px-4 border-b">
                              {product.name}
                            </td>
                            <td className="py-2 px-4 border-b">
                              9001
                            </td>
                            <td className="py-2 px-3 border-b text-right">
                              {parseFloat(product.price).toFixed(2)}
                            </td>
                            <td className="py-2 px-4 border-b text-right">
                              {product.quantity}
                            </td>
                            <td className="py-2 px-4 border-b text-right">
                              {productSubtotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Left Column */}
                  <div className="space-y-2">

                    <p>
                      <span className="font-semibold">CGST (6%):</span> ₹
                      {parseFloat(cgstAmount).toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">SGST (6%):</span> ₹
                      {parseFloat(sgstAmount).toFixed(2)}
                    </p>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold">total:</span> ₹
                      {subtotal.toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">Advance Paid:</span> ₹
                      {parseFloat(advanceDetails).toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">Discount Applied:</span> ₹
                      {discountAmount.toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">Balance Due:</span> ₹
                      {finalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Loyalty Points Information */}
                {privilegeCard && privilegeCardDetails && (
                  <div className="mb-6">
                    <p>
                      <span className="font-semibold">
                        Loyalty Points Redeemed:
                      </span>{" "}
                      ₹{redeemPointsAmount.toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">
                        Loyalty Points Gained:
                      </span>{" "}
                      {pointsToAdd}
                    </p>
                  </div>
                )}

                {/* Payment Method and Advance Details */}
                <div className="flex flex-col md:flex-row items-center justify-between my-6 space-x-4">
                  {/* Payment Method */}
                  <div className="w-full md:w-1/2 mb-4 md:mb-0">
                    <label
                      htmlFor="paymentMethod"
                      className="block font-semibold mb-1"
                    >
                      Payment Method:
                    </label>
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      ref={paymentMethodRef}
                      onKeyDown={(e) =>
                        handleEnterKey(e, saveOrderRef)
                      }
                      className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                    >
                      <option value="" disabled>
                        Select Payment Method
                      </option>
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
                </div>
              </div>

              {/* Action Buttons Outside Printable Area */}
              <div className="flex flex-col md:flex-row justify-start mt-6 space-x-6 space-y-4 md:space-y-0">
                <button
                  type="button" // Added type="button"
                  onClick={handleOrderCompletion}
                  ref={saveOrderRef}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      await handleOrderCompletion();
                      setTimeout(() => printButtonRef.current?.focus(), 100); // Move focus to Print button after saving
                    }
                  }}
                  className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition ${!paymentMethod ? "opacity-50 cursor-not-allowed" : ""
                    } w-full md:w-auto`}
                  disabled={!paymentMethod || isLoading}
                >
                  Submit Order{" "}
                  {privilegeCard && privilegeCardDetails
                    ? "& Update Loyalty Points"
                    : ""}
                </button>
                {allowPrint && (
                  <button
                    type="button" // Added type="button"
                    onClick={handlePrint}
                    ref={printButtonRef}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handlePrint();
                        setTimeout(() => newWorkOrderButtonRef.current?.focus(), 100); // Move focus to Create New after printing
                      }
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition flex items-center justify-center w-full md:w-auto"

                  >
                    <PrinterIcon className="w-5 h-5 inline mr-2" />
                    Print
                  </button>
                )}
                {/* Exit Button */}
                {allowPrint && (
                  <div className="flex justify-center text-center mt-6">
                    <button
                      onClick={handleExit}
                      className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg flex items-center justify-center w-fit"
                    >
                      Exit
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-center mt-6">
            {step > 0 && (
              <button
                type="button" // Added type="button"
                onClick={prevStep}
                className="bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg"
              >
                Previous
              </button>
            )}
            {step < 5 && (
              <button
                type="button" // Added type="button"
                ref={nextButtonRef}
                onClick={nextStep}
                className={`bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg ${step === 4 && !isPinVerified ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={step === 4 && !isPinVerified}
              >
                Next
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
});

export default SalesOrderGeneration;

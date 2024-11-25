// client/src/pages/SalesOrderGeneration.jsx

import React, { useState, useEffect, useRef, useMemo, memo } from "react";
import { PrinterIcon, TrashIcon } from "@heroicons/react/24/outline";
import supabase from "../supabaseClient";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deductStockForMultipleProducts } from "../services/authService.js";
import EmployeeVerification from "../components/EmployeeVerification";
import logo from "../assets/sreenethraenglishisolated.png";
import dayjs from "dayjs"; // Ensure dayjs is imported

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

// Function to fetch customer by phone number
const fetchCustomerByPhone = async (phone) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("phone_number", phone)
    .single();

  if (error) {
    return null;
  }
  return data;
};

// Function to create a new customer
const createCustomer = async (name, phone_number) => {
  const { data, error } = await supabase
    .from("customers")
    .insert([{ name, phone_number }])
    .single();

  if (error) {
    console.error("Error creating customer:", error);
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
  selectedWorkOrder,
  discountPercentage
) {
  // Step 1: Adjust Prices and Calculate Adjusted Subtotal
  const adjustedSubtotal = productEntries.reduce((acc, product) => {
    const originalPrice = parseFloat(product.price) || 0;
    const adjustedPrice = (originalPrice / 112) * 100; // Adjusted Price using formula
    const quantity = parseInt(product.quantity) || 0;
    return acc + adjustedPrice * quantity;
  }, 0);

  // Step 2: Calculate Discount based on Percentage
  const discountPercent = parseFloat(discountPercentage) || 0;
  const discount = discountPercent > 0 ? (adjustedSubtotal * discountPercent) / 100 : 0;

  // Step 3: Calculate Remaining Balance after Discount and Advance
  let remainingBalance = adjustedSubtotal - discount - (parseFloat(advanceDetails) || 0);

  // Step 4: Calculate Privilege Card Discount if Applicable
  let privilegeDiscount = 0;
  if (privilegeCard && privilegeCardDetails && parseFloat(redeemPointsAmount) > 0) {
    const redeemAmount = parseFloat(redeemPointsAmount) || 0;
    privilegeDiscount = Math.min(redeemAmount, loyaltyPoints, remainingBalance);
    remainingBalance -= privilegeDiscount;
  }

  // Step 5: Calculate GST based on Remaining Balance
  const cgstAmount = remainingBalance * 0.06;
  const sgstAmount = remainingBalance * 0.06;

  // Step 6: Calculate Final Amount Including GST
  const finalAmount = remainingBalance + cgstAmount + sgstAmount;

  // Step 7: Ensure Final Amount is Not Negative
  const finalAmountAdjusted = Math.max(finalAmount, 0);

  return {
    subtotal: adjustedSubtotal, // Adjusted Subtotal
    discount, // Discount Amount
    advance: parseFloat(advanceDetails) || 0, // Advance Paid
    privilegeDiscount, // Privilege Card Discount
    cgstAmount, // 6% CGST
    sgstAmount, // 6% SGST
    finalAmount: finalAmountAdjusted, // Final Amount Including GST
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

// Helper function to calculate differences between original and updated products
const calculateProductDifferences = (original, updated) => {
  const differences = [];

  // Create a map for quick lookup
  const originalMap = new Map();
  original.forEach((prod) => {
    originalMap.set(prod.id, parseInt(prod.quantity) || 0);
  });

  const updatedMap = new Map();
  updated.forEach((prod) => {
    updatedMap.set(prod.id, parseInt(prod.quantity) || 0);
  });

  // Check for removed or decreased quantities
  originalMap.forEach((originalQty, productId) => {
    const updatedQty = updatedMap.get(productId) || 0;
    const diff = updatedQty - originalQty;
    if (diff !== 0) {
      differences.push({ productId, diff });
    }
  });

  // Check for newly added products
  updatedMap.forEach((updatedQty, productId) => {
    if (!originalMap.has(productId)) {
      differences.push({ productId, diff: updatedQty });
    }
  });

  return differences;
};

// Main Component
const SalesOrderGeneration = memo(({ isCollapsed, onModificationSuccess }) => {
  const { user, role, name, branch, loading: authLoading } = useAuth();
  console.log("branch:", branch); // Destructure branch from AuthContext

  const [step, setStep] = useState(0); // Adjusted step numbering
  const [salesOrderId, setSalesOrderId] = useState("");
  const [productEntries, setProductEntries] = useState([
    { id: "", name: "", price: "", quantity: "" },
  ]);

  // New state to store original products when editing
  const [originalProductEntries, setOriginalProductEntries] = useState([
    { id: "", name: "", price: "", quantity: "" },
  ]);

  const [patientDetails, setPatientDetails] = useState(null);
  const [privilegeCard, setPrivilegeCard] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [employee, setEmployee] = useState("");
  const [employees, setEmployees] = useState([]);
  const [allowPrint, setAllowPrint] = useState(false);
  const [advanceDetails, setAdvanceDetails] = useState("");
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
  const [discountPercentage, setDiscountPercentage] = useState(""); // Changed from 0 to ""

  // Refs for input fields to control focus
  const mrNumberRef = useRef(null);
  const privilegePhoneRef = useRef(null);
  const otpRef = useRef(null);
  const employeeRef = useRef(null);
  const billPrintRef = useRef(null);

  const customerNameRef = useRef(null);
  const customerPhoneRef = useRef(null);
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
  const [productSuggestions, setProductSuggestions] = useState([]);
  const discountInputRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams();
  const [isEditing, setIsEditing] = useState(false);

  const [fetchMethod, setFetchMethod] = useState("work_order_id"); // 'work_order_id', 'mr_number', 'phone_number'

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
      setValidationErrors({ employee: "Employee selection is required." });
      employeeRef.current?.focus();
    } else {
      setValidationErrors({});
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
    try {
      // Fetch the maximum sales_order_id
      const { data, error } = await supabase
        .from("sales_orders")
        .select("sales_order_id")
        .order("sales_order_id", { ascending: false })
        .limit(1);
  
      if (error) {
        console.error("Error fetching last sales_order_id:", error);
        return null;
      }
  
      let lastSalesOrderId = 0;
      if (data && data.length > 0) {
        lastSalesOrderId = parseInt(data[0].sales_order_id, 10) || 0;
      }
  
      // Increment the last sales_order_id by 1
      const newSalesOrderId = lastSalesOrderId + 1;
  
      return newSalesOrderId.toString();
    } catch (error) {
      console.error("Error generating sales_order_id:", error);
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

  const handleProductChange = (index, field, value) => {
    setProductEntries((prevEntries) => {
      const updatedEntries = [...prevEntries];
      updatedEntries[index][field] = value;
      return updatedEntries;
    });
    validateField(index, field);
  };

  const handleProductInputChange = async (index, value) => {
    if (!branch) {
      console.error("Branch is undefined. Cannot fetch product details.");
      setProductEntries((prevEntries) => {
        const updatedEntries = [...prevEntries];
        updatedEntries[index] = {
          ...updatedEntries[index],
          stock: 0, // Assume no stock if branch is missing
        };
        return updatedEntries;
      });
      return;
    }

    const productDetails = await fetchProductDetailsFromDatabase(value, branch);
    if (productDetails) {
      setProductEntries((prevEntries) => {
        const updatedEntries = [...prevEntries];
        updatedEntries[index] = {
          id: productDetails.product_id,
          name: productDetails.product_name,
          price: productDetails.mrp || "",
          stock: productDetails.stock || 0,
          quantity: prevEntries[index].quantity || "", // Preserve quantity
        };
        return updatedEntries;
      });

      if (productDetails.stock > 0) {
        setTimeout(() => {
          quantityRefs.current[index]?.focus();
        }, 100);
      }
    } else {
      setProductEntries((prevEntries) => {
        const updatedEntries = [...prevEntries];
        updatedEntries[index] = {
          ...updatedEntries[index],
          stock: 0, // Assume no stock if fetching fails
        };
        return updatedEntries;
      });
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
        setErrorMessage("Sales not found");
        return;
      }

      // Populate form fields with the fetched data
      setSalesOrderId(data.sales_order_id);
      setProductEntries(
        data.items || [{ id: "", name: "", price: "", quantity: "" }]
      );
      setOriginalProductEntries(
        data.items || [{ id: "", name: "", price: "", quantity: "" }]
      ); // Store original entries
      setMrNumber(data.mr_number || "");
      setPhoneNumber(data.patient_phone || "");
      setAdvanceDetails(data.advance_details || "");
      setEmployee(data.employee || "");
      setPaymentMethod(data.payment_method || "");
      setLoyaltyPoints(data.loyalty_points_redeemed || 0);
      setPrivilegeCard(true);
      setPrivilegeCardNumber(data.pc_number || "");
      setSelectedWorkOrder(
        data.work_order_id ? { work_order_id: data.work_order_id } : null
      );

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
      console.error("Error fetching sales:", error);
      setErrorMessage("Failed to fetch sales");
    }
  };

  useEffect(() => {
    if (orderId) {
      setIsEditing(true);
      fetchExistingSalesOrder(orderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Function to fetch and set a new sales ID when the branch is available
  const fetchSalesOrderId = async () => {
    if (branch && !isEditing) {
      // Only generate ID if not editing
      setIsGeneratingId(true);
      const newSalesOrderId = await generateSalesOrderId();
      if (newSalesOrderId) {
        setSalesOrderId(newSalesOrderId);
        setErrorMessage("");
      } else {
        setErrorMessage("Failed to generate sales ID.");
      }
      setIsGeneratingId(false);
    }
  };

  useEffect(() => {
    if (branch) {
      console.log("Fetching sales ID for branch:", branch);
      fetchSalesOrderId();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

  const {
    subtotal,
    cgstAmount,
    sgstAmount,
    discount,
    advance,
    privilegeDiscount,
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
        selectedWorkOrder,
        discountPercentage
      ),
    [
      productEntries,
      advanceDetails,
      privilegeCard,
      privilegeCardDetails,
      redeemPointsAmount,
      loyaltyPoints,
      selectedWorkOrder,
      discountPercentage,
    ]
  );


  // Function to fetch patient by MR number
  const fetchPatientByMRNumber = async (mrNumber) => {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("mr_number", mrNumber)
      .single();

    if (error) {
      console.error("Error fetching patient details:", error.message);
      return null;
    }
    return data;
  };


  // Calculate discountAmount
  const discountAmount = discount;

  // Function to remove a product entry
  const removeProductEntry = (index) => {
    const updatedEntries = productEntries.filter((_, i) => i !== index);
    setProductEntries(updatedEntries);
    const updatedOriginalEntries = originalProductEntries.filter(
      (_, i) => i !== index
    );
    setOriginalProductEntries(updatedOriginalEntries); // Update original entries accordingly
    const updatedSuggestions = [...productSuggestions];
    updatedSuggestions.splice(index, 1);
    setProductSuggestions(updatedSuggestions);
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
        setRedeemOption(null);
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
  const handleFetchWorkOrders = async () => {
    try {
      let query = supabase.from("work_orders").select("*");

      if (fetchMethod === "work_order_id") {
        query = query.eq("work_order_id", searchQuery);
      } else if (fetchMethod === "mr_number") {
        // Fetch work orders by MR Number directly
        query = query.eq("mr_number", searchQuery);
      } else if (fetchMethod === "phone_number") {
        // Fetch work orders associated with customers having the phone number
        const { data: customers, error: customerError } = await supabase
          .from("customers")
          .select("id")
          .eq("phone_number", searchQuery);

        if (customerError) {
          console.error("Error fetching customers:", customerError.message);
          setErrorMessage("Failed to fetch customers.");
          return;
        }

        if (customers.length === 0) {
          setWorkOrders([]);
          setErrorMessage("No customers found with this phone number.");
          return;
        }

        const customerIds = customers.map((customer) => customer.id);
        query = query.in("customer_id", customerIds);
      }

      // Exclude work orders that are already used
      query = query.eq("is_used", false);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("Error fetching work orders:", error.message);
        setErrorMessage("Failed to fetch work orders.");
      } else {
        setWorkOrders(data);

        // Clear any previous error messages
        setErrorMessage("");

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
  };


  function handleSelectWorkOrder(workOrder) {
    setSelectedWorkOrder(workOrder);
    setShowWorkOrderModal(true);
  }

  async function confirmWorkOrderSelection() {
    // Set relevant data from the work order
    setMrNumber(selectedWorkOrder.mr_number);
    setAdvanceDetails(selectedWorkOrder.advance_details || "");
    setHasMrNumber("yes");

    if (selectedWorkOrder.product_entries) {
      setProductEntries(selectedWorkOrder.product_entries);
      setOriginalProductEntries(selectedWorkOrder.product_entries); // Update original entries
    }

    setShowWorkOrderModal(false);
    // Automatically fetch patient details
    if (selectedWorkOrder.mr_number) {
      const patient = await fetchPatientByMRNumber(selectedWorkOrder.mr_number.trim());

      if (patient) {
        setPatientDetails({
          name: patient.name,
          age: patient.age,
          condition: patient.condition || "N/A",
          phone_number: patient.phone_number || "N/A",
          gender: patient.gender || "N/A",
          address: patient.address || "N/A",
        });
        setErrorMessage("");
      } else {
        setPatientDetails(null);
        setErrorMessage("No patient found with the provided MR Number from Work Order.");
      }
    } else {
      setPatientDetails(null);
      setErrorMessage("Selected Work Order does not contain an MR Number.");
    }

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
          discountPercentage,
        },
      },
    });
  };

  useEffect(() => {
    const locationState = location.state;
    if (locationState?.from === "privilege-generation") {
      setStep(locationState.step);
      setIsEditing(true);

      const data = locationState.formData;
      if (data) {
        setProductEntries(data.productEntries);
        setOriginalProductEntries(data.productEntries); // Set original entries
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
        setDiscountPercentage(data.discountPercentage || "");

        // If privilegeCardDetails are available, set them
        if (data.privilegeCardDetails) {
          setPrivilegeCardDetails(data.privilegeCardDetails);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      focusFirstFieldOfStep();
    }, 100); // Add a slight delay to ensure the element is mounted

    return () => clearTimeout(focusTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, privilegeCard, redeemOption]);

  const handleEnterKey = (e, nextFieldRef, prevFieldRef) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Handle Shift+Enter if needed
        if (prevFieldRef?.current) {
          e.preventDefault();
          prevFieldRef.current.focus();
        }
      } else {
        e.preventDefault();
        if (nextFieldRef?.current) {
          nextFieldRef.current.focus();
        } else {
          e.target.click();
        }
      }
    }
    // Handle Arrow Keys for navigation
    else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (nextFieldRef?.current) {
        nextFieldRef.current.focus();
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (prevFieldRef?.current) {
        prevFieldRef.current.focus();
      }
    }
  };

  // Function to fetch product details from Supabase
  const fetchProductDetailsFromDatabase = async (productId, branch) => {
    console.log(
      "Fetching product details for productId:",
      productId,
      "and branch:",
      branch
    );
    if (!branch) {
      console.error("Branch code is undefined or missing.");
      return null; // Prevent further execution
    }

    try {
      // Step 1: Fetch the product details
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("product_id", productId)
        .single();

      if (productError || !productData) {
        console.error("Error fetching product details:", productError);
        return null;
      }

      // Step 2: Fetch stock information
      const { data: stockData, error: stockError } = await supabase
        .from("stock")
        .select("quantity")
        .eq("product_id", productData.id) // Note: product_id here refers to products.id
        .eq("branch_code", branch)
        .single();

      if (stockError || !stockData) {
        console.error("Error fetching stock:", stockError);
        return { ...productData, stock: 0 }; // Default stock to 0 if error occurs
      }

      return { ...productData, stock: stockData.quantity || 0 };
    } catch (error) {
      console.error("Unexpected error:", error);
      return null;
    }
  };

  const validateField = (index, field) => {
    const errors = { ...validationErrors };

    if (field === "id" && !productEntries[index].id) {
      errors[`productId-${index}`] = "Product ID is required";
    } else if (field === "price" && !productEntries[index].price) {
      errors[`productPrice-${index}`] = "Price is required";
    } else if (field === "quantity" && productEntries[index].stock > 0) {
      const quantity = parseInt(productEntries[index].quantity, 10);
      if (!quantity) {
        errors[`productQuantity-${index}`] = "Quantity is required";
      } else if (quantity <= 0) {
        errors[`productQuantity-${index}`] =
          "Quantity must be greater than zero";
      } else if (quantity > productEntries[index].stock) {
        errors[
          `productQuantity-${index}`
        ] = `Quantity cannot exceed available stock (${productEntries[index].stock})`;
      } else {
        delete errors[`productQuantity-${index}`];
      }
    } else {
      delete errors[
        `product${field.charAt(0).toUpperCase() + field.slice(1)}-${index}`
      ];
    }

    setValidationErrors(errors);
  };

  const nextStep = async () => {
    const errors = {};

    // Validate each step before proceeding
    if (step === 0) {
      if (!searchQuery.trim())
        errors.searchQuery =
          "Work Order ID, MR Number, or Phone Number is required";
      // Removed branchCode validation as branch is fetched from context
    } else if (step === 1) {
      // Check if any product has stock <=0
      const stockIssues = productEntries.filter(
        (product) => product.stock <= 0
      );
      if (stockIssues.length > 0) {
        errors.stock =
          "One or more products have zero or negative stock. Please adjust.";
      }

      productEntries.forEach((product, index) => {
        if (!product.id)
          errors[`productId-${index}`] = "Product ID is required";
        if (!product.price)
          errors[`productPrice-${index}`] = "Price is required";
        if (product.stock > 0 && !product.quantity)
          errors[`productQuantity-${index}`] = "Quantity is required";
        else if (product.stock > 0) {
          const quantity = parseInt(product.quantity, 10);
          if (isNaN(quantity) || quantity <= 0) {
            errors[`productQuantity-${index}`] = "Enter a valid quantity";
          } else if (quantity > product.stock) {
            errors[
              `productQuantity-${index}`
            ] = `Cannot exceed stock (${product.stock})`;
          }
        }
      });
    } else if (step === 2) {
      if (hasMrNumber === "yes") {
        if (!mrNumber) {
          errors.mrNumber = "MR number is required";
        }
      } else if (hasMrNumber === "no") {
        if (!customerName.trim()) {
          errors.customerName = "Customer name is required";
        }
        if (!customerPhone.trim()) {
          errors.customerPhone = "Customer phone number is required";
        } else if (!/^\d{10}$/.test(customerPhone)) {
          errors.customerPhone = "Please enter a valid 10-digit phone number";
        }
      }
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
      if (discountPercentage !== "" && (parseFloat(discountPercentage) < 0 || parseFloat(discountPercentage) > 100)) {
        errors.discountPercentage =
          "Discount percentage must be between 0 and 100";
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

  const prevStep = () => {
    setValidationErrors({});
    setIsPinVerified(false); // Reset PIN verification if going back
    setStep((prevStep) => (prevStep > 0 ? prevStep - 1 : 0));
  };

  const handleMRNumberSearch = async () => {
    if (!mrNumber.trim()) {
      setErrorMessage("MR Number is required.");
      return;
    }

    const patient = await fetchPatientByMRNumber(mrNumber.trim());

    if (patient) {
      setPatientDetails({
        name: patient.name,
        age: patient.age,
        condition: patient.condition || "N/A",
        phone_number: patient.phone_number || "N/A",
        gender: patient.gender || "N/A",
        address: patient.address || "N/A",
      });
      setErrorMessage("");
      nextButtonRef.current?.focus();
    } else {
      setPatientDetails(null);
      setErrorMessage("No patient found with the provided MR Number.");
    }
  };


  const focusFirstFieldOfStep = () => {
    if (step === 0) workOrderInputRef.current?.focus();
    if (step === 1) document.getElementById(`productId-0`)?.focus();
    if (step === 2) {
      // Focus on Yes button
      document.getElementById("hasMrNumber-yes")?.focus();
    }
    if (step === 3 && privilegeCard) {
      if (redeemOption === "barcode") {
        privilegeCardRef.current?.focus();
      } else if (redeemOption === "phone") {
        privilegePhoneRef.current?.focus();
      }
    }
    if (step === 4) employeeRef.current?.focus();
    if (step === 5) discountInputRef.current?.focus(); // Updated to focus on discount field
  };

  // Function to fetch product details from Supabase

  const handleOrderCompletion = async () => {
    const currentUTCDateTime = getCurrentUTCDateTime();
    setIsLoading(true);

    try {
      // Step 1: Handle Loyalty Points Update (if applicable)
      if (privilegeCard && privilegeCardDetails) {
        const { updatedPoints, pointsToRedeem, pointsToAdd } =
          calculateLoyaltyPoints(
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

      // Step 2: Prepare Variables for sales Data
      const sanitizedRedeemedPoints = privilegeCard
        ? parseInt(redeemPointsAmount) || 0
        : 0;
      const sanitizedPointsAdded = privilegeCard ? pointsToAdd || 0 : 0;

      // Step 3: Handle Existing sales Update
      if (isEditing) {
        // a. Calculate Differences
        const differences = calculateProductDifferences(
          originalProductEntries,
          productEntries
        );

        // b. Update Stock Levels
        for (const { productId, diff } of differences) {
          if (diff === 0) continue; // No change

          // Fetch current stock
          const { data: stockData, error: stockError } = await supabase
            .from("stock")
            .select("quantity")
            .eq("product_id", productId)
            .eq("branch_code", branch)
            .single();

          if (stockError || !stockData) {
            console.error(
              `Error fetching stock for product ${productId}:`,
              stockError
            );
            setErrorMessage(
              `Failed to fetch stock for product ID: ${productId}`
            );
            return;
          }

          const newStock = stockData.quantity - diff; // Deduct if diff > 0, add if diff < 0

          if (newStock < 0) {
            setErrorMessage(
              `Insufficient stock for product ID: ${productId}. Cannot reduce stock below zero.`
            );
            return;
          }

          // Update stock
          const { error: updateStockError } = await supabase
            .from("stock")
            .update({ quantity: newStock })
            .eq("product_id", productId)
            .eq("branch_code", branch);

          if (updateStockError) {
            console.error(
              `Error updating stock for product ${productId}:`,
              updateStockError
            );
            setErrorMessage(
              `Failed to update stock for product ID: ${productId}`
            );
            return;
          }
        }

        // c. Update sales
        const { error: updateError } = await supabase
          .from("sales_orders")
          .update({
            items: productEntries,
            advance_details: parseFloat(advance) || 0,
            mr_number: hasMrNumber === "yes" ? mrNumber : null,
            patient_phone: hasMrNumber === "yes" ? phoneNumber : customerPhone,
            employee: employee,
            payment_method: paymentMethod,
            subtotal: subtotal,
            cgst: parseFloat(cgstAmount),
            sgst: parseFloat(sgstAmount),
            total_amount: finalAmount,
            discount: discount,
            privilege_discount: privilegeDiscount, // Updated field
            final_amount: finalAmount,
            loyalty_points_redeemed: sanitizedRedeemedPoints,
            loyalty_points_added: sanitizedPointsAdded,
            updated_at: currentUTCDateTime,
            branch: branch,
          })
          .eq("sales_order_id", salesOrderId);

        if (updateError) {
          console.error("Error updating sales:", updateError);
          setErrorMessage("Failed to update sales.");
          return;
        }

        // Update modification status to completed
        const { error: modUpdateError } = await supabase
          .from("modification_requests")
          .update({ status: "completed" })
          .eq("order_id", salesOrderId);

        if (modUpdateError) {
          console.error("Error updating modification status:", modUpdateError);
          setErrorMessage("Failed to update modification status.");
          return;
        }

        alert("Sales updated successfully!");
      } else {
        // Step 4: Insert New sales
        const newSalesOrderId = await generateSalesOrderId();
        const { error: insertError } = await supabase
          .from("sales_orders")
          .insert({
            sales_order_id: newSalesOrderId,
            work_order_id: selectedWorkOrder
              ? selectedWorkOrder.work_order_id
              : null,
            items: productEntries,
            advance_details: parseFloat(advanceDetails) || 0,
            mr_number: hasMrNumber === "yes" ? mrNumber : null,
            patient_phone: hasMrNumber === "yes" ? phoneNumber : customerPhone,
            employee: employee,
            payment_method: paymentMethod,
            subtotal: subtotal,
            discount: discount,
            advance_details: advance, // Assuming you have an 'advance_paid' field
            privilege_discount: privilegeDiscount, // Updated field
            cgst: parseFloat(cgstAmount),
            sgst: parseFloat(sgstAmount),
            final_amount: finalAmount, // Correct final amount including GST
            loyalty_points_redeemed: sanitizedRedeemedPoints,
            loyalty_points_added: sanitizedPointsAdded,
            updated_at: currentUTCDateTime,
            branch: branch,
          })
          .eq("sales_order_id", salesOrderId);


        if (insertError) {
          console.error("Error inserting sales:", insertError);
          setErrorMessage("Failed to create sales.");
          return;
        }

        // Update modification status to completed
        const { error: modInsertError } = await supabase
          .from("modification_requests")
          .update({ status: "completed" })
          .eq("order_id", newSalesOrderId);

        if (modInsertError) {
          console.error("Error updating modification status:", modInsertError);
          setErrorMessage("Failed to update modification status.");
          return;
        }

        alert("Sales created successfully!");

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

        const deductResponse = await deductStockForMultipleProducts(
          deductions,
          branch
        );
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
          .eq("order_id", isEditing ? salesOrderId : newSalesOrderId);
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
    setOriginalProductEntries([{ id: "", name: "", price: "", quantity: "" }]); // Reset original entries
    setPatientDetails(null);
    setPrivilegeCard(true);
    setPhoneNumber("");
    setOtp("");
    setIsOtpVerified(false);
    setEmployee("");
    setAllowPrint(false);
    setAdvanceDetails("");
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
    setProductSuggestions([]);
    setFetchMethod("work_order_id");
    setSearchQuery("");
    setDiscountPercentage("");
  };

  // Confirm and reset the form
  const handleExit = () => {
    if (
      window.confirm(
        "Are you sure you want to exit? Unsaved changes will be lost."
      )
    ) {
      resetForm();
      navigate("/home");
    }
  };

  const handlePrint = () => {
    setAllowPrint(true);
    window.print(); // Simply call print without extra state changes
  };



  // Conditional Fields for Step 2
  const [hasMrNumber, setHasMrNumber] = useState(null); // 'yes' or 'no'
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Function to fetch work orders by different methods
  // Already handled in handleFetchWorkOrders

  return (
    <div
      className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
        } justify-center mt-16 p-4 mx-auto`}
    >
      {/* Print Styles */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-area, .printable-area * {
              visibility: visible;
            }
            .printable-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
          }
        `}
      </style>

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
                          <th className="py-1 px-2">Product ID</th>
                          <th className="py-1 px-2">Product Name</th>
                          <th className="py-1 px-2">Price</th>
                          <th className="py-1 px-2">Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWorkOrder.product_entries.map(
                          (product, index) => (
                            <tr key={index} className="text-center">
                              <td className="py-1 px-2">{product.id}</td>
                              <td className="py-1 px-2">
                                {product.name}
                              </td>
                              <td className="py-1 px-2">
                                {product.price}
                              </td>
                              <td className="py-1 px-2">
                                {product.quantity}
                              </td>
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
        Sales Generation
      </h1>

      {/* Editing Indicator */}
      {isEditing && (
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg mb-6">
          <p>You are editing an existing sales (ID: {salesOrderId}).</p>
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

              {/* Select Fetch Method */}
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-1">
                  Fetch Work Orders By:
                </label>
                <div className="flex space-x-4">
                  <button
                    type="button" // Added type="button"
                    onClick={() => setFetchMethod("work_order_id")}
                    className={`px-4 py-2 rounded-lg ${fetchMethod === "work_order_id"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                      }`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        document.getElementById("fetchMethod-mr_number")?.focus();
                      }
                    }}
                  >
                    Work Order ID
                  </button>
                  <button
                    type="button" // Added type="button"
                    onClick={() => setFetchMethod("mr_number")}
                    id="fetchMethod-mr_number"
                    className={`px-4 py-2 rounded-lg ${fetchMethod === "mr_number"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                      }`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        document.getElementById("fetchMethod-phone_number")?.focus();
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        document.getElementById("fetchMethod-work_order_id")?.focus();
                      }
                    }}
                  >
                    MR Number
                  </button>
                  <button
                    type="button" // Added type="button"
                    onClick={() => setFetchMethod("phone_number")}
                    id="fetchMethod-phone_number"
                    className={`px-4 py-2 rounded-lg ${fetchMethod === "phone_number"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                      }`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        document.getElementById("fetchMethod-mr_number")?.focus();
                      }
                    }}
                  >
                    Phone Number
                  </button>
                </div>
              </div>

              {/* Enter Work Order ID, MR Number, or Phone Number */}
              <label className="block text-gray-700 font-medium mb-1">
                {fetchMethod === "work_order_id"
                  ? "Enter Work Order ID"
                  : fetchMethod === "mr_number"
                    ? "Enter MR Number"
                    : "Enter Phone Number"}
              </label>
              <input
                type="text"
                placeholder={
                  fetchMethod === "work_order_id"
                    ? "Work Order ID"
                    : fetchMethod === "mr_number"
                      ? "MR Number"
                      : "Phone Number"
                }
                value={searchQuery}
                ref={workOrderInputRef}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFetchWorkOrders();
                  }
                  // Handle Arrow Keys for navigation
                  else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    fetchButtonRef.current?.focus();
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
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    workOrderInputRef.current?.focus();
                  }
                }}
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
                              <strong>Work Order ID:</strong>{" "}
                              {workOrder.work_order_id}
                            </p>
                            <p>
                              <strong>Description:</strong>{" "}
                              {workOrder.description}
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
                            onKeyDown={(e) => {
                              if (e.key === "ArrowRight") {
                                e.preventDefault();
                                if (index < workOrders.length - 1) {
                                  document
                                    .getElementById(`workOrderButton-${index + 1}`)
                                    ?.focus();
                                } else {
                                  proceedButtonRef.current?.focus();
                                }
                              } else if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                if (index > 0) {
                                  document
                                    .getElementById(`workOrderButton-${index - 1}`)
                                    ?.focus();
                                }
                              }
                            }}
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
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        fetchButtonRef.current?.focus();
                      }
                    }}
                  >
                    Proceed to Step 1
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Product Details */}
          {step === 1 && (
            <div className="w-full bg-gray-50 p-6 rounded-md shadow-inner space-y-6">
              <h2 className="text-lg font-semibold text-gray-700 text-center">
                Product Information
              </h2>
              <label className="block text-gray-700 font-medium mb-1">
                Generated Sales ID
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
                            const updatedSuggestions = [...productSuggestions];
                            if (value) {
                              updatedSuggestions[index] =
                                await fetchProductSuggestions(value, "id");
                            } else {
                              updatedSuggestions[index] = [];
                            }
                            setProductSuggestions(updatedSuggestions);

                            setProductEntries((prevEntries) => {
                              const updatedEntries = [...prevEntries];
                              updatedEntries[index].id = value; // Update ID field
                              return updatedEntries;
                            });
                            await handleProductInputChange(index, value); // Fetch product details
                          }}
                          onBlur={async () => {
                            const selectedProduct = productSuggestions[
                              index
                            ]?.find(
                              (prod) =>
                                prod.product_id === productEntries[index].id
                            );
                            if (selectedProduct) {
                              // Automatically fetch data and move focus to quantity
                              const productDetails =
                                await fetchProductDetailsFromDatabase(
                                  selectedProduct.product_id,
                                  branch
                                );
                              if (productDetails) {
                                setProductEntries((prevEntries) => {
                                  const updatedEntries = [...prevEntries];
                                  updatedEntries[index] = {
                                    id: productDetails.product_id,
                                    name: productDetails.product_name,
                                    price: productDetails.mrp || "",
                                    stock: productDetails.stock || 0,
                                    quantity: prevEntries[index].quantity || "", // Preserve quantity
                                  };
                                  return updatedEntries;
                                });
                                if (productDetails.stock > 0) {
                                  setTimeout(() => {
                                    quantityRefs.current[index]?.focus();
                                  }, 100);
                                }
                              }
                            }
                          }}
                          list={`productIdSuggestions-${index}`}
                          className="border border-gray-300 px-4 py-3 rounded-lg w-full"
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              document.getElementById(`productQuantity-${index}`)?.focus();
                            }
                          }}
                        />
                        <datalist id={`productIdSuggestions-${index}`}>
                          {productSuggestions[index] &&
                            productSuggestions[index].map((suggestion) => (
                              <option
                                key={suggestion.product_id}
                                value={suggestion.product_id}
                              />
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
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Price"
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

                      {/* Quantity Input */}
                      <div className="relative w-2/4">
                        {product.stock === 0 ? (
                          <input
                            type="text"
                            value="Out of Stock"
                            readOnly
                            className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center bg-red-100 text-red-600"
                          />
                        ) : (
                          <input
                            type="number"
                            id={`productQuantity-${index}`}
                            placeholder="Quantity"
                            value={product.quantity}
                            onChange={(e) =>
                              handleProductChange(
                                index,
                                "quantity",
                                e.target.value
                              )
                            }
                            className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center"
                            min="1"
                            max={product.stock} // Prevent ordering more than available stock
                            ref={(el) => (quantityRefs.current[index] = el)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (e.shiftKey) {
                                  // Shift + Enter: Add new product field and focus on first product ID
                                  setProductEntries([
                                    ...productEntries,
                                    { id: "", name: "", price: "", quantity: "" },
                                  ]);
                                  setOriginalProductEntries([
                                    ...originalProductEntries,
                                    { id: "", name: "", price: "", quantity: "" },
                                  ]);
                                  setProductSuggestions([...productSuggestions, []]);
                                  setTimeout(() => {
                                    document.getElementById(`productId-${productEntries.length}`)?.focus();
                                  }, 0);
                                } else {
                                  // Enter: Proceed to the next step
                                  nextStep();
                                }
                              }
                              // Existing Arrow Key Handling
                              else if (e.key === "ArrowRight") {
                                e.preventDefault();
                                e.target.parentElement.nextSibling?.focus();
                              } else if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                document.getElementById(`productPrice-${index}`)?.focus();
                              }
                            }}
                          />
                        )}
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
                        onKeyDown={(e) => {
                          if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            document.getElementById(`productQuantity-${index}`)?.focus();
                          }
                        }}
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                <button
                  type="button" // Added type="button"
                  onClick={() => {
                    setProductEntries([
                      ...productEntries,
                      { id: "", name: "", price: "", quantity: "" },
                    ]);
                    setOriginalProductEntries([
                      ...originalProductEntries,
                      { id: "", name: "", price: "", quantity: "" },
                    ]); // Update original entries
                    setProductSuggestions([...productSuggestions, []]);
                    setTimeout(
                      () =>
                        document
                          .getElementById(`productId-${productEntries.length}`)
                          ?.focus(),
                      0
                    );
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setProductEntries([
                        ...productEntries,
                        { id: "", name: "", price: "", quantity: "" },
                      ]);
                      setOriginalProductEntries([
                        ...originalProductEntries,
                        { id: "", name: "", price: "", quantity: "" },
                      ]); // Update original entries
                      setProductSuggestions([...productSuggestions, []]);
                      setTimeout(
                        () =>
                          document
                            .getElementById(
                              `productId-${productEntries.length}`
                            )
                            ?.focus(),
                        0
                      );
                    }
                  }}
                >
                  Add Product
                </button>
                {/* Stock Validation Error */}
                {validationErrors.stock && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.stock}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Patient or Customer Details */}
          {step === 2 && (
            <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Patient or Customer Information
              </h2>

              <p className="font-semibold mb-2">Do you have an MR Number?</p>
              <div className="flex space-x-4 mb-4">
                <button
                  type="button" // Added type="button"
                  id="hasMrNumber-yes"
                  onClick={() => setHasMrNumber("yes")}
                  className={`px-4 py-2 rounded-lg ${hasMrNumber === "yes"
                    ? "bg-green-500 text-white"
                    : "bg-gray-200"
                    }`}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      document.getElementById("hasMrNumber-no")?.focus();
                    }
                  }}
                >
                  Yes
                </button>
                <button
                  type="button" // Added type="button"
                  id="hasMrNumber-no"
                  onClick={() => setHasMrNumber("no")}
                  className={`px-4 py-2 rounded-lg ${hasMrNumber === "no"
                    ? "bg-green-500 text-white"
                    : "bg-gray-200"
                    }`}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      document.getElementById("hasMrNumber-yes")?.focus();
                    }
                  }}
                >
                  No
                </button>
              </div>

              {/* Conditional Fields */}
              {hasMrNumber === "yes" && (
                <>
                  <label className="block text-gray-700 font-medium mb-1">
                    Enter MR Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter MR Number"
                    value={mrNumber}
                    onChange={(e) => setMrNumber(e.target.value)}
                    onKeyDown={(e) => handleEnterKey(e, fetchButtonRef, null)}
                    ref={mrNumberRef}
                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                  />

                  {validationErrors.mrNumber && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.mrNumber}
                    </p>
                  )}
                  <button
                    type="button" // Added type="button"
                    onClick={() => {
                      handleMRNumberSearch();
                      // No need to focus next button here as focus is managed in handleMRNumberSearch
                    }}
                    ref={fetchButtonRef}
                    className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        mrNumberRef.current?.focus();
                      }
                    }}
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
                </>
              )}

              {hasMrNumber === "no" && (
                <>
                  <label className="block text-gray-700 font-medium mb-1">
                    Enter Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        customerPhoneRef.current?.focus();
                      }
                    }}
                    ref={customerNameRef}
                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                  />

                  {validationErrors.customerName && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.customerName}
                    </p>
                  )}

                  <label className="block text-gray-700 font-medium mb-1">
                    Enter Customer Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Phone Number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        customerNameRef.current?.focus();
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        // Optionally, auto-create customer or proceed
                        nextButtonRef.current?.focus();
                      }
                    }}
                    ref={customerPhoneRef}
                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                  />

                  {validationErrors.customerPhone && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.customerPhone}
                    </p>
                  )}
                </>
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
                      } else if (redeemOption === "phone") {
                        privilegePhoneRef.current?.focus();
                      }
                    }, 0);
                  }}
                  className={`px-4 py-2 rounded-lg ${privilegeCard ? "bg-green-500 text-white" : "bg-gray-200"
                    }`}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      document.getElementById("privilegeCard-no")?.focus();
                    }
                  }}
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
                  id="privilegeCard-no"
                  className={`px-4 py-2 rounded-lg ${!privilegeCard ? "bg-green-500 text-white" : "bg-gray-200"
                    }`}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      document.getElementById("privilegeCard-yes")?.focus();
                    }
                  }}
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
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight") {
                          e.preventDefault();
                          document.getElementById("redeemOption-phone")?.focus();
                        } else if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          document.getElementById("redeemOption-barcode")?.focus();
                        }
                      }}
                      id="redeemOption-barcode"
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
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          document.getElementById("redeemOption-barcode")?.focus();
                        }
                      }}
                      id="redeemOption-phone"
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
                        onKeyDown={(e) => {
                          if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            document.getElementById("redeemOption-barcode")?.focus();
                          }
                        }}
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
                          if (e.key === "ArrowRight") {
                            e.preventDefault();
                            // Optionally, move to Send OTP button
                            // Assuming there is no next field
                          }
                          if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            document.getElementById("redeemOption-phone")?.focus();
                          }
                        }}
                      />

                      {/* Send OTP Button */}
                      {!isOtpSent && (
                        <button
                          type="button" // Added type="button"
                          onClick={handleSendOtp}
                          className="mt-4 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg w-full"
                          onKeyDown={(e) => {
                            if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              privilegePhoneRef.current?.focus();
                            }
                          }}
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
                              if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                document.getElementById("redeemOption-phone")?.focus();
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
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleVerifyOtp();
                                setTimeout(() => {
                                  nextButtonRef.current?.focus();
                                }, 0);
                              }
                            }}
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
                ref={employeeRef}
                onBlur={validateEmployeeSelection}
                className="border border-gray-300 w-full px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
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
            </div>
          )}

          {step === 5 && (
            <>
              {/* Embedded Print Styles */}
              <style>
                {`
        @media print {
          @page {
            size: A5;
            margin: 10mm;
          }

          body * {
            visibility: hidden;
          }

          .printable-area, .printable-area * {
            visibility: visible;
          }

          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            font-size: 10px; /* Adjust base font size */
            padding: 5mm; /* Adjust padding to fit A5 */
          }

          .printable-area h2 {
            font-size: 14px; /* Smaller heading */
          }

          .printable-area table {
            font-size: 9px; /* Smaller table text */
            table-layout: fixed;
            width: 100%;
            word-wrap: break-word;
          }

          .printable-area table th,
          .printable-area table td {
            padding: 3px; /* Reduce cell padding */
          }

          .financial-summary p,
          .invoice-details p,
          .loyalty-points p {
            font-size: 10px; /* Consistent text size */
          }

          /* Hide action buttons during print */
          .action-buttons {
            display: none;
          }

          /* Ensure images (like logos) are scaled appropriately */
          .printable-area img {
            max-width: 100px; /* Adjust as needed */
            height: auto;
          }
        }
      `}
              </style>

              {/* Printable Area */}
              <div
                className="printable-area bg-white rounded-lg text-gray-800"
                ref={billPrintRef} // Attach the ref here
              >
                {/* Invoice Details */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <h2 className="text-xl font-semibold mt-2">Bill</h2>
                  <div>
                    <p>
                      <span className="font-semibold">Sales ID:</span> {salesOrderId}
                    </p>
                    {hasMrNumber === "yes" && patientDetails ? (
                      <>
                        <p>
                          <span className="font-semibold">MR Number:</span> {mrNumber}
                        </p>
                        <p>
                          <span className="font-semibold">Name:</span> {patientDetails.name}
                        </p>
                        <p>
                          <span className="font-semibold">Age:</span> {patientDetails.age}
                        </p>
                        <p>
                          <span className="font-semibold">Phone Number:</span> {patientDetails.phone_number}
                        </p>
                        <p>
                          <span className="font-semibold">Gender:</span> {patientDetails.gender}
                        </p>
                        <p>
                          <span className="font-semibold">Address:</span> {patientDetails.address}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <span className="font-semibold">Customer Name:</span> {customerName || "N/A"}
                        </p>
                        <p>
                          <span className="font-semibold">Customer Phone:</span> {customerPhone || "N/A"}
                        </p>
                      </>
                    )}
                    <p>
                      <span className="font-semibold">Billed by:</span> {employee}
                    </p>
                  </div>
                </div>

                {/* Product Table */}
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full table-auto border border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-1 px-2 border-b text-left text-sm">Product ID</th>
                        <th className="py-1 px-2 border-b text-left text-sm">Product Name</th>
                        <th className="py-1 px-2 border-b text-left text-sm">HSN Code</th>
                        <th className="py-1 px-2 border-b text-right text-sm">Price (₹)</th>
                        <th className="py-1 px-2 border-b text-right text-sm">Quantity</th>
                        <th className="py-1 px-2 border-b text-right text-sm">Subtotal (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productEntries.map((product, index) => {
                        const adjustedPrice = (parseFloat(product.price) / 112) * 100 || 0;
                        const productSubtotal = adjustedPrice * (parseInt(product.quantity) || 0);
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="py-1 px-2 border-b text-sm">{product.id}</td>
                            <td className="py-1 px-2 border-b text-sm">
                              <span className="whitespace-normal">{product.name}</span>
                            </td>
                            <td className="py-1 px-2 border-b text-sm">9001</td>
                            <td className="py-1 px-2 border-b text-right text-sm">
                              {adjustedPrice.toFixed(2)}
                            </td>
                            <td className="py-1 px-2 border-b text-right text-sm">
                              {product.quantity}
                            </td>
                            <td className="py-1 px-2 border-b text-right text-sm">
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
                  {/* Left Column: Subtotal and GST */}
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold">Subtotal:</span> ₹{subtotal.toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">CGST (6%):</span> ₹{cgstAmount.toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">SGST (6%):</span> ₹{sgstAmount.toFixed(2)}
                    </p>
                  </div>

                  {/* Right Column: Discounts, Advances, and Total */}
                  <div className="space-y-2">
                    <p>
                      <span className="font-semibold">Discount ({discountPercentage}%):</span> ₹{discount.toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">Advance Paid:</span> ₹{advance.toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">Privilege Card Discount:</span> ₹{privilegeDiscount.toFixed(2)}
                    </p>
                    <hr className="border-gray-400 my-2" />
                    <p className="font-semibold">
                      Total Amount Including GST: ₹{finalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Loyalty Points Information */}
                {privilegeCard && privilegeCardDetails && (
                  <div className="loyalty-points mb-6">
                    <p>
                      <span className="font-semibold">Loyalty Points Redeemed:</span> ₹{redeemPointsAmount.toFixed(2)}
                    </p>
                    <p>
                      <span className="font-semibold">Loyalty Points Gained:</span> {pointsToAdd}
                    </p>
                  </div>
                )}

                {/* Payment Method and Discount Details */}
                <div className="flex flex-col md:flex-row items-center justify-between my-6 space-x-4">
                  {/* Discount Section */}
                  <div className="w-full md:w-1/2 mb-4 md:mb-0">
                    <label className="block text-gray-700 font-medium mb-1">Apply Discount (%)</label>
                    <input
                      type="number"
                      placeholder="Enter Discount Percentage"
                      value={discountPercentage}
                      onChange={(e) =>
                        setDiscountPercentage(
                          e.target.value === ""
                            ? ""
                            : Math.min(Math.max(Number(e.target.value), 0), 100)
                        )
                      }
                      className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                      min="0"
                      max="100"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          paymentMethodRef.current?.focus();
                        }
                      }}
                      ref={discountInputRef} // Attach the ref here
                    />
                    {validationErrors.discountPercentage && (
                      <p className="text-red-500 text-xs mt-1">
                        {validationErrors.discountPercentage}
                      </p>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="w-full md:w-1/2">
                    <label htmlFor="paymentMethod" className="block font-semibold mb-1">
                      Payment Method:
                    </label>
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      ref={paymentMethodRef}
                      onKeyDown={(e) => handleEnterKey(e, saveOrderRef)}
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
              <div className="action-buttons flex flex-col md:flex-row justify-start mt-6 space-x-6 space-y-4 md:space-y-0">
                <button
                  type="button" // Ensure the type is set to "button"
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
                  {isEditing ? "Update Order" : "Submit Order"}{" "}
                  {privilegeCard && privilegeCardDetails
                    ? "& Update Loyalty Points"
                    : ""}
                </button>
                {allowPrint && (
                  <button
                    type="button" // Ensure the type is set to "button"
                    onClick={handlePrint}
                    ref={printButtonRef}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handlePrint();
                        setTimeout(
                          () => newWorkOrderButtonRef.current?.focus(),
                          100
                        ); // Move focus to Create New after printing
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
            </>
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
                className={`bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg ${step === 4 && !isPinVerified
                  ? "opacity-50 cursor-not-allowed"
                  : ""
                  }`}
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

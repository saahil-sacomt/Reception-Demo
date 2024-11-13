// client/src/pages/SalesOrderGeneration.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { PrinterIcon, TrashIcon } from "@heroicons/react/24/outline";
import { fetchPrivilegeCardByPhone } from "../supabaseClient";
import supabase from "../supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { convertUTCToIST, getCurrentUTCDateTime, formatDateToIST } from "../utils/dateUtils";

const mockOtp = "1234";

// Dummy dataset for products
const productDatabase = [
  { id: "P001", name: "Sunglasses", price: "500" },
  { id: "P002", name: "Reading Glasses", price: "300" },
  { id: "P003", name: "Contact Lenses", price: "700" },
  { id: "P004", name: "Blue Light Glasses", price: "450" },
  { id: "P005", name: "Safety Goggles", price: "600" },
];

// Dummy branches
const branchOptions = [
  { name: 'Neyyattinkara', code: 'NTA' },
  { name: 'Old City', code: 'OCT' },
  { name: 'Downtown', code: 'DWN' },
];

// Function to fetch product details based on ID
const fetchProductDetails = (productId) => {
  return productDatabase.find((product) => product.id === productId) || null;
};

const SalesOrderGeneration = ({ isCollapsed }) => {
  const [step, setStep] = useState(0);
  const [salesOrderId, setSalesOrderId] = useState("");
  const [productEntries, setProductEntries] = useState([
    { id: "", name: "", price: "", quantity: "" },
  ]);

  const [description, setDescription] = useState("");
  const [patientDetails, setPatientDetails] = useState(null);
  const [privilegeCard, setPrivilegeCard] = useState(true);

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
  const [branchCode, setBranchCode] = useState("");
  const [isGeneratingId, setIsGeneratingId] = useState(false); // To handle loading state

  // Refs for input fields to control focus
  const descriptionRef = useRef(null);
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
  // Refs for inputs and buttons
const branchRef = useRef(null);
const workOrderInputRef = useRef(null);
const firstWorkOrderButtonRef = useRef(null);
const fetchButtonRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();


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

  // Generate Sales Order ID
  // Function to generate Sales Order ID based on the last entry in the database
  const generateSalesOrderId = async (selectedBranchCode) => {
    try {
      const financialYear = getFinancialYear();

      // Define date range for the financial year
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      const financialYearStart = currentMonth >= 4
        ? new Date(currentYear, 3, 1) // April 1st of this year
        : new Date(currentYear - 1, 3, 1); // April 1st of last year

      const financialYearEnd = currentMonth >= 4
        ? new Date(currentYear + 1, 2, 31) // March 31st of next year
        : new Date(currentYear, 2, 31); // March 31st of this year

      // Fetch the last sales order ID for the selected branch
      const { data: lastSalesOrders, error } = await supabase
        .from("sales_orders")
        .select("sales_order_id")
        .ilike("sales_order_id", `SO(${selectedBranchCode})%`)
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
      const newSalesOrderId = `SO(${selectedBranchCode})-${newCount}-${financialYear}`;

      return newSalesOrderId;
    } catch (error) {
      console.error("Error generating Sales Order ID:", error);
      return null;
    }
  };


  // Handle branch selection and generate Sales Order ID
  // Handle branch selection and generate Sales Order ID
const handleBranchSelection = async (selectedBranch) => {
  setBranchCode(selectedBranch);
  if (selectedBranch) {
    setIsGeneratingId(true);
    const newSalesOrderId = await generateSalesOrderId(selectedBranch);
    if (newSalesOrderId) {
      setSalesOrderId(newSalesOrderId);
      setErrorMessage("");
    } else {
      setErrorMessage("Failed to generate Sales Order ID.");
    }
    setIsGeneratingId(false);

    // Focus on the Work Order ID input after branch selection
    setTimeout(() => workOrderInputRef.current?.focus(), 0);
  }
};


  // Calculate amounts using useMemo
  const {
    subtotal,
    cgstAmount,
    sgstAmount,
    totalAmount,
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

  // Also, calculate discountAmount
  const discountAmount = discount;

  // Calculate amounts function
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

    // Calculate CGST and SGST as 6% of subtotal if not provided by work order
    let cgstAmount = 0;
    let sgstAmount = 0;

    if (selectedWorkOrder && selectedWorkOrder.cgst && selectedWorkOrder.sgst) {
      cgstAmount = parseFloat(selectedWorkOrder.cgst) || 0;
      sgstAmount = parseFloat(selectedWorkOrder.sgst) || 0;
    } else {
      cgstAmount = subtotal * 0.06;
      sgstAmount = subtotal * 0.06;
    }

    const totalAmount = subtotal + cgstAmount + sgstAmount;

    const remainingBalance = totalAmount - (parseFloat(advanceDetails) || 0);

    // If customer has privilege card, allow discount
    let discount = 0;
    if (privilegeCard && privilegeCardDetails && redeemPointsAmount > 0) {
      const redeemAmount = parseFloat(redeemPointsAmount) || 0;
      discount = Math.min(redeemAmount, loyaltyPoints, remainingBalance);
    }

    const finalAmount = Math.max(remainingBalance - discount, 0);

    return {
      subtotal,
      cgstAmount,
      sgstAmount,
      totalAmount,
      remainingBalance,
      discount,
      finalAmount,
    };
  }

  // Calculate loyalty points
  const calculateLoyaltyPoints = (
    subtotal,
    loyaltyPoints,
    redeemPointsAmount,
    privilegeCard,
    privilegeCardDetails
  ) => {
    let pointsToRedeem = 0;
    if (privilegeCard && privilegeCardDetails) {
      pointsToRedeem = Math.min(parseFloat(redeemPointsAmount) || 0, loyaltyPoints);
    }

    let updatedPoints = loyaltyPoints - pointsToRedeem;

    const pointsToAdd = Math.floor(subtotal * 0.05);

    updatedPoints += pointsToAdd;

    return { updatedPoints, pointsToRedeem, pointsToAdd };
  };

  // Update pointsToAdd when calculations are made
  useEffect(() => {
    const { pointsToAdd } = calculateLoyaltyPoints(
      subtotal,
      loyaltyPoints,
      redeemPointsAmount,
      privilegeCard,
      privilegeCardDetails
    );
    setPointsToAdd(pointsToAdd);
  }, [
    subtotal,
    loyaltyPoints,
    redeemPointsAmount,
    privilegeCard,
    privilegeCardDetails,
  ]);

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

    const { data, error } = await query.order("created_at", { ascending: false });

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
    setDescription(selectedWorkOrder.description);
    setMrNumber(selectedWorkOrder.mr_number);
    setAdvanceDetails(selectedWorkOrder.advance_details || 0);

    if (selectedWorkOrder.product_entries) {
      setProductEntries(selectedWorkOrder.product_entries);
    }

    setShowWorkOrderModal(false);

    // Move to the next step
    setStep(4); // Skip to privilege card step since data is already filled
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
      }, 0);
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
          description,
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
        setDescription(data.description);
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
      }
    }
  }, [location]);

  useEffect(() => {
    focusFirstFieldOfStep();
  }, [step, privilegeCard, redeemOption]);

  const focusFirstFieldOfStep = () => {
    if (step === 0) mrNumberRef.current?.focus();
    if (step === 1) document.getElementById(`productId-0`)?.focus();
    if (step === 2) descriptionRef.current?.focus();
    if (step === 3) mrNumberRef.current?.focus();
    if (step === 4 && privilegeCard) {
      if (redeemOption === "barcode") {
        privilegeCardRef.current?.focus();
      } else if (redeemOption === "phone") {
        privilegePhoneRef.current?.focus();
      }
    }
    if (step === 5) employeeRef.current?.focus();
    if (step === 6) paymentMethodRef.current?.focus();
  };

  const handleEnterKey = (e, nextFieldRef, prevFieldRef) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (prevFieldRef) {
          prevFieldRef.current?.focus();
        } else {
          prevStep();
        }
      } else {
        if (nextFieldRef) {
          nextFieldRef.current?.focus();
        } else {
          nextStep();
        }
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

  const handleProductEntryShiftEnter = (e, index, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift + Enter: Add a new product entry and focus on its Product ID field
        if (index === productEntries.length - 1 && productEntries[index].id) {
          setProductEntries([
            ...productEntries,
            { id: "", name: "", price: "", quantity: "" },
          ]);
          setTimeout(() => {
            document
              .getElementById(`productId-${productEntries.length}`)
              ?.focus();
          }, 0);
        }
      } else {
        // Regular Enter key behavior
        if (field === "id") {
          // After entering Product ID, focus on Quantity (skip Price if auto-filled)
          document.getElementById(`productQuantity-${index}`)?.focus();
        } else if (field === "quantity") {
          // After entering Quantity, move to next step if it's the last entry
          if (index === productEntries.length - 1) {
            nextStep();
          } else {
            // Focus on next product ID field
            document.getElementById(`productId-${index + 1}`)?.focus();
          }
        }
      }
    }
  };

  const nextStep = async () => {
    const errors = {};

    // Validate each step before proceeding
    if (step === 0) {
      if (!searchQuery.trim()) errors.searchQuery = "Work Order ID or MR Number is required";
      if (!branchCode.trim()) errors.branchCode = "Branch selection is required";
    } else if (step === 1) {
      productEntries.forEach((product, index) => {
        if (!product.id)
          errors[`productId-${index}`] = "Product ID is required";
        if (!product.price)
          errors[`productPrice-${index}`] = "Price is required";
        if (!product.quantity)
          errors[`productQuantity-${index}`] = "Quantity is required";
      });
    } else if (step === 2 && !description) {
      errors.description = "Description is required";
    } else if (step === 3 && !mrNumber) {
      errors.mrNumber = "MR number is required";
    } else if (step === 4 && privilegeCard) {
      if (redeemOption === "phone") {
        if (!phoneNumber.trim()) errors.phoneNumber = "Phone number is required";
        if (!otp.trim()) errors.otp = "OTP is required";
        if (!isOtpVerified) errors.otp = "Please verify the OTP";
      }
      if (
        redeemPoints &&
        (parseFloat(redeemPointsAmount) > loyaltyPoints || parseFloat(redeemPointsAmount) < 0)
      ) {
        errors.redeemPointsAmount = "Invalid redemption amount";
      }
    } else if (step === 5 && !employee) {
      errors.employee = "Employee selection is required";
    } else if (step === 6 && !paymentMethod) {
      errors.paymentMethod = "Payment method is required";
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      if (step < 6) {
        setStep((prevStep) => prevStep + 1);
      } else if (step === 6) {
        if (allowPrint) {
          await handleOrderCompletion();
        } else {
          setAllowPrint(true);
        }
      }
    }
  };

  useEffect(() => {
    if (step === 4 && !privilegeCard) {
      // If the user doesn't have a privilege card, proceed to the next step
      nextStep();
    }
  }, [privilegeCard, step]);

  const prevStep = () => setStep((prevStep) => Math.max(prevStep - 1, 0));

  const handleMRNumberSearch = async () => {
    try {
      // Dummy data for testing
      const response = {
        data: {
          name: "John Doe",
          age: 30,
          condition: "Myopia",
          advanceAmount: 500,
        },
      };
      setPatientDetails({
        name: response.data.name,
        age: response.data.age,
        condition: response.data.condition,
      });
      setAdvanceDetails(response.data.advanceAmount || 0);
      nextButtonRef.current?.focus();
    } catch (error) {
      console.error("Error fetching patient details:", error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOrderCompletion = async () => {
    try {
      const currentUTCDateTime = getCurrentUTCDateTime();

      if (privilegeCard && privilegeCardDetails) {
        // Calculate loyalty points
        const { updatedPoints, pointsToRedeem, pointsToAdd } =
          calculateLoyaltyPoints(
            subtotal,
            loyaltyPoints,
            redeemPointsAmount,
            privilegeCard,
            privilegeCardDetails
          );

        // Update loyalty points in the database
        const { error: updateError } = await supabase
          .from("privilegecards")
          .update({ loyalty_points: updatedPoints })
          .eq("pc_number", privilegeCardNumber); // Ensure correct field

        if (updateError) {
          console.error("Error updating loyalty points:", updateError);
          setErrorMessage("Failed to update loyalty points.");
        } else {
          setLoyaltyPoints(updatedPoints);
          alert("Order submitted and loyalty points updated successfully!");
        }
      }

      // Insert into sales_orders table
      const { data, error: insertError } = await supabase
        .from("sales_orders")
        .insert([
          {
            sales_order_id: salesOrderId,
            work_order_id: selectedWorkOrder
              ? selectedWorkOrder.work_order_id
              : null,
            description: description,
            advance_details: parseFloat(advanceDetails),
            mr_number: mrNumber,
            patient_phone: phoneNumber,
            employee: employee,
            payment_method: paymentMethod,
            subtotal: subtotal,
            cgst: parseFloat(cgstAmount),
            sgst: parseFloat(sgstAmount),
            total_amount: totalAmount,
            discount: discount,
            final_amount: finalAmount,
            loyalty_points_redeemed:
              privilegeCard && privilegeCardDetails ? redeemPointsAmount : 0,
            loyalty_points_added:
              privilegeCard && privilegeCardDetails ? pointsToAdd : 0,
            created_at: currentUTCDateTime, // Store in UTC
            updated_at: currentUTCDateTime,
          },
        ]);

      if (insertError) {
        console.error("Error inserting sales order:", insertError);
        setErrorMessage("Failed to insert sales order.");
      } else {
        alert("Sales order created successfully!");
        // Generate new Sales Order ID for the next order with the current branchCode
        const newSalesOrderId = await generateSalesOrderId(branchCode);
        if (newSalesOrderId) {
          setSalesOrderId(newSalesOrderId);
          // **Remove or Comment Out the resetForm() Call**
          // resetForm(); // This resets the form immediately, preventing bill printing
        } else {
          console.error("Failed to generate Sales Order ID");
          setErrorMessage("Failed to generate Sales Order ID.");
        }

        // **Enable Printing After Successful Save**
        setAllowPrint(true);
      }

      // **Ensure the Printable Area Remains Accessible**
      // Do not reset the form here to allow printing
    } catch (error) {
      console.error("Error in order submission:", error);
      setErrorMessage("Failed to complete the order.");
    }
  };

  // Function to reset the form
  const resetForm = () => {
    setProductEntries([{ id: "", name: "", price: "", quantity: "" }]);
    setDescription("");
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
    // **Optionally retain the branchCode to allow multiple orders for the same branch**
    // If you wish to reset the branchCode as well, uncomment the next line
    // setBranchCode("");
  };

  return (
    <div
      className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
        } justify-center mt-16 p-4 mx-auto`}
    >
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
                <strong>MR Number:</strong> {selectedWorkOrder.mr_number}
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
                              <td className="py-1 px-2 border-b">
                                {product.id}
                              </td>
                              <td className="py-1 px-2 border-b">
                                {product.name}
                              </td>
                              <td className="py-1 px-2 border-b">
                                {product.price}
                              </td>
                              <td className="py-1 px-2 border-b">
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
                type="button"
                onClick={confirmWorkOrderSelection}
                className="mr-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Confirm
              </button>
              <button
                type="button"
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

      {/* Progress Tracker */}
      <div className="flex items-center mb-8 w-2/3 mx-auto">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-xl mx-1 ${step > i ? "bg-[#5db76d]" : "bg-gray-300"
              } transition-all duration-300`}
          />
        ))}
      </div>

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

            {/* Branch Selection */}
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Select Branch
              </label>
              <select
                value={branchCode}
                ref={branchRef}
                onChange={(e) => handleBranchSelection(e.target.value)}
                className="border border-gray-300 w-1/3 px-4 py-3 rounded-lg"
                required
              >
                <option value="" disabled>-- Select Branch --</option>
                {branchOptions.map((branch) => (
                  <option key={branch.code} value={branch.code}>
                    {branch.name}
                  </option>
                ))}
              </select>

              {validationErrors.branchCode && (
                <p className="text-red-500 text-xs mt-1">
                  {validationErrors.branchCode}
                </p>
              )}
            </div>

            {/* Show loading indicator while generating Sales Order ID */}
            {isGeneratingId && (
              <p className="text-blue-500 text-sm">Generating Sales Order ID...</p>
            )}

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
              disabled={!branchCode || isGeneratingId} // Disable until branch is selected and ID is generated
            />

            {validationErrors.searchQuery && (
              <p className="text-red-500 text-xs mt-1">
                {validationErrors.searchQuery}
              </p>
            )}
            <button
              type="button"
              onClick={handleFetchWorkOrders}
              ref={fetchButtonRef}
              className={`mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition ${!branchCode || isGeneratingId ? "opacity-50 cursor-not-allowed" : ""
                }`}
              disabled={!branchCode || isGeneratingId} // Disable until branch is selected and ID is generated
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
                          type="button"
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
                  type="button"
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

        {/* Step 1: Sales Order ID and Product Details */}
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
            {productEntries.map((product, index) => (
              <div key={index} className="flex space-x-2 items-center">
                {/* Product ID Input */}
                <div className="relative w-1/4">
                  <input
                    type="text"
                    id={`productId-${index}`}
                    placeholder="Product ID / Scan Barcode"
                    value={product.id}
                    onChange={(e) =>
                      handleProductEntryChange(index, "id", e.target.value)
                    }
                    onKeyDown={(e) =>
                      handleProductEntryShiftEnter(e, index, "id")
                    }
                    className="border border-gray-300 px-4 py-3 rounded-lg w-full"
                  />
                  {validationErrors[`productId-${index}`] && (
                    <p className="text-red-500 text-xs absolute -bottom-9 left-0 ">
                      {validationErrors[`productId-${index}`]}
                    </p>
                  )}
                </div>

                {/* Product Name Input (auto-filled, read-only) */}
                <div className="relative w-1/2">
                  <input
                    type="text"
                    id={`productName-${index}`}
                    placeholder="Product Name"
                    value={product.name || ""}
                    readOnly // Make it read-only
                    className="border border-gray-300 px-4 py-3 rounded-lg w-full bg-gray-100"
                  />
                </div>

                {/* Product Price Input (auto-filled, editable if needed) */}
                <div className="relative w-1/4">
                  <input
                    type="text"
                    id={`productPrice-${index}`}
                    placeholder="Price"
                    value={product.price}
                    onChange={(e) =>
                      handleProductEntryChange(index, "price", e.target.value)
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
                    value={product.quantity}
                    onChange={(e) =>
                      handleProductEntryChange(
                        index,
                        "quantity",
                        e.target.value
                      )
                    }
                    onKeyDown={(e) =>
                      handleProductEntryShiftEnter(e, index, "quantity")
                    }
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
              onClick={() =>
                setProductEntries([
                  ...productEntries,
                  { id: "", name: "", price: "", quantity: "" },
                ])
              }
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
            >
              Add Product
            </button>
          </div>
        )}

        {/* Step 2: Description */}
        {step === 2 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4 text-center">
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

        {/* Step 3: Patient Details */}
        {step === 3 && (
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
              onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
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
              onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
              className="mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
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

        {/* Step 4: Privilege Card */}
        {step === 4 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">Privilege Card</h2>

            <p className="font-semibold mb-2">Do you have a Privilege Card?</p>
            <div className="flex space-x-4 mb-4">
              <button
                type="button"
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
                type="button"
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
                    type="button"
                    onClick={() => setRedeemOption("barcode")}
                    className={`px-4 py-2 rounded-lg ${redeemOption === "barcode"
                        ? "bg-green-500 text-white"
                        : "bg-gray-200"
                      }`}
                  >
                    Scan Barcode
                  </button>
                  <button
                    type="button"
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
                      <strong>Customer Name:</strong> {privilegeCardDetails.customer_name}
                    </p>
                    <p>
                      <strong>PC Number:</strong> {privilegeCardDetails.pc_number}
                    </p>
                    <p>
                      <strong>Loyalty Points:</strong> {loyaltyPoints}
                    </p>

                    {/* Redeem Points Section */}
                    <div className="mt-4">
                      <p className="font-semibold">Redeem Loyalty Points:</p>
                      <div className="flex space-x-4 mt-2">
                        <button
                          type="button"
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
                          type="button"
                          onClick={() => {
                            setRedeemOption("custom");
                            setRedeemPointsAmount("");
                            setRedeemPoints(true);
                            setTimeout(() => redeemPointsAmountRef.current?.focus(), 0); // Focus on custom amount input
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
                                  : Math.min(Number(e.target.value), loyaltyPoints)
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
                                Please enter a valid amount up to your available points.
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
                      No Privilege Card found for this {redeemOption === "phone" ? "phone number." : "PC Number."}
                    </p>
                    <button
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

        {/* Step 5: Employee Selection */}
        {step === 5 && (
          <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Order Created by Employee Details
            </h2>
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              onKeyDown={(e) => handleEnterKey(e, nextButtonRef)}
              ref={employeeRef}
              className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center"
            >
              <option value="" disabled>
                Sales Order Created By
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
          </div>
        )}

        {/* Step 6: Order Preview with Payment Method */}
        {step === 6 && (
          <div>
            {/* Printable Area */}
            <div className="printable-area print:block print:absolute print:inset-0 print:w-full bg-white p-8 rounded-lg text-gray-800">
              {/* Invoice Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold">Screenetra Eye Care</h1>
                <p className="text-sm text-gray-600">GST Number: 27AAACM1234R1Z5</p>
                <h2 className="text-2xl font-semibold mt-2">Invoice Summary</h2>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p>
                    <span className="font-semibold">Sales Order ID:</span> {salesOrderId}
                  </p>
                  <p>
                    <span className="font-semibold">Description:</span> {description}
                  </p>
                  <p>
                    <span className="font-semibold">Customer MR Number:</span> {mrNumber}
                  </p>
                  <p>
                    <span className="font-semibold">Customer Name:</span>{" "}
                    {patientDetails?.name || privilegeCardDetails?.customer_name || "N/A"}
                  </p>
                  <p>
                    <span className="font-semibold">Billed by:</span> {employee}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="font-semibold">HSN Code:</span> 12345678
                  </p>
                </div>
              </div>

              {/* Product Table */}
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Product ID</th>
                      <th className="py-2 px-4 border-b text-left">Product Name</th>
                      <th className="py-2 px-4 border-b text-right">Price (₹)</th>
                      <th className="py-2 px-4 border-b text-right">Quantity</th>
                      <th className="py-2 px-4 border-b text-right">Subtotal (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productEntries.map((product, index) => {
                      const subtotal =
                        (parseFloat(product.price) || 0) *
                        (parseInt(product.quantity) || 0);
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="py-2 px-4 border-b">{product.id}</td>
                          <td className="py-2 px-4 border-b">{product.name}</td>
                          <td className="py-2 px-4 border-b text-right">₹ {parseFloat(product.price).toFixed(2)}</td>
                          <td className="py-2 px-4 border-b text-right">{product.quantity}</td>
                          <td className="py-2 px-4 border-b text-right">₹ {subtotal.toFixed(2)}</td>
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
                    <span className="font-semibold">Subtotal:</span> ₹{subtotal.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">CGST (6%):</span> ₹{parseFloat(cgstAmount).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">SGST (6%):</span> ₹{parseFloat(sgstAmount).toFixed(2)}
                  </p>
                </div>

                {/* Right Column */}
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">Total Amount (incl. GST):</span> ₹{totalAmount.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Advance Paid:</span> ₹{parseFloat(advanceDetails).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Discount Applied:</span> ₹{discountAmount.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Balance Due:</span> ₹{finalAmount.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Loyalty Points Information */}
              {privilegeCard && privilegeCardDetails && (
                <div className="mb-6">
                  <p>
                    <span className="font-semibold">Loyalty Points Redeemed:</span> ₹{redeemPointsAmount.toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Loyalty Points Gained:</span> {pointsToAdd}
                  </p>
                </div>
              )}

              {/* Payment Method and Advance Details */}
              <div className="flex flex-col md:flex-row items-center justify-between mb-6">
                <div className="w-full md:w-1/2 mb-4 md:mb-0">
                  <label className="block font-semibold mb-1">Payment Method:</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    ref={paymentMethodRef}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveOrderRef.current?.focus();
                      }
                    }}
                    className="border border-gray-300 w-full px-4 py-2 rounded-lg"
                  >
                    <option value="" disabled>
                      Select Payment Method
                    </option>
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
              </div>
            </div>

            {/* Action Buttons Outside Printable Area */}
            <div className="flex flex-col md:flex-row justify-start mt-6 space-x-6 space-y-4 md:space-y-0">
              <button
                onClick={handleOrderCompletion}
                ref={saveOrderRef}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    await handleOrderCompletion();
                    printButtonRef.current?.focus(); // Move focus to Print button after saving
                  }
                }}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition ${!paymentMethod ? "opacity-50 cursor-not-allowed" : ""
                  } w-full md:w-auto`}
                disabled={!paymentMethod}
              >
                Submit Order {privilegeCard && privilegeCardDetails ? "& Update Loyalty Points" : ""}
              </button>
              <button
                onClick={handlePrint}
                ref={printButtonRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handlePrint();
                    newWorkOrderButtonRef.current?.focus(); // Move focus to Create New after printing
                  }
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition w-full md:w-auto"
                disabled={!allowPrint} // Disable
              >
                <PrinterIcon className="w-5 h-5 inline mr-2" />
                Print
              </button>
              <button
                onClick={async () => {
                  resetForm();
                  // Generate new Sales Order ID for the next order with the current branchCode
                  if (branchCode) {
                    setIsGeneratingId(true);
                    const newSalesOrderId = await generateSalesOrderId(branchCode);
                    if (newSalesOrderId) {
                      setSalesOrderId(newSalesOrderId);
                      localStorage.setItem("salesOrderId", newSalesOrderId); // Store in localStorage
                      setErrorMessage("");
                    } else {
                      setErrorMessage("Failed to generate Sales Order ID.");
                    }
                    setIsGeneratingId(false);
                  }
                  setStep(0); // Start from Step 0
                }}
                ref={newWorkOrderButtonRef}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // Only proceed if the order is saved (which it is after handleOrderCompletion)
                    newWorkOrderButtonRef.current?.click();
                  }
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg flex items-center justify-center w-full md:w-auto"
              >
                Create New Sales Order
              </button>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-center mt-6">
          {step > 0 && (
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

export default SalesOrderGeneration;

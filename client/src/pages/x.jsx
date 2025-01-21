import React, { useState, useRef, useCallback, useEffect, memo, useMemo } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGlobalState } from "../context/GlobalState";
import supabase from "../supabaseClient";
import PrinterIcon from "../icons/PrinterIcon";
import XMarkIcon from "../icons/XMarkIcon";

// Utility Functions
const today = new Date();
const dd = String(today.getDate()).padStart(2, "0");
const mm = String(today.getMonth() + 1).padStart(2, "0");
const yyyy = today.getFullYear();

const formattedDate = `${dd}/${mm}/${yyyy}`;

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
    console.error("Error fetching privilege card:", error);
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching customer:", error);
    return [];
  }
  return data;
};

// Function to fetch product details from Supabase
const fetchProductDetailsFromDatabase = async (productId, branch) => {
  if (!branch) {
    console.error("Branch is undefined. Cannot fetch product details.");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("product_id", productId)
      .eq("branch", branch)
      .single();

    if (error) {
      console.error("Error fetching product details:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Unexpected error fetching product details:", error);
    return null;
  }
};

// Helper function to calculate loyalty points
const calculateLoyaltyPoints = (
  subtotalWithGST,
  redeemPointsAmount,
  privilegeCard,
  privilegeCardDetails,
  loyaltyPoints
) => {
  let pointsToRedeem = 0;
  if (privilegeCard && privilegeCardDetails) {
    pointsToRedeem = Math.min(redeemPointsAmount, loyaltyPoints);
  }

  let updatedPoints = loyaltyPoints - pointsToRedeem;
  const pointsToAdd = Math.floor(subtotalWithGST * 0.05);
  updatedPoints += pointsToAdd;
  return { updatedPoints, pointsToRedeem, pointsToAdd };
};

const normalizeWorkOrderProducts = async (workOrderProducts, branch) => {
  if (!Array.isArray(workOrderProducts)) {
    console.error("Work order products should be an array.");
    return [];
  }

  // Map over workOrderProducts to use the details directly
  const normalizedProducts = workOrderProducts.map((product) => ({
    id: product.id || null,
    product_id: product.product_id,
    name: product.product_name || product.name || "",
    price: parseFloat(product.price) || 0,
    quantity: parseInt(product.quantity, 10) || 0,
    hsn_code: product.hsn_code || "",
    stock: 0,
  }));

  // Fetch integer IDs for products if not available
  const productsWithoutId = normalizedProducts.filter((product) => !product.id);
  if (productsWithoutId.length > 0) {
    // Logic to fetch or assign IDs
    // ...
  }

  // Now fetch stock for these products using integer IDs
  const productIds = normalizedProducts
    .map((product) => product.id)
    .filter((id) => id !== null);

  // Fetch stock for these product IDs
  let stockMap = new Map();

  if (productIds.length > 0) {
    const { data, error } = await supabase
      .from("product_stock")
      .select("product_id, stock")
      .in("product_id", productIds);

    if (error) {
      console.error("Error fetching product stock:", error);
    } else {
      data.forEach((item) => {
        stockMap.set(item.product_id, item.stock);
      });
    }
  }

  // Update normalizedProducts with stock
  const updatedProducts = normalizedProducts.map((product) => ({
    ...product,
    stock: stockMap.get(product.product_id) || 0,
  }));

  return updatedProducts;
};

// Helper function to calculate differences between original and updated products
const calculateProductDifferences = (original, updated) => {
  const differences = [];
  const originalMap = new Map();
  original.forEach((prod) => {
    originalMap.set(prod.product_id, prod.quantity);
  });

  const updatedMap = new Map();
  updated.forEach((prod) => {
    updatedMap.set(prod.product_id, prod.quantity);
  });

  // Check for removed or decreased quantities
  originalMap.forEach((originalQty, productId) => {
    const updatedQty = updatedMap.get(productId) || 0;
    if (updatedQty < originalQty) {
      differences.push({ product_id: productId, quantity: originalQty - updatedQty });
    }
  });

  // Check for newly added products
  updatedMap.forEach((updatedQty, productId) => {
    const originalQty = originalMap.get(productId) || 0;
    if (updatedQty > originalQty) {
      differences.push({ product_id: productId, quantity: updatedQty - originalQty });
    }
  });

  return differences;
};

// Constants for GST rates
const CGST_RATE = 0.06; // 6% CGST
const SGST_RATE = 0.06; // 6% SGST
const GST_DIVISOR = 1.12; // To extract base price from GST-inclusive price

function calculateAmounts(
  productEntries,
  advanceDetails,
  salesDiscountAmount,
  workOrderDiscountAmount,
  privilegeCard,
  privilegeCardDetails,
  redeemPointsAmount,
  loyaltyPoints
) {
  // Constants for GST rates
  const CGST_RATE = 0.06; // 6%
  const SGST_RATE = 0.06; // 6%
  const GST_RATE = CGST_RATE + SGST_RATE; // Total GST rate (12%)

  // Helper functions for parsing and validation
  const parsePrice = (price) => parseFloat(price) || 0;
  const parseQuantity = (quantity) => parseInt(quantity, 10) || 0;

  // **Step 1: Calculate Subtotal Including GST**
  const subtotalWithGST = productEntries.reduce((acc, product) => {
    return acc + parsePrice(product.price) * parseQuantity(product.quantity);
  }, 0);

  // **Step 2: Apply Discounts**
  let totalDiscount =
    parsePrice(workOrderDiscountAmount) + parsePrice(salesDiscountAmount);

  // Ensure totalDiscount doesn't exceed subtotalWithGST
  if (totalDiscount > subtotalWithGST) {
    totalDiscount = subtotalWithGST;
  }

  const amountAfterDiscount = subtotalWithGST - totalDiscount;

  // **Step 3: Extract GST from Amount After Discount**
  const taxableValue = amountAfterDiscount / (1 + GST_RATE);
  const gstAmount = amountAfterDiscount - taxableValue;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;

  // **Step 4: Subtract Advance Paid**
  const advancePaid = parsePrice(advanceDetails);
  let balanceDue = amountAfterDiscount - advancePaid;

  // Ensure balanceDue is not negative
  balanceDue = Math.max(balanceDue, 0);

  // **Step 5: Apply Privilege Card Discount (If Applicable)**
  let privilegeDiscount = 0;
  if (
    privilegeCard &&
    privilegeCardDetails &&
    parsePrice(redeemPointsAmount) > 0 &&
    balanceDue > 0
  ) {
    privilegeDiscount = Math.min(parsePrice(redeemPointsAmount), balanceDue);
    balanceDue -= privilegeDiscount;
  }

  // **Step 6: Final Payment Due**
  const finalAmount = balanceDue.toFixed(2); // Final amount after all deductions

  return {
    subtotalWithGST: subtotalWithGST.toFixed(2),
    subtotalWithoutGST: taxableValue.toFixed(2),
    totalDiscount: totalDiscount.toFixed(2),
    amountAfterDiscount: amountAfterDiscount.toFixed(2),
    taxableValue: taxableValue.toFixed(2),
    gstAmount: gstAmount.toFixed(2),
    cgstAmount: cgstAmount.toFixed(2),
    sgstAmount: sgstAmount.toFixed(2),
    advance: advancePaid.toFixed(2),
    balanceDue: balanceDue.toFixed(2),
    privilegeDiscount: privilegeDiscount.toFixed(2),
    finalAmount,
  };
}

// Main Component
const SalesOrderGeneration = memo(({ isCollapsed, onModificationSuccess }) => {
  const { user, role, name, branch, loading: authLoading, subRole } = useAuth();
  console.log("branch:", branch); // Destructure branch from AuthContext
  console.log("subRole:", subRole); // Destructure subRole from AuthContext

  const { state, dispatch } = useGlobalState(); // Access global state
  const { salesOrderForm } = state;

  const {
    step,
    salesOrderId,
    isEditing,
    isPrinted,
    isOtpSent,
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
    address,
    age,
    gender,
    modificationRequestId,
    isSaving,
    allowPrint,
    privilegeCard,
    privilegeCardDetails,
    loyaltyPoints,
    pointsToAdd,
    validationErrors,
    redeemOption,
    redeemPointsAmount,
    fetchMethod,
    searchQuery,
    workOrders,
    isFetchingWorkOrders,
    isLoading,
    workOrderDiscount,
    submitted,
  } = salesOrderForm;

  // Local states
  const [originalProductEntries, setOriginalProductEntries] = useState([
    { id: "", product_id: "", name: "", price: "", quantity: "" },
  ]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [isGeneratingId, setIsGeneratingId] = useState(false);

  // Refs for input fields to control focus
  const workOrderInputRef = useRef(null);
  const firstWorkOrderButtonRef = useRef(null);
  const fetchButtonRef = useRef(null);
  const proceedButtonRef = useRef(null);
  const nextButtonRef = useRef(null);
  const employeeRef = useRef(null);
  const privilegeCardRef = useRef(null);
  const privilegePhoneRef = useRef(null);
  const otpRef = useRef(null);
  const customerNameRef = useRef(null);
  const customerPhoneRef = useRef(null);
  const addressRef = useRef(null);
  const genderRef = useRef(null);
  const ageRef = useRef(null);
  const mrNumberRef = useRef(null);
  const redeemPointsAmountRef = useRef(null);
  const printButtonRef = useRef(null);
  const paymentMethodRef = useRef(null);
  const saveOrderRef = useRef(null);
  const discountInputRef = useRef(null);
  const productRefs = useRef([]);
  const quantityRefs = useRef([]);

  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams();

  // 5. Hooks & Effects
  useEffect(() => {
    dispatch({ type: "RESET_SALES_ORDER_FORM" });
  }, [dispatch]);

  // Helper function to update global form state
  const updateSalesOrderForm = (payload) => {
    dispatch({
      type: "SET_SALES_ORDER_FORM",
      payload,
    });
  };

  // Function to create a new customer
  const saveCustomerDetails = async (customerDetails) => {
    // Implementation for saving customer details
    // ...
  };

  // Fetch Employees based on branch
  const fetchEmployees = async () => {
    if (!branch) {
      console.error("Branch is undefined. Cannot fetch employees.");
      return;
    }

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("branch", branch);

    if (error) {
      console.error("Error fetching employees:", error);
      return;
    }

    setEmployees(data);
  };

  useEffect(() => {
    fetchEmployees();
  }, [branch]);

  // Validation for Employee Dropdown
  const validateEmployeeSelection = () => {
    if (!employee) {
      setValidationErrors((prev) => ({
        ...prev,
        employee: "Employee selection is required.",
      }));
      employeeRef.current?.focus();
      return false;
    }
    return true;
  };

  // Utility function to get the current financial year
  const getFinancialYear = () => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 1}`;
  };

  const generateSalesOrderId = async (branch) => {
    const branchDefaultIds = {
      TVR: 4103,
      NTA: 2570,
      KOT1: 3001,
      KOT2: 4001,
      KAT: 2792,
    };

    if (!branch) {
      console.error("Branch is undefined. Cannot generate Sales Order ID.");
      return null;
    }

    try {
      console.log("Branch passed:", branch);
      console.log("Default Sales Order ID for this branch:", branchDefaultIds[branch]);

      // Extract OP Number from selected work order (store it separately)
      let opNumber = "01"; // Default OP Number
      if (selectedWorkOrder && selectedWorkOrder.work_order_id) {
        const match = selectedWorkOrder.work_order_id.match(/OPW-(\d+)-/);
        if (match && match[1]) {
          opNumber = match[1];
          console.log("Extracted OP Number:", opNumber);
        }
      }

      // Fetch the maximum sales_order_id for the specific branch
      const { data, error } = await supabase
        .from("sales_orders")
        .select("sales_order_id")
        .eq("branch", branch)
        .order("sales_order_id", { ascending: false })
        .limit(1);

      if (error) {
        console.error(`Error fetching last sales_order_id for branch ${branch}:`, error);
        return null;
      }

      let lastSalesOrderId = branchDefaultIds[branch] || 1000;

      if (data && data.length > 0) {
        // Extract numeric part from sales_order_id
        const lastIdMatch = data[0].sales_order_id.match(/OPS-\d+-(\d+)/);
        if (lastIdMatch && lastIdMatch[1]) {
          lastSalesOrderId = parseInt(lastIdMatch[1], 10) || lastSalesOrderId;
        }
      }

      // Generate numeric ID
      const newSalesOrderIdNumeric = lastSalesOrderId + 1;

      // Store the formatted display ID separately
      const displaySalesOrderId = `OPS-${opNumber}-${String(newSalesOrderIdNumeric).padStart(4, "0")}`;

      // Update the sales order form with both IDs
      updateSalesOrderForm({
        salesOrderId: displaySalesOrderId, // Use displaySalesOrderId as the salesOrderId
        opNumber: opNumber,
      });

      return displaySalesOrderId; // Return the formatted ID
    } catch (error) {
      console.error(`Error generating sales_order_id for branch ${branch}:`, error);
      return null;
    }
  };

  // Function to fetch and set a new sales ID when the branch is available
  const fetchSalesOrderId = async () => {
    if (!branch) return;
    const newId = await generateSalesOrderId(branch);
    if (!newId) {
      alert("Failed to generate Sales Order ID.");
    }
  };

  const fetchProductSuggestions = async (query, type) => {
    // Implementation for fetching product suggestions
    // ...
  };

  // Function to handle changes in product fields
  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...productEntries];
    updatedProducts[index][field] = value;
    updateSalesOrderForm({ productEntries: updatedProducts });
  };

  // Function to handle product ID input changes and fetch product details
  const handleProductInputChange = async (index, value) => {
    handleProductChange(index, "product_id", value);
    const productDetails = await fetchProductDetailsFromDatabase(value, branch);
    if (productDetails) {
      handleProductChange(index, "name", productDetails.name);
      handleProductChange(index, "price", productDetails.price);
      handleProductChange(index, "hsn_code", productDetails.hsn_code);
    }
  };

  const fetchExistingSalesOrder = useCallback(
    async (orderId) => {
      // Implementation to fetch existing sales order
      // ...
    },
    [updateSalesOrderForm, validationErrors, branch]
  );

  useEffect(() => {
    if (orderId) {
      fetchExistingSalesOrder(orderId);
    }
  }, [orderId, fetchExistingSalesOrder]);

  useEffect(() => {
    // Additional effects based on branch
    // ...
  }, [branch]);

  const {
    subtotalWithGST,
    subtotalWithoutGST,
    totalDiscount,
    amountAfterDiscount,
    taxableValue,
    gstAmount,
    cgstAmount,
    sgstAmount,
    advance,
    balanceDue,
    privilegeDiscount,
    finalAmount,
  } = useMemo(() => {
    return calculateAmounts(
      productEntries,
      advanceDetails,
      discount,
      workOrderDiscount,
      privilegeCard,
      privilegeCardDetails,
      redeemPointsAmount,
      loyaltyPoints
    );
  }, [
    productEntries,
    advanceDetails,
    discount,
    workOrderDiscount,
    privilegeCard,
    privilegeCardDetails,
    redeemPointsAmount,
    loyaltyPoints,
  ]);

  // Function to fetch patient by MR number
  const fetchPatientByMRNumber = async (mrNumber) => {
    // Implementation to fetch patient details
    // ...
  };

  // Function to remove a product entry
  const removeProductEntry = (index) => {
    const updatedProducts = [...productEntries];
    updatedProducts.splice(index, 1);
    updateSalesOrderForm({ productEntries: updatedProducts });
  };

  // Function to fetch privilege card by pc_number
  const handleFetchPrivilegeCardByNumber = async () => {
    // Implementation to fetch privilege card by number
    // ...
  };

  const prevStep = useCallback(() => {
    if (step > 1) {
      updateSalesOrderForm({ step: step - 1 });
    }
  }, [step, updateSalesOrderForm]);

  // Fetch privilege card details via phone number
  const handleFetchPrivilegeCard = async () => {
    // Implementation to fetch privilege card via phone number
    // ...
  };

  // Handle fetching work orders
  const handleFetchWorkOrders = async () => {
    // Implementation to fetch work orders
    // ...
  };

  const handleSelectWorkOrder = async (workOrder) => {
    // Implementation to select a work order
    // ...
  };

  async function confirmWorkOrderSelection() {
    // Implementation to confirm work order selection
    // ...
  }

  // Function to send OTP
  const handleSendOtp = () => {
    // Implementation to send OTP
    // ...
  };

  const handleVerifyOtp = async () => {
    // Implementation to verify OTP
    // ...
  };

  const handleNewPrivilegeCard = () => {
    // Implementation to handle new privilege card
    // ...
  };

  useEffect(() => {
    // Effect based on location
    // ...
  }, [location]);

  useEffect(() => {
    // Effect based on step, privilegeCard, redeemOption
    // ...
  }, [step, salesOrderForm.privilegeCard, salesOrderForm.redeemOption]);

  const handleEnterKey = (e, nextFieldRef, prevFieldRef) => {
    // Implementation to handle Enter key navigation
    // ...
  };

  // Function to validate individual fields
  const validateField = (index, field) => {
    // Implementation to validate individual fields
    // ...
  };

  const nextStep = async () => {
    if (step < 5) {
      updateSalesOrderForm({ step: step + 1 });
    }
  };

  const handleMRNumberSearch = async () => {
    // Implementation to handle MR number search
    // ...
  };

  const focusFirstFieldOfStep = () => {
    // Implementation to focus the first field of the current step
    // ...
  };

  const setSearchQuery = (query) => {
    updateSalesOrderForm({ searchQuery: query });
  };

  const handleSearchQueryChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Updated handleOrderCompletion function with correct stock update logic
  const handleOrderCompletion = async () => {
    // Implementation to handle order completion
    // ...
  };

  // Function to reset the form
  const resetForm = () => {
    dispatch({ type: "RESET_SALES_ORDER_FORM" });
    navigate("/sales-order-generation");
  };

  // Confirm and reset the form
  const handleExit = () => {
    // Reset the form and navigate away
    dispatch({ type: "RESET_SALES_ORDER_FORM" });
    navigate("/dashboard");
  };

  // Function to handle printing
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Function to save the sales order
  const saveSalesOrder = async () => {
    if (isSaving) {
      alert("Please wait while the sales order is being saved.");
      return;
    }

    if (submitted) {
      alert("Sales order submitted already");
      return;
    }

    dispatch({ type: "SET_SALES_ORDER_FORM", payload: { isSaving: true } });

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
          (isNaN(discount) || discount < 0 || parseFloat(discount) > subtotalWithoutGST),
        errorKey: "discountAmount",
        message: "Enter a valid discount amount that does not exceed the subtotal.",
        ref: discountInputRef,
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
        validation.ref.current?.focus();
        dispatch({ type: "SET_SALES_ORDER_FORM", payload: { isSaving: false } });
        return;
      }
    }

    // Validate product entries
    const productErrors = {};
    productEntries.forEach((product, index) => {
      if (!product.id) {
        productErrors[`productId-${index}`] = "Product ID is required";
      }
      if (!product.price) {
        productErrors[`productPrice-${index}`] = "Product price is required";
      }
      if (!product.quantity) {
        productErrors[`productQuantity-${index}`] = "Product quantity is required";
      }
    });

    if (Object.keys(productErrors).length > 0) {
      setValidationErrors(productErrors);
      const firstErrorKey = Object.keys(productErrors)[0];
      if (
        firstErrorKey.startsWith("productId") ||
        firstErrorKey.startsWith("productPrice") ||
        firstErrorKey.startsWith("productQuantity")
      ) {
        const index = parseInt(firstErrorKey.split("-")[1], 10);
        quantityRefs.current[index]?.focus();
      }
      dispatch({ type: "SET_SALES_ORDER_FORM", payload: { isSaving: false } });
      return;
    }

    try {
      // Generate new sales order ID
      const newSalesOrderId = await generateSalesOrderId(branch);
      if (!newSalesOrderId) {
        alert("Failed to generate sales order ID");
        dispatch({ type: "SET_SALES_ORDER_FORM", payload: { isSaving: false } });
        return;
      }

      // Calculate amounts
      const {
        subtotalWithGST,
        subtotalWithoutGST,
        totalDiscount,
        amountAfterDiscount,
        taxableValue,
        gstAmount,
        cgstAmount,
        sgstAmount,
        advance,
        balanceDue,
        privilegeDiscount,
        finalAmount,
      } = calculateAmounts(
        productEntries,
        advanceDetails,
        discount,
        workOrderDiscount,
        privilegeCard,
        privilegeCardDetails,
        redeemPointsAmount,
        loyaltyPoints
      );

      // Calculate loyalty points
      const { updatedPoints, pointsToRedeem, pointsToAdd } = calculateLoyaltyPoints(
        parseFloat(subtotalWithGST),
        parseFloat(redeemPointsAmount),
        privilegeCard,
        privilegeCardDetails,
        loyaltyPoints
      );

      // Prepare the payload
      const payload = {
        sales_order_id: newSalesOrderId, // Use the formatted ID
        branch,
        sub_role: subRole,
        employee,
        due_date: dueDate,
        mr_number: mrNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: address,
        customer_age: age,
        customer_gender: gender,
        payment_method: paymentMethod,
        discount: parseFloat(discount) || 0,
        advance: parseFloat(advanceDetails) || 0,
        total_amount: parseFloat(finalAmount),
        subtotal: parseFloat(subtotalWithoutGST),
        cgst: parseFloat(cgstAmount),
        sgst: parseFloat(sgstAmount),
        is_b2b: isB2B,
        gst_number: gstNumber,
        product_entries: productEntries.map((entry) => ({
          product_id: entry.id,
          quantity: parseInt(entry.quantity, 10),
          price: parseFloat(entry.price),
          hsn_code: entry.hsn_code,
        })),
        created_at: getCurrentUTCDateTime(),
        updated_at: getCurrentUTCDateTime(),
      };

      // Insert the sales order into the database
      const { error: insertError } = await supabase
        .from("sales_orders")
        .insert([payload]);

      if (insertError) {
        console.error("Error inserting sales order:", insertError);
        alert("An error occurred while saving the sales order. Please try again.");
        dispatch({ type: "SET_SALES_ORDER_FORM", payload: { isSaving: false } });
        return;
      }

      // Update loyalty points if applicable
      if (privilegeCard) {
        const { data, error } = await supabase
          .from("privilegecards")
          .update({ loyalty_points: updatedPoints })
          .eq("pc_number", privilegeCard);

        if (error) {
          console.error("Error updating loyalty points:", error);
        } else {
          console.log("Loyalty points updated successfully.");
        }
      }

      // If everything is successful
      alert("Sales order saved successfully!");
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: {
          submitted: true,
          allowPrint: true,
          loyaltyPoints: updatedPoints,
          pointsToAdd: pointsToAdd,
        },
      });

      // Do not reset the form immediately. Allow user to print or exit.
    } catch (err) {
      console.error("Unexpected error saving sales order:", err);
      alert("An unexpected error occurred while saving the sales order.");
    } finally {
      dispatch({ type: "SET_SALES_ORDER_FORM", payload: { isSaving: false } });
    }
  };

  // Return JSX
  return (
    <div
      className={`transition-all duration-300 ${
        isCollapsed ? "mx-20" : "mx-20 px-20"
      } justify-center mt-16 p-4 mx-auto`}
    >
      <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">
        {isEditing ? "Edit Sales Order" : "Sales Order Generation"}
      </h1>

      <div className="flex items-center mb-8 w-2/3 mx-auto">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-xl mx-1 ${
              step > i + 1 ? "bg-[#5db76d]" : "bg-gray-300"
            } transition-all duration-300`}
          />
        ))}
      </div>

      <form
        className="space-y-8 bg-white p-6 rounded-lg max-w-3xl mx-auto"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Form steps and fields... */}
        {step === 5 && (
          <>
            <div className="bg-white rounded-lg text-gray-800">
              <div className="printable-area print:mt-20 print:block print:absolute print:inset-0 print:w-full bg-white p-4 print:m-0 print:p-0 w-full">
                {/* Printable content... */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center">
                    <h2 className="text-3xl font-bold">
                      {isEditing ? "Sales Order (Modified)" : "Sales Order"}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p>
                      Date: <strong>{formattedDate}</strong>
                    </p>
                    <p>
                      Sales Order No:<strong> {salesOrderId}</strong>
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
                {/* More printable content... */}
              </div>
            </div>

            <div className="flex justify-center text-center space-x-4 mt-6">
              {!submitted && (
                <button
                  type="button"
                  onClick={saveSalesOrder}
                  ref={saveOrderRef}
                  className="flex items-center justify-center w-44 h-12 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                  disabled={isSaving || submitted}
                  aria-label="Save Sales Order"
                >
                  {isSaving ? "Saving..." : "Save Sales Order"}
                </button>
              )}

              {submitted && allowPrint && (
                <>
                  <button
                    type="button"
                    onClick={handlePrint}
                    ref={printButtonRef}
                    className="flex items-center justify-center w-44 h-12 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                    aria-label="Print Sales Order"
                  >
                    <PrinterIcon className="w-5 h-5 mr-2" />
                    Print
                  </button>

                  <button
                    type="button"
                    onClick={handleExit}
                    className="flex items-center justify-center w-44 h-12 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                    aria-label="Exit Sales Order Generation"
                  >
                    <XMarkIcon className="w-5 h-5 mr-2" />
                    Exit
                  </button>
                </>
              )}
            </div>
          </>
        )}

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
});

export default SalesOrderGeneration;
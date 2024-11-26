import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  memo,
  useCallback,
} from "react";
import { PrinterIcon, TrashIcon } from "@heroicons/react/24/outline";
import supabase from "../supabaseClient";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deductStockForMultipleProducts } from "../services/authService.js";
import EmployeeVerification from "../components/EmployeeVerification";
import logo from "../assets/sreenethraenglishisolated.png";
import dayjs from "dayjs"; // Ensure dayjs is imported
import { useGlobalState } from "../context/GlobalStateContext"; // Updated import

const today = new Date();
const dd = String(today.getDate()).padStart(2, '0');
const mm = String(today.getMonth() + 1).padStart(2, '0');
const yyyy = today.getFullYear();

const formattedDate = `${dd}/${mm}/${yyyy}`;

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

// Helper function to calculate loyalty points
const calculateLoyaltyPoints = (
  subtotal,
  redeemPointsAmount,
  privilegeCard,
  privilegeCardDetails,
  LoyaltyPoints
) => {
  let pointsToRedeem = 0;
  if (privilegeCard && privilegeCardDetails) {
    pointsToRedeem = Math.min(
      parseFloat(redeemPointsAmount) || 0,
      LoyaltyPoints
    );
  }

  let updatedPoints = LoyaltyPoints - pointsToRedeem;

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

// Function to calculate amounts
function calculateAmounts(
  productEntries,
  advanceDetails,
  privilegeCard,
  privilegeCardDetails,
  redeemPointsAmount,
  loyaltyPoints,
  selectedWorkOrder,
  discountAmount
) {
  // Step 1: Adjust Prices and Calculate Adjusted Subtotal
  const adjustedSubtotal = productEntries.reduce((acc, product) => {
    const originalPrice = parseFloat(product.price) || 0;
    const adjustedPrice = (originalPrice / 112) * 100; // Adjusted Price using formula
    const quantity = parseInt(product.quantity) || 0;
    return acc + adjustedPrice * quantity;
  }, 0);

  // Step 2: Calculate Remaining Balance After Advance Paid
  const advancePaid = parseFloat(advanceDetails) || 0;
  let remainingAfterAdvance = adjustedSubtotal - advancePaid;

  // Step 3: Calculate Discount Based on Remaining Balance After Advance
  const discount = parseFloat(discountAmount) || 0;
  const validDiscount = Math.min(discount, remainingAfterAdvance);

  // Step 4: Update Remaining Balance After Discount
  let remainingBalance = remainingAfterAdvance - validDiscount;

  // Step 5: Calculate Privilege Card Discount if Applicable
  let privilegeDiscount = 0;
  if (
    privilegeCard &&
    privilegeCardDetails &&
    parseFloat(redeemPointsAmount) > 0 &&
    remainingBalance > 0
  ) {
    const redeemAmount = parseFloat(redeemPointsAmount) || 0;
    privilegeDiscount = Math.min(redeemAmount, loyaltyPoints, remainingBalance);
    remainingBalance -= privilegeDiscount;
  }

  // Ensure that if discount makes the total zero or negative, no privilege discount
  if (remainingBalance <= 0) {
    privilegeDiscount = 0;
    remainingBalance = Math.max(remainingBalance, 0);
  }

  // Step 6: Calculate GST Based on Remaining Balance
  const cgstAmount = remainingBalance * 0.06;
  const sgstAmount = remainingBalance * 0.06;

  // Step 7: Calculate Final Amount Including GST
  const finalAmount = remainingBalance + cgstAmount + sgstAmount;

  // Step 8: Ensure Final Amount is Not Negative
  const finalAmountAdjusted = Math.max(finalAmount, 0);

  return {
    subtotal: adjustedSubtotal, // Adjusted Subtotal
    discount: validDiscount, // Discount Amount
    advance: advancePaid, // Advance Paid
    privilegeDiscount, // Privilege Card Discount
    cgstAmount, // 6% CGST
    sgstAmount, // 6% SGST
    finalAmount: finalAmountAdjusted, // Final Amount Including GST
  };
}


// Main Component
const SalesOrderGeneration = memo(({ isCollapsed, onModificationSuccess }) => {
  const { user, role, name, branch, loading: authLoading } = useAuth();
  console.log("branch:", branch); // Destructure branch from AuthContext

  const { state, dispatch } = useGlobalState(); // Access global state
  const { salesOrderForm: form } = state;

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
    isLoading
  } = form;

  // Local states
  const [originalProductEntries, setOriginalProductEntries] = useState([
    { id: "", name: "", price: "", quantity: "" },
  ]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);

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

  // Helper function to update global form state
  const updateSalesOrderForm = (payload) => {
    dispatch({ type: "SET_SALES_ORDER_FORM", payload });
  };

  // Fetch Employees based on branch
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
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          employee: "Employee selection is required.",
        },
      });
      employeeRef.current?.focus();
    } else {
      const updatedErrors = { ...validationErrors };
      delete updatedErrors.employee;
      updateSalesOrderForm({
        validationErrors: updatedErrors,
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

      let lastSalesOrderId = 4007;
      if (data && data.length > 0) {
        lastSalesOrderId = parseInt(data[0].sales_order_id, 10) || 0;
      }

      // Increment the last sales_order_id by 1
      const newSalesOrderId = lastSalesOrderId + 1;
      updateSalesOrderForm({ salesOrderId: newSalesOrderId });

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
        .select(`product_id, product_name, mrp,hsn_code`)
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
    const updatedProductEntries = [...productEntries];
    updatedProductEntries[index][field] = value;
    updateSalesOrderForm({ productEntries: updatedProductEntries });
    validateField(index, field);
  };

  const handleProductInputChange = async (index, value) => {
    if (!branch) {
      console.error("Branch is undefined. Cannot fetch product details.");
      const updatedEntries = [...productEntries];
      updatedEntries[index] = {
        ...updatedEntries[index],
        stock: 0, // Assume no stock if branch is missing
      };
      updateSalesOrderForm({ productEntries: updatedEntries });
      return;
    }

    const productDetails = await fetchProductDetailsFromDatabase(value, branch);
    if (productDetails) {
      const updatedEntries = [...productEntries];
      updatedEntries[index] = {
        id: productDetails.product_id,
        name: productDetails.product_name,
        price: productDetails.mrp || "",
        stock: productDetails.stock || 0,
        quantity: updatedEntries[index].quantity || "",
        hsn_code:productDetails.hsn_code, // Preserve quantity
      };
      updateSalesOrderForm({ productEntries: updatedEntries });

      if (productDetails.stock > 0) {
        setTimeout(() => {
          quantityRefs.current[index]?.focus();
        }, 100);
      }
    } else {
      const updatedEntries = [...productEntries];
      updatedEntries[index] = {
        ...updatedEntries[index],
        stock: 0, // Assume no stock if fetching fails
      };
      updateSalesOrderForm({ productEntries: updatedEntries });
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
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "Sales Not Found.",
          },
        });
        return;
      }

      // Populate form fields with the fetched data
      updateSalesOrderForm({
        productEntries: data.items || [
          { id: "", name: "", price: "", quantity: "" },
        ],
        mrNumber: data.mr_number || "",
        customerPhone: data.patient_phone || "",
        advanceDetails: data.advance_details || "",
        employee: data.employee || "",
        paymentMethod: data.payment_method || "",
        loyaltyPoints: data.loyalty_points_redeemed || 0,
        hasMrNumber: data.hasMrNumber || "yes",
        discount: data.discount || "",
        privilegeCard: true,
        privilegeCardNumber: data.pc_number || "",
        isEditing: true, // Custom field to indicate editing mode
        validationErrors: {}, // Clear validation errors
      });

      setOriginalProductEntries(
        data.items || [{ id: "", name: "", price: "", quantity: "" }]
      ); // Store original entries

      // Fetch privilege card details based on pc_number
      if (data.pc_number) {
        const privilegeData = await supabase
          .from("privilegecards")
          .select("*")
          .eq("pc_number", data.pc_number)
          .single();

        if (privilegeData.error || !privilegeData.data) {
          updateSalesOrderForm({ privilegeCardDetails: null });
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Privilege Card not found for the given PC Number.",
            },
          });
        } else {
          updateSalesOrderForm({ privilegeCardDetails: privilegeData.data });
          updateSalesOrderForm({ isPinVerified: true });
        }
      }

      updateSalesOrderForm({ step: 3 }); // Move to the Privilege Card step
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "",
        },
      });
    } catch (error) {
      console.error("Error fetching sales:", error);
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "Failed to fetch sales",
        },
      });
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchExistingSalesOrder(orderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Function to fetch and set a new sales ID when the branch is available
  const fetchSalesOrderId = async () => {
    if (branch && !isEditing) {
      // Only generate ID if not editing
      const newSalesOrderId = await generateSalesOrderId();
      if (newSalesOrderId) {
        updateSalesOrderForm({ salesOrderId: newSalesOrderId });
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "",
          },
        });
      } else {
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "Failed to generate ID",
          },
        });
      }
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
    discount: calculatedDiscount,
    advance,
    privilegeDiscount,
    finalAmount,
  } = useMemo(
    () =>
      calculateAmounts(
        productEntries,
        advanceDetails,
        form.privilegeCard,
        privilegeCardDetails,
        redeemPointsAmount,
        loyaltyPoints,
        selectedWorkOrder,
        discount
      ),
    [
      productEntries,
      advanceDetails,
      form.privilegeCard,
      privilegeCardDetails,
      redeemPointsAmount,
      loyaltyPoints,
      selectedWorkOrder,
      discount,
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

  // Function to remove a product entry
  const removeProductEntry = (index) => {
    const updatedEntries = productEntries.filter((_, i) => i !== index);
    updateSalesOrderForm({ productEntries: updatedEntries });
    const updatedOriginalEntries = originalProductEntries.filter(
      (_, i) => i !== index
    );
    setOriginalProductEntries(updatedOriginalEntries); // Update original entries accordingly
  };

  // Function to fetch privilege card by pc_number
  const handleFetchPrivilegeCardByNumber = async () => {
    try {
      const pcNumber = form.privilegeCardNumber?.trim();

      if (!pcNumber) {
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            privilegeCardNumber: "Privilege Card Number is required.",
          },
        });
        privilegeCardRef.current?.focus();
        return;
      }

      const { data, error } = await supabase
        .from("privilegecards")
        .select("*")
        .eq("pc_number", pcNumber)
        .single();

      if (error || !data) {
        updateSalesOrderForm({
          privilegeCardDetails: null,
          validationErrors: {
            ...validationErrors,
            privilegeCardNumber: "Privilege Card not found.",
          },
        });
      } else {
        updateSalesOrderForm({
          privilegeCardDetails: data,
          isOtpVerified: true, // Assuming successful fetch auto-verifies
          validationErrors: {
            ...validationErrors,
            privilegeCardNumber: null,
            redeemOption: null,
          },
        });
      }
    } catch (error) {
      console.error("Unexpected error fetching privilege card:", error);
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          privilegeCardNumber: "An unexpected error occurred. Please try again.",
        },
      });
    }
  };

  const prevStep = useCallback(() => {
    updateSalesOrderForm({ step: Math.max(step - 1, 0) });
  }, [step]);

  // Fetch privilege card details via phone number
  const handleFetchPrivilegeCard = async () => {
    try {
      const card = await fetchPrivilegeCardByPhone(form.customerPhone);
      if (card) {
        updateSalesOrderForm({ privilegeCardDetails: card });
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "",
          },
        });
      } else {
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "No privilege card associated with this number",
          },
        });
      }
    } catch (error) {
      console.error("Error fetching privilege card:", error);
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "Failed to fetch privilege card details",
        },
      });
    }
  };

  // Handle fetching work orders
  const handleFetchWorkOrders = async () => {
    try {
      updateSalesOrderForm({ isFetchingWorkOrders: true });

      let query = supabase.from("work_orders").select("*");

      if (fetchMethod === "work_order_id") {
        query = query.eq("work_order_id", searchQuery);
      } else if (fetchMethod === "mr_number") {
        // Fetch work orders by MR Number directly
        query = query.eq("mr_number", searchQuery);
      } else if (fetchMethod === "phone_number") {
        // Fetch work orders associated with customers having the phone number
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("id")
          .eq("phone_number", searchQuery)
          .single();

        if (customerError) {
          console.error("Error fetching customers:", customerError.message);
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Failed to fetch customers",
            },
          });
          updateSalesOrderForm({ isFetchingWorkOrders: false });
          return;
        }

        if (!customer) {
          updateSalesOrderForm({ workOrders: [] });
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "No customers found with this number",
            },
          });
          updateSalesOrderForm({ isFetchingWorkOrders: false });
          return;
        }

        const customerId = customer.id;
        query = query.eq("customer_id", customerId);
      }

      // Exclude work orders that are already used
      query = query.eq("is_used", false);

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("Error fetching work orders:", error.message);
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "Failed to fetch work orders",
          },
        });
      } else {
        updateSalesOrderForm({ workOrders: data });

        // Clear any previous error messages
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "",
          },
        });

        // Focus on the first work order button if found, otherwise on the proceed button
        setTimeout(() => {
          if (data.length > 0) {
            firstWorkOrderButtonRef.current?.focus();
          } else {
            proceedButtonRef.current?.focus();
          }
        }, 0);
      }

      updateSalesOrderForm({ isFetchingWorkOrders: false });
    } catch (error) {
      console.error("Error fetching work orders:", error);
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "Failed to fetch work orders",
        },
      });
      updateSalesOrderForm({ isFetchingWorkOrders: false });
    }
  };

  function handleSelectWorkOrder(workOrder) {
    setSelectedWorkOrder(workOrder);
    setShowWorkOrderModal(true);
  }

  async function confirmWorkOrderSelection() {
    // Set relevant data from the work order
    updateSalesOrderForm({
      mrNumber: selectedWorkOrder.mr_number,
      advanceDetails: selectedWorkOrder.advance_details || "",
      hasMrNumber: selectedWorkOrder.mr_number ? "yes" : "no",
      productEntries: selectedWorkOrder.product_entries || [
        { id: "", name: "", price: "", quantity: "" },
      ],
    });

    setOriginalProductEntries(
      selectedWorkOrder.product_entries || [
        { id: "", name: "", price: "", quantity: "" },
      ]
    ); // Update original entries

    setShowWorkOrderModal(false);

    // Automatically fetch patient details
    if (selectedWorkOrder.mr_number) {
      const patient = await fetchPatientByMRNumber(
        selectedWorkOrder.mr_number.trim()
      );

      if (patient) {
        updateSalesOrderForm({
          patientDetails: {
            name: patient.name,
            age: patient.age,
            condition: patient.condition || "N/A",
            phone_number: patient.phone_number || "N/A",
            gender: patient.gender || "N/A",
            address: patient.address || "N/A",
          },
        });
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "",
          },
        });
      } else {
        updateSalesOrderForm({ patientDetails: null });
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "No patient found with the provided work order.",
          },
        });
      }
    } else {
      updateSalesOrderForm({ patientDetails: null });
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "Selected work order doesn't contain an MR number.",
        },
      });
    }

    // Move to the next step
    updateSalesOrderForm({ step: 3 }); // Adjust step numbering as needed
  }

  // Function to send OTP
  const handleSendOtp = () => {
    console.log("handleSendOtp called");
    const phoneNumber = customerPhone?.trim(); // Changed to 'customerPhone'
    console.log("Entered Phone Number:", phoneNumber);

    if (
      !phoneNumber ||
      phoneNumber.length !== 10 ||
      !/^\d+$/.test(phoneNumber)
    ) {
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          customerPhone: "Please enter a valid 10-digit phone number.", // Changed to 'customerPhone'
        },
      });
      privilegePhoneRef.current?.focus(); // Changed to 'privilegePhoneRef'
      return;
    }

    updateSalesOrderForm({
      isOtpSent: true,
      validationErrors: {
        ...validationErrors,
        customerPhone: null, // Changed to 'customerPhone'
      },
    });

    // Mock OTP alert for testing
    alert(`Mock OTP for testing purposes: ${mockOtp}`);
    setTimeout(() => {
      otpRef.current?.focus();
    }, 100);
  };

  const handleVerifyOtp = async () => {
    if (form.otp === mockOtp) {
      updateSalesOrderForm({ isPinVerified: true });
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "", // Clear general errors
        },
      });
      await handleFetchPrivilegeCard();
      setTimeout(() => {
        if (!validationErrors.generalError) {
          nextButtonRef.current?.focus();
        }
      }, 0); // Focus on the next button if no errors
    } else {
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "Incorrect OTP. Please try again.",
        },
      });
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
          customerName,
          customerPhone,
          address,
          age,
          gender,
          employee,
          paymentMethod,
          advanceDetails,
          privilegeCard: form.privilegeCard,
          redeemPoints: form.redeemPoints,
          redeemPointsAmount: form.redeemPointsAmount,
          loyaltyPoints,
          discount,
          privilegeCardNumber: form.privilegeCardNumber,
          // Add any other necessary fields
        },
      },
    });
  };

  useEffect(() => {
    const locationState = location.state;
    if (locationState?.from === "privilege-generation") {
      updateSalesOrderForm({ isEditing: true });

      const data = locationState.formData;
      if (data) {
        updateSalesOrderForm({
          productEntries: data.productEntries,
          mrNumber: data.mrNumber,
          patientDetails: data.patientDetails,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          address: data.address,
          age: data.age,
          gender: data.gender,
          employee: data.employee,
          paymentMethod: data.paymentMethod,
          advanceDetails: data.advanceDetails,
          privilegeCard: data.privilegeCard,
          redeemPoints: data.redeemPoints,
          redeemPointsAmount: data.redeemPointsAmount,
          loyaltyPoints: data.loyaltyPoints,
          privilegeCardNumber: data.privilegeCardNumber || "",
          discount: data.discount || "",
          // Add any other necessary fields
        });

        // If privilegeCardDetails are available, set them
        if (data.privilegeCardDetails) {
          updateSalesOrderForm({
            privilegeCardDetails: data.privilegeCardDetails,
          });
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
  }, [step, form.privilegeCard, form.redeemOption]);

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

  // Function to validate individual fields
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
        errors[`productQuantity-${index}`] = "Quantity must be greater than zero";
      } else if (quantity > productEntries[index].stock) {
        errors[`productQuantity-${index}`] = `Quantity cannot exceed stock (${productEntries[index].stock})`;
      } else {
        delete errors[`productQuantity-${index}`];
      }
    } else {
      delete errors[`product${field.charAt(0).toUpperCase() + field.slice(1)}-${index}`];
    }

    updateSalesOrderForm({
      validationErrors: {
        ...errors,
      },
    });
  };

  const nextStep = async () => {
    const errors = {};

    // Validate each step before proceeding
    if (step === 0) {
      if (!searchQuery.trim())
        errors.searchQuery =
          "Work Order ID, MR Number, or Phone Number is required";
      // No need to validate branchCode as branch is fetched from context
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
            errors[`productQuantity-${index}`] = `Cannot exceed stock (${product.stock})`;
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
        if (!address.trim())
          errors["address"] = "Customer address is required.";
        if (!age)
          errors["customerAge"] = "Customer age is required.";
        if (age && parseInt(age) < 0)
          errors["customerAge"] = "Age cannot be negative.";
        if (!gender)
          errors["customerGender"] = "Customer gender is required.";
      }
    } else if (step === 3 && privilegeCard) {
      if (redeemOption === "phone") {
        if (!customerPhone.trim())
          errors.customerPhone = "Phone number is required";
        if (!form.otp.trim()) errors.otp = "OTP is required";
        if (!isPinVerified) errors.otp = "Please verify the OTP";
      }
      if (
        redeemPointsAmount &&
        (parseFloat(redeemPointsAmount) > loyaltyPoints ||
          parseFloat(redeemPointsAmount) < 0)
      ) {
        errors.redeemPointsAmount = "Invalid redemption amount";
      }
      if (discount !== "" && (parseFloat(discount) < 0 || parseFloat(discount) > 100)) {
        errors.discount = "Discount percentage must be between 0 and 100";
      }
    } else if (step === 4 && !employee) {
      errors.employee = "Employee selection is required";
    } else if (step === 5 && !paymentMethod) {
      errors.paymentMethod = "Payment method is required";
    }

    // Dispatch validation errors
    updateSalesOrderForm({ validationErrors: errors });

    if (Object.keys(errors).length === 0) {
      if (step < 5) {
        updateSalesOrderForm({ step: step + 1 });
      }
    }
  };

  const handleMRNumberSearch = async () => {
    if (!mrNumber.trim()) {
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          mrNumber: "MR number is required",
        },
      });
      mrNumberRef.current?.focus();
      return;
    }

    const patient = await fetchPatientByMRNumber(mrNumber.trim());

    if (patient) {
      updateSalesOrderForm({
        patientDetails: {
          name: patient.name,
          age: patient.age,
          condition: patient.condition || "N/A",
          phone_number: patient.phone_number || "N/A",
          gender: patient.gender || "N/A",
          address: patient.address || "N/A",
        },
        validationErrors: { ...validationErrors, mrNumber: null },
      });
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "",
        },
      });
      nextButtonRef.current?.focus();
    } else {
      updateSalesOrderForm({ patientDetails: null });
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "No patient found with the provided work order",
        },
      });
    }
  };

  const focusFirstFieldOfStep = () => {
    if (step === 1) workOrderInputRef.current?.focus();
    if (step === 2) document.getElementById(`productId-0`)?.focus();
    if (step === 3) {
      if (hasMrNumber === "yes") {
        mrNumberRef.current?.focus();
      } else if (hasMrNumber === "no") {
        customerNameRef.current?.focus();
      }
    }
    if (step === 4 && form.privilegeCard) {
      if (form.redeemOption === "barcode") {
        privilegeCardRef.current?.focus();
      } else if (form.redeemOption === "phone") {
        privilegePhoneRef.current?.focus();
      }
    }
    if (step === 5) employeeRef.current?.focus();
  };

  const setSearchQuery = (query) => {
    dispatch({
      type: "SET_SALES_ORDER_FORM",
      payload: { searchQuery: query },
    });
  };


  const handleSearchQueryChange = (e) => {
    setSearchQuery(e.target.value);
  };


  const handleOrderCompletion = async () => {
    const currentUTCDateTime = getCurrentUTCDateTime();
    updateSalesOrderForm({ isSaving: true });
    updateSalesOrderForm({
      validationErrors: {
        ...validationErrors,
        generalError: "",
      },
    });

    try {
      // Step 1: Handle Loyalty Points Update (if applicable)
      if (form.privilegeCard && privilegeCardDetails) {
        const { updatedPoints, pointsToRedeem, pointsToAdd } =
          calculateLoyaltyPoints(
            subtotal,
            redeemPointsAmount,
            form.privilegeCard,
            privilegeCardDetails,
            loyaltyPoints
          );

        const { error: loyaltyError } = await supabase
          .from("privilegecards")
          .update({ loyalty_points: updatedPoints })
          .eq("pc_number", form.privilegeCardNumber);

        if (loyaltyError) {
          console.error("Error updating loyalty points:", loyaltyError);
          dispatch({
            type: "SET_SALES_ORDER_FORM",
            payload: {
              validationErrors: {
                ...validationErrors,
                generalError: "Failed to update loyalty points",
              },
            },
          });
          return;
        }

        dispatch({
          type: "SET_SALES_ORDER_FORM",
          payload: {
            loyaltyPoints: updatedPoints,
            pointsToAdd: pointsToAdd,
            // If pointsToAdd is also part of global state
          },
        });

      }

      // Step 2: Prepare Variables for sales Data
      const sanitizedRedeemedPoints = form.privilegeCard
        ? parseInt(form.redeemPointsAmount) || 0
        : 0;
      const sanitizedPointsAdded = form.privilegeCard ? pointsToAdd || 0 : 0;

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
            dispatch({
              type: "SET_SALES_ORDER_FORM",
              payload: {
                validationErrors: {
                  ...validationErrors,
                  generalError: `Failed to fetch stock for product ID: ${productId}`,
                },
              },
            });
            return;
          }

          const newStock = stockData.quantity - diff; // Deduct if diff > 0, add if diff < 0

          if (newStock < 0) {
            dispatch({
              type: "SET_SALES_ORDER_FORM",
              payload: {
                validationErrors: {
                  ...validationErrors,
                  generalError: `Insufficient stock for product ID: ${productId}. Cannot reduce stock below zero.`,
                },
              },
            });
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
            dispatch({
              type: "SET_SALES_ORDER_FORM",
              payload: {
                validationErrors: {
                  ...validationErrors,
                  generalError: `Failed to fetch stock for product ID: ${productId}`,
                },
              },
            });
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
            patient_phone: hasMrNumber === "yes" ? customerPhone : null,
            employee: employee,
            payment_method: paymentMethod,
            subtotal: subtotal,
            cgst: parseFloat(cgstAmount),
            sgst: parseFloat(sgstAmount),
            total_amount: finalAmount,
            discount: calculatedDiscount,
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
          dispatch({
            type: "SET_SALES_ORDER_FORM",
            payload: {
              validationErrors: {
                ...validationErrors,
                generalError: "failed to update sales",
              },
            },
          });
          return;
        }

        // Update modification status to completed
        const { error: modUpdateError } = await supabase
          .from("modification_requests")
          .update({ status: "completed" })
          .eq("order_id", salesOrderId);

        if (modUpdateError) {
          console.error("Error updating modification status:", modUpdateError);
          dispatch({
            type: "SET_SALES_ORDER_FORM",
            payload: {
              validationErrors: {
                ...validationErrors,
                generalError: "failed to update modification status",
              },
            },
          });
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
            mr_number: hasMrNumber === "yes" ? mrNumber : null,
            patient_phone: hasMrNumber === "yes" ? customerPhone : null,
            employee: employee,
            payment_method: paymentMethod,
            subtotal: subtotal,
            discount: calculatedDiscount,
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
          dispatch({
            type: "SET_SALES_ORDER_FORM",
            payload: {
              validationErrors: {
                ...validationErrors,
                generalError: "failed to update work order status",
              },
            },
          });
          return;
        }



        // Step 5: Mark Work Order as Used (if applicable)
        if (selectedWorkOrder) {
          const { error: workOrderError } = await supabase
            .from("work_orders")
            .update({ is_used: true })
            .eq("work_order_id", selectedWorkOrder.work_order_id);

          if (workOrderError) {
            console.error("Error marking work order as used:", workOrderError);
            dispatch({
              type: "SET_SALES_ORDER_FORM",
              payload: {
                validationErrors: {
                  ...validationErrors,
                  generalError: "failed to update work order status",
                },
              },
            });
            return;
          }
        }

        const validProducts = productEntries.filter(
          (product) => product.id && product.quantity > 0
        );

        if (!validProducts || validProducts.length === 0) {
          console.error("No valid products to process");
          dispatch({
            type: "SET_SALES_ORDER_FORM",
            payload: {
              validationErrors: {
                ...validationErrors,
                generalError: "no valid products to deduct stock",
              },
            },
          });
          dispatch({
            type: "SET_SALES_ORDER_FORM",
            payload: { isLoading: false },
          }); // Ensure loading state is turned off
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
          dispatch({
            type: "SET_SALES_ORDER_FORM",
            payload: {
              validationErrors: {
                ...validationErrors,
                generalError: `Failed to deduct stocks: ${deductResponse.error}`,
              },
            },
          });
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

      updateSalesOrderForm({ allowPrint: true });

      alert("Order processed successfully!");
      setTimeout(() => {
        printButtonRef.current?.focus(); // Move focus to the Print button
      }, 100);
    } catch (error) {
      console.error("Error completing the order:", error);
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: {
          validationErrors: {
            ...validationErrors,
            generalError: "failed to complete the order",
          },
        },
      });
    } finally {
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: { isLoading: false },
      });
    }
  };

  // Function to reset the form
  const resetForm = () => {
    dispatch({ type: "RESET_SALES_ORDER_FORM" });
    setOriginalProductEntries([{ id: "", name: "", price: "", quantity: "" }]);
    dispatch({
      type: "SET_SALES_ORDER_FORM",
      payload: {
        validationErrors: {
          ...validationErrors,
          generalError: "",
        },
      },
    });
    setSelectedWorkOrder(null);
    setShowWorkOrderModal(false);

    setProductSuggestions([]);
    setIsGeneratingId(false);
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

  const handlePrint = useCallback(() => {
    window.print();
    dispatch({ type: "SET_SALES_ORDER_FORM", payload: { isPrinted: true } });
    resetForm();
    navigate("/home");
  }, []);


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
                <strong>Work Order ID:</strong>{" "}
                {selectedWorkOrder.work_order_id}
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
                              <td className="py-1 px-2">{product.name}</td>
                              <td className="py-1 px-2">{product.price}</td>
                              <td className="py-1 px-2">{product.quantity}</td>
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
          <p>You are editing an existing sales order (ID: {salesOrderId}).</p>
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
          {/* Step 1: Fetch Work Orders */}
          {state.salesOrderForm.step === 0 && (
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
                    onClick={() =>
                      updateSalesOrderForm({ fetchMethod: "work_order_id" })
                    }
                    className={`px-4 py-2 rounded-lg ${form.fetchMethod === "work_order_id"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                      }`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        document
                          .getElementById("fetchMethod-mr_number")?.focus();
                      }
                    }}
                  >
                    Work Order ID
                  </button>
                  <button
                    type="button" // Added type="button"
                    onClick={() =>
                      updateSalesOrderForm({ fetchMethod: "mr_number" })
                    }
                    id="fetchMethod-mr_number"
                    className={`px-4 py-2 rounded-lg ${form.fetchMethod === "mr_number"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                      }`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        document
                          .getElementById("fetchMethod-phone_number")
                          ?.focus();
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        document
                          .getElementById("fetchMethod-work_order_id")
                          ?.focus();
                      }
                    }}
                  >
                    MR Number
                  </button>
                  <button
                    type="button" // Added type="button"
                    onClick={() =>
                      updateSalesOrderForm({ fetchMethod: "phone_number" })
                    }
                    id="fetchMethod-phone_number"
                    className={`px-4 py-2 rounded-lg ${form.fetchMethod === "phone_number"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                      }`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        document
                          .getElementById("fetchMethod-mr_number")
                          ?.focus();
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
                value={state.salesOrderForm.searchQuery}
                ref={workOrderInputRef}
                onChange={handleSearchQueryChange}
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

              {validationErrors.generalError && (
                <p className="text-red-500 text-xs mt-1">{validationErrors.generalError}</p>
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
                              <strong>Due Date:</strong>{" "}
                              {workOrder.due_date}
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
                                    .getElementById(
                                      `workOrderButton-${index + 1}`
                                    )
                                    ?.focus();
                                } else {
                                  proceedButtonRef.current?.focus();
                                }
                              } else if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                document
                                  .getElementById(
                                    `workOrderButton-${index - 1}`
                                  )
                                  ?.focus();
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
                    onClick={() => updateSalesOrderForm({ step: 1 })}
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

          {/* Step 2: Product Details */}
          {state.salesOrderForm.step === 1 && (
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

                            handleProductChange(index, "id", value); // Update ID field
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
                                handleProductChange(
                                  index,
                                  "id",
                                  productDetails.product_id
                                );
                                handleProductChange(
                                  index,
                                  "name",
                                  productDetails.product_name
                                );
                                handleProductChange(
                                  index,
                                  "price",
                                  productDetails.mrp || ""
                                );
                                handleProductChange(
                                  index,
                                  "stock",
                                  productDetails.stock || 0
                                );
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
                              document
                                .getElementById(`productQuantity-${index}`)
                                ?.focus();
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
                                  updateSalesOrderForm({
                                    productEntries: [
                                      ...productEntries,
                                      {
                                        id: "",
                                        name: "",
                                        price: "",
                                        quantity: "",
                                      },
                                    ],
                                  });
                                  setOriginalProductEntries([
                                    ...originalProductEntries,
                                    {
                                      id: "",
                                      name: "",
                                      price: "",
                                      quantity: "",
                                    },
                                  ]); // Update original entries
                                  setProductSuggestions([
                                    ...productSuggestions,
                                    [],
                                  ]);
                                  setTimeout(
                                    () =>
                                      document
                                        .getElementById(
                                          `productId-${productEntries.length}`
                                        )
                                        ?.focus(),
                                    0
                                  );
                                } else {
                                  // Enter: Proceed to the next step
                                  nextStep();
                                }
                              }
                              // Handle Arrow Keys for navigation
                              else if (e.key === "ArrowRight") {
                                e.preventDefault();
                                e.target.parentElement.nextSibling?.focus();
                              } else if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                document
                                  .getElementById(`productPrice-${index}`)
                                  ?.focus();
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
                            document
                              .getElementById(`productQuantity-${index}`)
                              ?.focus();
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
                    updateSalesOrderForm({
                      productEntries: [
                        ...productEntries,
                        { id: "", name: "", price: "", quantity: "" },
                      ],
                    });
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
                      document
                        .getElementById(`productId-${productEntries.length}`)
                        ?.focus();
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

          {/* Step 3: Patient or Customer Details */}
          {state.salesOrderForm.step === 2 && (
            <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Patient or Customer Information
              </h2>

              <p className="font-semibold mb-2">Do you have an MR Number?</p>
              <div className="flex space-x-4 mb-4">
                <button
                  type="button" // Added type="button"
                  id="hasMrNumber-yes"
                  onClick={() => updateSalesOrderForm({ hasMrNumber: "yes" })}
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
                  onClick={() => updateSalesOrderForm({ hasMrNumber: "no" })}
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
                    onChange={(e) =>
                      updateSalesOrderForm({ mrNumber: e.target.value })
                    }
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
                        <strong>Gender:</strong> {patientDetails.gender}
                      </p>
                      <p>
                        <strong>Address:</strong> {patientDetails.address}
                      </p>
                      <p>
                        <strong>Phone number:</strong> {patientDetails.phone_number}
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
                    onChange={(e) =>
                      updateSalesOrderForm({ customerName: e.target.value })
                    }
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
                    onChange={(e) =>
                      updateSalesOrderForm({ customerPhone: e.target.value })
                    }
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

                  {/* Additional Fields: Address, Gender, Age */}
                  <label className="block text-gray-700 font-medium mb-1">
                    Enter Address
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Address"
                    value={address}
                    onChange={(e) =>
                      updateSalesOrderForm({ address: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        genderRef.current?.focus();
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        customerPhoneRef.current?.focus();
                      }
                    }}
                    ref={addressRef}
                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                  />

                  {validationErrors.address && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.address}
                    </p>
                  )}

                  <label className="block text-gray-700 font-medium mb-1">
                    Select Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) =>
                      updateSalesOrderForm({ gender: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        ageRef.current?.focus();
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        addressRef.current?.focus();
                      }
                    }}
                    ref={genderRef}
                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                  >
                    <option value="" disabled>
                      Select Gender
                    </option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>

                  {validationErrors.gender && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.gender}
                    </p>
                  )}

                  <label className="block text-gray-700 font-medium mb-1">
                    Enter Age
                  </label>
                  <input
                    type="number"
                    placeholder="Enter Age"
                    value={age}
                    onChange={(e) =>
                      updateSalesOrderForm({ age: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        nextButtonRef.current?.focus();
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        genderRef.current?.focus();
                      }
                    }}
                    ref={ageRef}
                    className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                    min="0"
                  />

                  {validationErrors.age && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.age}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Privilege Card */}
          {/* Step 3: Privilege Card */}
          {state.salesOrderForm.step === 3 && (
            <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Privilege Card
              </h2>

              <p className="font-semibold mb-2">
                Do you have a Privilege Card?
              </p>
              <div className="flex space-x-4 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "SET_SALES_ORDER_FORM",
                      payload: { privilegeCard: true, redeemOption: null },
                    }); // Reset redeemOption
                    dispatch({
                      type: "SET_SALES_ORDER_FORM",
                      payload: {
                        validationErrors: {
                          ...state.salesOrderForm.validationErrors,
                          generalError: "",
                        },
                      },
                    }); // Clear previous errors
                    setTimeout(() => {
                      if (form.redeemOption === "barcode") {
                        privilegeCardRef.current?.focus();
                      } else if (form.redeemOption === "phone") {
                        privilegePhoneRef.current?.focus();
                      }
                    }, 0);
                  }}
                  className={`px-4 py-2 rounded-lg ${state.salesOrderForm.privilegeCard
                    ? "bg-green-500 text-white"
                    : "bg-gray-200"
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
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "SET_SALES_ORDER_FORM",
                      payload: { privilegeCard: false, redeemOption: null },
                    }); // Reset redeemOption
                    dispatch({
                      type: "SET_SALES_ORDER_FORM",
                      payload: {
                        validationErrors: {
                          ...state.salesOrderForm.validationErrors,
                          generalError: "",
                        },
                      },
                    }); // Clear previous errors
                    setTimeout(() => {
                      if (form.redeemOption === "barcode") {
                        privilegeCardRef.current?.focus();
                      } else if (form.redeemOption === "phone") {
                        privilegePhoneRef.current?.focus();
                      }
                    }, 0);
                  }}
                  id="privilegeCard-no"
                  className={`px-4 py-2 rounded-lg ${!state.salesOrderForm.privilegeCard
                    ? "bg-green-500 text-white"
                    : "bg-gray-200"
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

              {state.salesOrderForm.privilegeCard && (
                <>
                  <p className="font-semibold mb-2">
                    How would you like to fetch your Privilege Card?
                  </p>
                  <div className="flex space-x-4 mb-4">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_SALES_ORDER_FORM",
                          payload: { redeemOption: "barcode" },
                        })
                      }
                      className={`px-4 py-2 rounded-lg ${state.salesOrderForm.redeemOption === "barcode"
                        ? "bg-green-500 text-white"
                        : "bg-gray-200"
                        }`}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight") {
                          e.preventDefault();
                          document
                            .getElementById("redeemOption-phone")
                            ?.focus();
                        } else if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          document
                            .getElementById("redeemOption-barcode")
                            ?.focus();
                        }
                      }}
                      id="redeemOption-barcode"
                    >
                      Scan Barcode
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_SALES_ORDER_FORM",
                          payload: { redeemOption: "phone" },
                        })
                      }
                      className={`px-4 py-2 rounded-lg ${state.salesOrderForm.redeemOption === "phone"
                        ? "bg-green-500 text-white"
                        : "bg-gray-200"
                        }`}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          document
                            .getElementById("redeemOption-barcode")
                            ?.focus();
                        }
                      }}
                      id="redeemOption-phone"
                    >
                      Use Phone Number
                    </button>
                  </div>

                  {/* Barcode Scan Option */}
                  {state.salesOrderForm.redeemOption === "barcode" && (
                    <>
                      <input
                        type="text"
                        placeholder="Enter Privilege Card Number (pc_number)"
                        value={state.salesOrderForm.privilegeCardNumber}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_SALES_ORDER_FORM",
                            payload: { privilegeCardNumber: e.target.value },
                          })
                        }
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
                        type="button"
                        onClick={handleFetchPrivilegeCardByNumber}
                        className="bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg w-full"
                        onKeyDown={(e) => {
                          if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            privilegeCardRef.current?.focus();
                          }
                        }}
                      >
                        Fetch Privilege Card
                      </button>
                      {state.salesOrderForm.validationErrors
                        ?.privilegeCardNumber && (
                          <p className="text-red-500 text-xs mt-1">
                            {
                              state.salesOrderForm.validationErrors
                                .privilegeCardNumber
                            }
                          </p>
                        )}
                    </>
                  )}

                  {/* Phone Number and OTP Option */}
                  {state.salesOrderForm.redeemOption === "phone" && (
                    <>
                      {/* Phone Number Input */}
                      <input
                        type="text"
                        placeholder="Enter Phone Number"
                        value={state.salesOrderForm.phoneNumber}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_SALES_ORDER_FORM",
                            payload: { phoneNumber: e.target.value },
                          })
                        }
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
                            document
                              .getElementById("redeemOption-phone")
                              ?.focus();
                          }
                        }}
                      />

                      {/* Send OTP Button */}
                      {!state.salesOrderForm.isOtpSent && (
                        <button
                          type="button"
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

                      {state.salesOrderForm.isOtpSent && (
                        <>
                          {/* OTP Input */}
                          <input
                            type="text"
                            placeholder="Enter OTP"
                            value={state.salesOrderForm.otp}
                            onChange={(e) =>
                              dispatch({
                                type: "SET_SALES_ORDER_FORM",
                                payload: { otp: e.target.value },
                              })
                            }
                            className="border border-gray-300 w-full px-4 py-3 rounded-lg text-center mb-2"
                            ref={otpRef}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleVerifyOtp();
                              }
                              if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                document
                                  .getElementById("redeemOption-phone")
                                  ?.focus();
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
                            type="button"
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
                          {validationErrors.generalError && (
                            <p className="text-red-600 text-center mt-2">
                              {validationErrors.generalError}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Show privilege card details if found */}
                  {state.salesOrderForm.isOtpVerified &&
                    state.salesOrderForm.privilegeCardDetails && (
                      <div className="mt-6 bg-gray-100 p-4 rounded border">
                        <p>
                          <strong>Customer Name:</strong>{" "}
                          {
                            state.salesOrderForm.privilegeCardDetails
                              .customer_name
                          }
                        </p>
                        <p>
                          <strong>PC Number:</strong>{" "}
                          {privilegeCardDetails.pc_number}
                        </p>
                        <p>
                          <strong>Loyalty Points:</strong>{" "}
                          {loyaltyPoints}
                        </p>

                        {/* Redeem Points Section */}
                        <div className="mt-4">
                          <p className="font-semibold">
                            Redeem Loyalty Points:
                          </p>
                          <div className="flex space-x-4 mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                dispatch({
                                  type: "SET_SALES_ORDER_FORM",
                                  payload: {
                                    redeemOption: "full",
                                    redeemPointsAmount:
                                      loyaltyPoints,
                                  },
                                });
                                dispatch({
                                  type: "SET_SALES_ORDER_FORM",
                                  payload: { redeemPoints: true },
                                });
                              }}
                              className={`px-4 py-2 mb-2 rounded-lg ${state.salesOrderForm.redeemOption === "full"
                                ? "bg-green-500 text-white"
                                : "bg-gray-200"
                                }`}
                            >
                              Redeem Full Points
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                dispatch({
                                  type: "SET_SALES_ORDER_FORM",
                                  payload: {
                                    redeemOption: "custom",
                                    redeemPointsAmount: "",
                                  },
                                });
                                dispatch({
                                  type: "SET_SALES_ORDER_FORM",
                                  payload: { redeemPoints: true },
                                });
                                setTimeout(
                                  () => redeemPointsAmountRef.current?.focus(),
                                  0
                                ); // Focus on custom amount input
                              }}
                              className={`px-4 py-2 mb-2 rounded-lg ${state.salesOrderForm.redeemOption === "custom"
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
                          {state.salesOrderForm.redeemOption === "custom" && (
                            <div className="mt-2">
                              <input
                                type="number"
                                placeholder={`Enter amount to redeem (Max: ₹${loyaltyPoints})`}
                                value={state.salesOrderForm.redeemPointsAmount}
                                onChange={(e) =>
                                  dispatch({
                                    type: "SET_SALES_ORDER_FORM",
                                    payload: {
                                      redeemPointsAmount:
                                        e.target.value === ""
                                          ? ""
                                          : Math.min(
                                            Number(e.target.value),
                                            loyaltyPoints
                                          ),
                                    },
                                  })
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
                              {(parseFloat(
                                state.salesOrderForm.redeemPointsAmount
                              ) > loyaltyPoints ||
                                parseFloat(
                                  redeemPointsAmount
                                ) < 0) && (
                                  <p className="text-red-500 text-xs mt-1">
                                    Please enter a valid amount up to your
                                    available points.
                                  </p>
                                )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Prompt to create a new privilege card if not found */}
                  {state.salesOrderForm.isOtpVerified &&
                    !state.salesOrderForm.privilegeCardDetails && (
                      <div className="mt-6 bg-green-50 p-4 rounded">
                        <p className="text-center text-red-500">
                          No Privilege Card found for this{" "}
                          {state.salesOrderForm.redeemOption === "phone"
                            ? "phone number."
                            : "PC Number."}
                        </p>
                        <button
                          type="button"
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
          {state.salesOrderForm.step === 4 && (
            <div className="bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Order Created by Employee Details
              </h2>
              <select
                value={state.salesOrderForm.employee}
                onChange={(e) =>
                  dispatch({
                    type: "SET_SALES_ORDER_FORM",
                    payload: { employee: e.target.value },
                  })
                }
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
              {state.salesOrderForm.employee && (
                <EmployeeVerification
                  employee={state.salesOrderForm.employee}
                  onVerify={(isVerified) => {
                    dispatch({
                      type: "SET_SALES_ORDER_FORM",
                      payload: { isPinVerified: true },
                    });

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

          {/* Step 5: Discount, Payment Method, Advance Details, Save and Print */}
          {step === 5 && (
            <>
              {/* Printable Area */}
              <div
                className="bg-white rounded-lg text-gray-800"
              /* Attach the ref here */
              >
                <div
                  className="printable-area print:mt-20 print:block print:absolute print:inset-0 print:w-full bg-white p-4 print:m-0 print:p-0 w-full"
                >
                  <div className=" flex justify-between items-center mb-6">
                    <div className="flex items-center">
                      <h2 className="text-3xl font-bold">Bill</h2>
                    </div>
                    <div className="text-right">
                      <p><strong>Sales ID:</strong> {salesOrderId}</p>
                      <p><strong>Date: {formattedDate}</strong></p>
                      {hasMrNumber && (
                        <>
                          <p><strong>MR Number:</strong> {mrNumber}</p>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Customer Details */}
                  <div className="mb-6">
                    {/* <p><strong>Work Order ID:</strong> {selectedWorkOrder}</p> */}
                    <p><strong>Customer Name:</strong> {hasMrNumber ? patientDetails?.name + " | " + patientDetails?.age + " | " + patientDetails?.gender : customerName + " | " + parseInt(age) + " | " + gender}</p>
                    <p><strong>Address:</strong> {hasMrNumber ? patientDetails?.address : address}</p>
                    <p><strong>Phone Number:</strong> {hasMrNumber ? patientDetails?.phone_number : customerPhone}</p>

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
                        <th className="border px-4 py-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productEntries.map((product, index) => {
                        const adjustedPrice =
                          (parseFloat(product.price) / 112) * 100 || 0;
                        const productSubtotal =
                          adjustedPrice * (parseInt(product.quantity) || 0);
                        return (
                          <tr key={index}>
                            <td className="border px-4 py-2 text-center">{index + 1}</td>
                            <td className="border px-4 py-2 text-center">{product.id}</td>
                            <td className="border px-4 py-2">{product.name}</td>
                            <td className="border px-4 py-2 text-center">{product.hsn_code}</td>
                            <td className="border px-4 py-2 text-center">₹{adjustedPrice.toFixed(2)}</td>
                            <td className="border px-4 py-2 text-center">{product.quantity}</td>
                            <td className="border px-4 py-2 text-center">₹{productSubtotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Financial Summary */}
                  <div className="flex justify-between mb-6 space-x-8">
                    <div>
                      <p><strong>Subtotal:</strong> ₹{subtotal.toFixed(2)}</p><p><strong>CGST (6%):</strong> ₹{cgstAmount.toFixed(2)}</p>
                      <p><strong>SGST (6%):</strong> ₹{sgstAmount.toFixed(2)}</p>
                      <div className=" mt-10 space-x-8">
                        <p><strong>Payment Method:</strong> {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</p>
                      </div>
                      {privilegeCard && privilegeCardDetails && (
                        <p><strong>Loyalty Points Redeemed:</strong> ₹{pointsToAdd.toFixed(2)}</p>
                      )}
                      {privilegeCard && privilegeCardDetails && (
                        <p><strong>Loyalty Points Gained:</strong> {pointsToAdd}</p>
                      )}
                    </div>
                    <div>

                      <p><strong>Advance Paid:</strong> ₹{advance.toFixed(2)}</p>
                      <p><strong>Discount Amount:</strong> ₹{calculatedDiscount.toFixed(2)}</p>
                      <p><strong>Discounted Subtotal:</strong> ₹{(Math.max(subtotal - calculatedDiscount, 0)).toFixed(2)}</p>
                      {privilegeCard && privilegeCardDetails && (
                        <p><strong>Privilege Card Discount:</strong> ₹₹{privilegeDiscount.toFixed(2)}</p>
                      )}
                      <p><strong>Total Amount:</strong> ₹{finalAmount.toFixed(2)}</p>
                      <div className=" mt-10 space-x-8">
                        <p><strong>Billed by:</strong> {employee}</p>
                      </div>
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
                  <div className="print:hidden flex flex-col md:flex-row items-center justify-between my-6 space-x-4">
                    {/* Discount Section */}
                    <div className="w-full md:w-1/2 mb-4 md:mb-0">
                      <label className="block text-gray-700 font-medium mb-1">
                        Apply Discount (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="Enter Discount Amount"
                        value={state.salesOrderForm.discount}
                        onChange={(e) => {
                          const discountValue =
                            e.target.value === "" ? "" : Math.min(
                              Math.max(Number(e.target.value), 0),
                              Math.max(subtotal - (Number(state.salesOrderForm.advanceDetails) || 0), 0)
                            );

                          dispatch({
                            type: "SET_SALES_ORDER_FORM",
                            payload: { discount: discountValue },
                          });
                        }}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        min="0"
                        max={subtotal}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            paymentMethodRef.current?.focus();
                          }
                        }}
                      />
                      {validationErrors.discount && (
                        <p className="text-red-500 text-xs mt-1">
                          {validationErrors.discount}
                        </p>
                      )}
                    </div>

                    {/* Payment Method */}
                    <div className="w-full md:w-1/2">
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
                            type: "SET_SALES_ORDER_FORM",
                            payload: { paymentMethod: e.target.value },
                          })
                        }

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

                  {/* Footer Section */}
                  <div className="flex-col justify-start mx-auto items-start text-left text-md">

                    <p className="mt-2 text-xs">
                      Terms and Conditions:
                      <ol className="list-decimal list-inside">
                        <li>Work order valid only for two months.</li>
                        <li>Branded Frames/Lenses – 12 Months warranty for manufacturing defects/peeling off.</li>
                      </ol>
                    </p>
                  </div>
                </div>

              </div>

              {/* Action Buttons Outside Printable Area */}
              <div className="action-buttons flex flex-col md:flex-row justify-start mt-6 space-x-6 space-y-4 md:space-y-0">
                <button
                  type="button" /* Ensure the type is set to "button" */
                  onClick={handleOrderCompletion}
                  ref={saveOrderRef}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      await handleOrderCompletion();
                      setTimeout(
                        () => printButtonRef.current?.focus(),
                        100
                      ); /* Move focus to Print button after saving */
                    }
                  }}
                  className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition ${!paymentMethod ||
                    parseFloat(state.salesOrderForm.discount) > subtotal
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                    } w-full md:w-auto`}
                  disabled={
                    !paymentMethod ||
                    isLoading ||
                    parseFloat(state.salesOrderForm.discount) > subtotal
                  }
                >
                  {isEditing ? "Update Order" : "Submit Order"}{" "}
                  {privilegeCard && privilegeCardDetails
                    ? "& Update Loyalty Points"
                    : ""}
                </button>

                {allowPrint && (
                  <button
                    type="button" /* Ensure the type is set to "button" */
                    onClick={handlePrint}
                    ref={printButtonRef}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handlePrint();
                        setTimeout(
                          () => newWorkOrderButtonRef.current?.focus(),
                          100
                        ); /* Move focus to Create New after printing */
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
                      type="button" /* Ensure the type is set to "button" */
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
                className={`bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg ${step === 4 && !form.isPinVerified
                  ? "opacity-50 cursor-not-allowed"
                  : ""
                  }`}


                disabled={step === 4 && !form.isPinVerified}
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

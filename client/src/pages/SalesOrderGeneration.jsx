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
import EmployeeVerification from "../components/EmployeeVerification";
import { useGlobalState } from "../context/GlobalStateContext";
import { XMarkIcon } from '@heroicons/react/24/solid'; // For solid icons

const today = new Date();
const dd = String(today.getDate()).padStart(2, "0");
const mm = String(today.getMonth() + 1).padStart(2, "0");
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

const fetchCustomerByPhone = async (phone) => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("phone_number", phone);

  if (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
  return data;
};

// Function to fetch product details from Supabase
const fetchProductDetailsFromDatabase = async (productId, branch) => {
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
      .maybeSingle();

    if (productError || !productData) {
      console.error("Error fetching product details:", productError);
      return null;
    }

    // Step 2: Fetch stock information using products.id (integer)
    const { data: stockData, error: stockError } = await supabase
      .from("stock")
      .select("quantity")
      .eq("product_id", productData.id) // Use integer id
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
  amountAfterDiscount, // Add this parameter
  subtotalWithGST,
  redeemPointsAmount,
  privilegeCard,
  privilegeCardDetails,
  loyaltyPoints
) => {
  let pointsToRedeem = 0;
  if (privilegeCard && privilegeCardDetails) {
    pointsToRedeem = Math.min(
      parseFloat(redeemPointsAmount) || 0,
      loyaltyPoints
    );
  }

  let updatedPoints = loyaltyPoints - pointsToRedeem;
  const pointsToAdd = Math.floor(amountAfterDiscount * 0.05);
  updatedPoints += pointsToAdd;
  return { updatedPoints, pointsToRedeem, pointsToAdd };
};

const normalizeWorkOrderProducts = async (workOrderProducts, branch) => {
  if (!Array.isArray(workOrderProducts)) {
    console.error("workOrderProducts is not an array:", workOrderProducts);
    return [];
  }

  // Map over workOrderProducts to use the details directly
  const normalizedProducts = workOrderProducts.map((product) => ({
    id: product.id || null, // Integer ID if available
    product_id: product.product_id, // String product_id
    name: product.product_name || product.name || "", // Use product_name from work order
    price: parseFloat(product.price) || 0,
    quantity: parseInt(product.quantity, 10) || 0,
    hsn_code: product.hsn_code || "",
    stock: 0, // Will fetch stock later
  }));

  // Fetch integer IDs for products if not available
  const productsWithoutId = normalizedProducts.filter((product) => !product.id);
  if (productsWithoutId.length > 0) {
    // Fetch integer IDs from products table
    const productIdsToFetch = productsWithoutId.map(
      (product) => product.product_id
    );
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("id, product_id")
      .in("product_id", productIdsToFetch);

    if (productsError) {
      console.error("Error fetching products data:", productsError.message);
    } else {
      const idMap = new Map();
      productsData.forEach((product) => {
        idMap.set(product.product_id, product.id);
      });

      // Update normalizedProducts with integer IDs
      normalizedProducts.forEach((product) => {
        if (!product.id && idMap.has(product.product_id)) {
          product.id = idMap.get(product.product_id);
        }
      });
    }
  }

  // Now fetch stock for these products using integer IDs
  const productIds = normalizedProducts
    .map((product) => product.id)
    .filter((id) => id !== null);

  // Fetch stock for these product IDs
  let stockMap = new Map();

  if (productIds.length > 0) {
    const { data: stockData, error: stockError } = await supabase
      .from("stock")
      .select("product_id, quantity")
      .in("product_id", productIds)
      .eq("branch_code", branch);

    if (stockError) {
      console.error("Error fetching stock data:", stockError.message);
    } else {
      stockData.forEach((stock) => {
        stockMap.set(stock.product_id, stock.quantity);
      });
    }
  }

  // Update normalizedProducts with stock
  const updatedProducts = normalizedProducts.map((product) => {
    const stockQuantity = stockMap.get(product.id) || 0;
    return {
      ...product,
      stock: stockQuantity,
    };
  });

  return updatedProducts;
};

// Helper function to calculate differences between original and updated products
const calculateProductDifferences = (original, updated) => {
  const differences = [];
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
  loyaltyPoints,
  insuranceInfo
) {
  // Constants for GST rates
  const CGST_RATE = 0.06; // 6%
  const SGST_RATE = 0.06; // 6%
  const GST_RATE = CGST_RATE + SGST_RATE; // Total GST rate (12%)

  // Helper functions for parsing and validation
  const parsePrice = (price) => {
    const parsed = parseFloat(price);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  const parseQuantity = (quantity) => {
    const parsed = parseInt(quantity, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  };

  // **Step 1: Calculate Subtotal Including GST**
  const subtotalWithGST = productEntries.reduce((acc, product) => {
    const priceIncludingGST = parsePrice(product.price);
    const quantity = parseQuantity(product.quantity);
    return acc + priceIncludingGST * quantity;
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
  const taxableValue = amountAfterDiscount;
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
    const redeemAmount = parsePrice(redeemPointsAmount);
    privilegeDiscount = Math.min(redeemAmount, loyaltyPoints, balanceDue);
    balanceDue -= privilegeDiscount;
    // Ensure balanceDue is not negative after privilege discount
    balanceDue = Math.max(balanceDue, 0);
  }

  let insuranceDeduction = 0;
  if (insuranceInfo) {
    insuranceDeduction = parseFloat(insuranceInfo.approved_amount) || 0;
    // Ensure deduction doesn't exceed balance
    insuranceDeduction = Math.min(insuranceDeduction, balanceDue);
    balanceDue -= insuranceDeduction;
    balanceDue = Math.max(balanceDue, 0); // Ensure non-negative
  }

  // **Step 6: Final Payment Due**
  const finalAmount = balanceDue.toFixed(2); // Final amount after all deductions

  return {
    amountAfterDiscount: amountAfterDiscount.toFixed(2), // Add this line
    subtotalWithGST: subtotalWithGST.toFixed(2),
    subtotalWithoutGST: taxableValue.toFixed(2), // Add this line
    totalDiscount: totalDiscount.toFixed(2),
    taxableValue: taxableValue.toFixed(2),
    gstAmount: gstAmount.toFixed(2),
    cgstAmount: cgstAmount.toFixed(2),
    sgstAmount: sgstAmount.toFixed(2),
    advance: advancePaid.toFixed(2),
    balanceDue: balanceDue.toFixed(2),
    privilegeDiscount: privilegeDiscount.toFixed(2),
    finalAmount,
    insuranceDeduction: insuranceDeduction.toFixed(2),
    // balanceDue: balanceDue.toFixed(2),
    // finalAmount,
  };
}

// Main Component
const SalesOrderGeneration = memo(({ isCollapsed, onModificationSuccess }) => {
  const { user, role, name, branch, loading: authLoading, subRole } = useAuth();
  // console.log("branch:", branch); // Destructure branch from AuthContext
  // console.log("subRole:", subRole); // Destructure subRole from AuthContext
  const [validationErrors, setValidationErrors] = useState({});


  const { state, dispatch, resetState } = useGlobalState(); // Access global state
  const { salesOrderForm } = state;

  const resetTransientFields = () => {
    dispatch({
      type: "SET_SALES_ORDER_FORM",
      payload: {
        isLoading: false,
        isOtpSent: false,
        isPinVerified: false,
        validationErrors: {},
      },
    });
  };

  // Reset transient fields on mount (if necessary)

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
    // validationErrors,
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


  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!submitted && !isPrinted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [submitted, isPrinted]);

  useEffect(() => {
    // Only restore saved state if not submitted
    if (!submitted) {
      const savedState = sessionStorage.getItem('salesOrderFormState');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          dispatch({
            type: 'RESTORE_SALES_ORDER_FORM',
            payload: parsedState
          });
        } catch (err) {
          console.error('Error restoring saved state:', err);
        }
      }
    }
  }, [dispatch, submitted]);
  useEffect(() => {
    // Check if there's saved state in sessionStorage
    const savedState = sessionStorage.getItem('salesOrderFormState');

    if (savedState) {
      try {
        // Restore the saved state
        const parsedState = JSON.parse(savedState);
        dispatch({
          type: 'RESTORE_SALES_ORDER_FORM',
          payload: parsedState
        });

        // Still reset just the transient fields
        resetTransientFields();
      } catch (err) {
        console.error('Error restoring saved sales order state:', err);
        // If restoration fails, just reset transient fields
        resetTransientFields();
      }
    } else {
      // If no saved state, just reset transient fields
      resetTransientFields();
    }

    // Save state to sessionStorage when component unmounts
    return () => {
      // Don't save if already submitted
      if (!submitted) {
        sessionStorage.setItem(
          'salesOrderFormState',
          JSON.stringify(salesOrderForm)
        );
      }
    };
  }, [dispatch, submitted]);

  // Add this effect to clear storage after successful submission
  useEffect(() => {
    if (submitted && isPrinted) {
      // Clear saved state after successful completion
      sessionStorage.removeItem('salesOrderFormState');
    }
  }, [submitted, isPrinted]);
  // Local states
  const [originalProductEntries, setOriginalProductEntries] = useState([
    { id: "", product_id: "", name: "", price: "", quantity: "" },
  ]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [isGeneratingId, setIsGeneratingId] = useState(false);
  // State for consultant
  const [consultantName, setConsultantName] = useState('');
  const [consultantList, setConsultantList] = useState([
    "Dr. Ashad Sivaraman",
    "Dr. Harshali Yadav",
    "Dr. Swapna Nair",
    "Dr. Anoop Sivaraman",
    "Dr. Anila George",
    "Dr. Arvin Ponnat",
    "Dr. Shabna",
    "Dr. Malavika. G",
  ]);
  const [useManualConsultant, setUseManualConsultant] = useState(false);

  const fetchConsultants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('consultants')
        .select('*');
      if (error) throw error;
      setConsultantList(data || []);
    } catch (err) {
      console.error('Error fetching consultants:', err);
    }
  }, []);


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
  const gstNumberRef = useRef(null);


  const navigate = useNavigate();
  const location = useLocation();
  const { orderId } = useParams();

  // Helper function to update global form state
  const updateSalesOrderForm = (payload) => {
    dispatch({
      type: "SET_SALES_ORDER_FORM",
      payload,
    });
  };

  // 1. Add new function to generate general sales order ID
  const generateGeneralSalesId = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("sales_order_id")
        .like("sales_order_id", "GNS-%")
        .order("sales_order_id", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching last general sales order ID:", error);
        return "GNS-00001";
      }

      if (!data || data.length === 0) {
        return "GNS-00001";
      }

      // Extract number from last ID and increment
      const lastId = data[0].sales_order_id;
      const lastNumber = parseInt(lastId.split("-")[1], 10);
      const newNumber = (lastNumber + 1).toString().padStart(5, "0");
      return `GNS-${newNumber}`;
    } catch (error) {
      console.error("Error generating general sales ID:", error);
      return "GNS-00001";
    }
  };

  // Function to create a new customer
  const saveCustomerDetails = async (customerDetails) => {
    const { name, phone_number, address, gender, age } = customerDetails;

    const { data, error } = await supabase
      .from("customers")
      .insert({
        name,
        phone_number,
        address,
        age: parseInt(age, 10),
        gender,
      })
      .select();

    if (error) {
      console.error("Error saving customer details:", error);
      throw error; // Stop further execution on failure
    }
    return data; // Returns an array of inserted records
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

  const processWorkOrder = (workOrderId) => {
    console.log("Processing work order:", workOrderId);

    if (workOrderId.startsWith("OPW")) {
      // Action for OPW work orders
      console.log("Processing OPW work order:", workOrderId);
      // Add specific logic for OPW
    } else if (workOrderId.startsWith("CR")) {
      // Action for CR work orders
      console.log("Processing CR work order:", workOrderId);
      // Add specific logic for CR
    } else {
      // Default action for other work orders
      console.log("Unknown work order type:", workOrderId);
      // Add fallback logic if needed
    }
  };

  const handleProceedWithoutWorkOrder = async () => {
    const generalSalesId = await generateGeneralSalesId();

    updateSalesOrderForm({
      step: 1,
      salesOrderId: generalSalesId,
      selectedWorkOrder: null,
      workOrderId: null,
      // Reset any work order related fields
      workOrderDiscount: 0,
      advanceDetails: "",
    });
  };



  const generateSalesOrderId = async (branch) => {
    try {
      console.log("Generating unique sales order ID...");

      if (!branch) {
        console.error("Branch is undefined. Cannot generate Sales Order ID.");
        return null;
      }

      // Extract the OP number from the work order if available
      let opNumber = "01"; // Default OP Number
      if (selectedWorkOrder && selectedWorkOrder.work_order_id) {
        const workOrderId = selectedWorkOrder.work_order_id;

        // Try to extract OP number from work order ID format
        let match = workOrderId.match(/CR-(\d+)-/);
        if (!match) {
          match = workOrderId.match(/OPW-(\d+)-/);
        }

        if (match && match[1]) {
          opNumber = match[1];
          console.log("Extracted OP Number:", opNumber);
        }
      }

      // Call the database function to get next ID atomically
      const { data: nextId, error } = await supabase.rpc('get_next_sales_order_id', {
        branch_code: branch,
        role_code: subRole  // This can be null
      });

      if (error) {
        console.error("Error generating Sales Order ID:", error);
        return null;
      }

      console.log("Database returned next ID:", nextId);

      // Determine prefix based on work order type
      let newSalesOrderId;
      if (selectedWorkOrder) {
        const workOrderId = selectedWorkOrder.work_order_id;

        if (workOrderId && workOrderId.startsWith("OPW")) {
          // Format for OPW work orders
          console.log("Generating ID for OPW work order");

          newSalesOrderId = `OPS-${opNumber}-${String(nextId).padStart(3, "0")}`;
        } else if (workOrderId && workOrderId.startsWith("CR")) {
          // Format for CR work orders
          newSalesOrderId = `CRS-${opNumber}-${String(nextId).padStart(3, "0")}`;
        } else {
          // Default format if work order type cannot be determined
          console.log("Generating ID for general sales order");
          newSalesOrderId = `GNS-${String(nextId).padStart(5, "0")}`;
        }
      } else {
        // For general sales (no work order)
        newSalesOrderId = `GNS-${String(nextId).padStart(5, "0")}`;
      }

      console.log("Generated Sales Order ID:", newSalesOrderId);

      // Update the sales order form with the new ID
      updateSalesOrderForm({ salesOrderId: newSalesOrderId });

      return newSalesOrderId;
    } catch (error) {
      console.error("Error generating sales order ID:", error);
      return null;
    }
  };




  const fetchSalesOrderId = async () => {
    if (branch && !isEditing) {
      // Only generate ID if not editing
      const newSalesOrderId = await generateSalesOrderId(branch); // Pass branch here
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

  const fetchProductSuggestions = async (query, type) => {
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
  };

  // Function to handle changes in product fields
  const handleProductChange = (index, field, value) => {
    const updatedProductEntries = [...productEntries];
    updatedProductEntries[index][field] = value;
    updateSalesOrderForm({ productEntries: updatedProductEntries });

    // If the product_id is changed, fetch the new product details
    if (field === "product_id") {
      handleProductInputChange(index, value);
    }

    validateField(index, field);
  };

  // Function to handle product ID input changes and fetch product details
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
        id: productDetails.id, // Use integer id for stock operations
        product_id: productDetails.product_id, // Keep string product_id for display
        name: productDetails.product_name,
        price: productDetails.mrp || "",
        stock: productDetails.stock || 0,
        quantity: updatedEntries[index].quantity || "",
        hsn_code: productDetails.hsn_code || "",
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

  const fetchExistingSalesOrder = useCallback(
    async (orderId) => {
      try {
        console.log(`Fetching sales order with ID: ${orderId}`);
        const { data, error } = await supabase
          .from("sales_orders")
          .select("*")
          .eq("sales_order_id", orderId)
          .single();

        if (error || !data) {
          console.error("Sales Order Not Found:", error?.message || "No data");
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Sales Order Not Found.",
            },
          });
          return;
        }

        console.log("Fetched Sales Order Data:", data);

        // Normalize product entries with correct product IDs and stock
        const normalizedProducts = await normalizeWorkOrderProducts(
          data.items, // Assuming 'items' holds product_entries
          branch
        );

        console.log("Normalized Products:", normalizedProducts);

        // Update global form state with fetched data
        updateSalesOrderForm({
          productEntries: normalizedProducts,
          salesOrderId: data.sales_order_id, // Ensure salesOrderId is updated
          mrNumber: data.mr_number || "",
          customerId: data.customer_id || "", // Add customerId to the state
          advanceDetails: data.advance_details
            ? data.advance_details.toString()
            : "",
          employee: data.employee || "",
          paymentMethod: data.payment_method || "",
          loyaltyPoints: data.loyalty_points_redeemed || 0,
          hasMrNumber: data.hasMr_number ? "yes" : "no",
          discount: data.discount ? data.discount.toString() : "",
          privilegeCard: data.pc_number ? true : false,
          privilegeCardNumber: data.pc_number || "",
          isEditing: true, // Indicates editing mode
          validationErrors: {}, // Clear validation errors
          step: 1, // Move to the next step (adjust as per your step logic)
        });

        setOriginalProductEntries(normalizedProducts); // Store original entries

        // Fetch privilege card details if applicable
        if (data.pc_number) {
          const { data: privilegeData, error: privilegeError } = await supabase
            .from("privilegecards")
            .select("*")
            .eq("pc_number", data.pc_number)
            .single();

          if (privilegeError || !privilegeData) {
            updateSalesOrderForm({ privilegeCardDetails: null });
            updateSalesOrderForm({
              validationErrors: {
                ...validationErrors,
                generalError:
                  "Privilege Card not found for the given PC Number.",
              },
            });
          } else {
            updateSalesOrderForm({
              privilegeCardDetails: privilegeData,
              isPinVerified: true,
            });
          }
        }

        updateSalesOrderForm({
          validationErrors: { ...validationErrors, generalError: "" },
        });

        // Fetch customer details via customer_id
        if (data.customer_id) {
          const customer = await fetchCustomerById(data.customer_id.trim());

          if (customer) {
            updateSalesOrderForm({
              patientDetails: {
                name: customer.name,
                age: customer.age,
                condition: customer.condition || "N/A", // Assuming condition is applicable
                phone_number: customer.phone_number || "N/A",
                gender: customer.gender || "N/A",
                address: customer.address || "N/A",
              },
              validationErrors: {
                ...validationErrors,
                generalError: "",
              },
            });
          } else {
            updateSalesOrderForm({
              patientDetails: null,
              validationErrors: {
                ...validationErrors,
                generalError: "No customer found with the provided ID.",
              },
            });
          }
        } else {
          updateSalesOrderForm({
            patientDetails: null,
            validationErrors: {
              ...validationErrors,
              generalError:
                "Selected work order doesn't contain a Customer ID.",
            },
          });
        }
      } catch (error) {
        console.error("Error fetching sales order:", error);
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "Failed to fetch sales order details.",
          },
        });
      }
    },
    [updateSalesOrderForm, validationErrors, branch]
  );

  // New helper function to fetch customer by customer_id
  const fetchCustomerById = async (customerId) => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("customer_id", customerId)
      .single();

    if (error) {
      console.error("Error fetching customer by ID:", error.message);
      return null;
    }
    return data;
  };

  useEffect(() => {
    if (orderId) {
      // Fetch the sales order data using orderId
      fetchExistingSalesOrder(orderId);
    }
  }, [orderId]);


  const {
    subtotalWithGST,
    subtotalWithoutGST, // Add this line
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
    insuranceDeduction,
  } = useMemo(() => {
    return calculateAmounts(
      productEntries,
      advanceDetails,
      discount, // salesDiscountAmount
      workOrderDiscount, // workOrderDiscountAmount
      privilegeCard,
      privilegeCardDetails,
      redeemPointsAmount,
      loyaltyPoints,
      salesOrderForm.insuranceInfo // Pass insurance info here

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
    salesOrderForm.insuranceInfo,
  ]);

  // Function to fetch patient by MR number
  // Function to fetch patient by MR number
  const fetchPatientByMRNumber = async (mrNumber) => {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("mr_number", mrNumber)
      .maybeSingle();

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
      const pcNumber = salesOrderForm.privilegeCardNumber?.trim();

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
          isPinVerified: true, // Assuming successful fetch auto-verifies
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
          privilegeCardNumber:
            "An unexpected error occurred. Please try again.",
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
      const card = await fetchPrivilegeCardByPhone(customerPhone);
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
        query = query.eq("mr_number", searchQuery);
      } else if (fetchMethod === "phone_number") {
        console.log("Search query (phone number):", searchQuery);

        // Fetch customer by phone number
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("*")
          .eq("phone_number", searchQuery);

        console.log("Customer query result:", customer);

        if (customerError) {
          console.error("Error fetching customers:", customerError.message);
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Failed to fetch customers.",
            },
          });
          updateSalesOrderForm({ isFetchingWorkOrders: false });
          return;
        }

        if (!customer || customer.length === 0) {
          console.error("No customers found for the given phone number.");
          updateSalesOrderForm({ workOrders: [] });
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "No customers found with this phone number.",
            },
          });
          updateSalesOrderForm({ isFetchingWorkOrders: false });
          return;
        }

        const customerId = customer[0].customer_id; // Extract the ID
        console.log("Customer ID:", customerId);

        query = query.eq("customer_id", customerId);
      }

      // Exclude work orders that are already used and belong to the current branch
      query = query.eq("is_used", false).eq("branch", branch);

      const { data, error } = await query
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching work orders:", error.message);
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "Failed to fetch work orders.",
          },
        });
      } else {
        updateSalesOrderForm({ workOrders: data });
        updateSalesOrderForm({
          validationErrors: {
            ...validationErrors,
            generalError: "",
          },
        });

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
          generalError: "Failed to fetch work orders.",
        },
      });
      updateSalesOrderForm({ isFetchingWorkOrders: false });
    }
  };

  const handleSelectWorkOrder = async (workOrder) => {
    if (!branch) {
      console.error("Branch is undefined. Cannot normalize products.");
      return;
    }

    console.log("Selected Work Order:", workOrder);
    console.log("Product Entries:", workOrder.product_entries);

    if (!Array.isArray(workOrder.product_entries)) {
      console.error(
        "product_entries is not an array:",
        workOrder.product_entries
      );
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "Invalid product entries in the selected work order.",
        },
      });
      return;
    }

    const normalizedProducts = await normalizeWorkOrderProducts(
      workOrder.product_entries,
      branch
    );

    if (!Array.isArray(normalizedProducts)) {
      console.error(
        "Normalized products are not an array:",
        normalizedProducts
      );
      return;
    }

    setSelectedWorkOrder({
      ...workOrder,
      product_entries: normalizedProducts,
      discount_amount: workOrder.discount_amount || 0,
    });
    setShowWorkOrderModal(true);
  };

  async function confirmWorkOrderSelection() {
    if (!selectedWorkOrder) {
      console.error("No work order selected.");
      return;
    }

    // Ensure branch is available
    if (!branch) {
      console.error("Branch is undefined. Cannot normalize products.");
      return;
    }

    // IMPORTANT FIX: Generate sales order ID based on selected work order FIRST
    console.log("Work Order ID:", selectedWorkOrder.work_order_id);
    const newSalesOrderId = await generateSalesOrderId(branch);

    if (!newSalesOrderId) {
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "Failed to generate sales order ID"
        }
      });
      return;
    }

    console.log("Generated Sales Order ID:", newSalesOrderId);



    // Normalize products with branch
    const normalizedProducts = await normalizeWorkOrderProducts(
      selectedWorkOrder.product_entries,
      branch
    );

    if (!Array.isArray(normalizedProducts)) {
      console.error(
        "Normalized products are not an array:",
        normalizedProducts
      );
      return;
    }

    let insuranceInfo = null;
    if (selectedWorkOrder.is_insurance) {
      try {
        // Fetch insurance claim based on MR number
        const { data: claimData, error: claimError } = await supabase
          .from("insurance_claims")
          .select("*")
          .eq("mr_number", selectedWorkOrder.mr_number)
          .eq("status", "pending") // Only get approved claims
          .order("created_at", { ascending: false })
          .limit(1);

        if (claimError) {
          console.error("Error fetching insurance claim:", claimError);
        } else if (claimData && claimData.length > 0) {
          insuranceInfo = claimData[0];
          console.log("Insurance claim found:", insuranceInfo);
        }
      } catch (err) {
        console.error("Error processing insurance claim:", err);
      }
    }

    // Update global state
    updateSalesOrderForm({
      mrNumber: selectedWorkOrder.mr_number,
      advanceDetails: selectedWorkOrder.advance_details || "",
      hasMrNumber: selectedWorkOrder.mr_number ? "yes" : "no",
      productEntries: normalizedProducts,
      workOrderDiscount: selectedWorkOrder.discount_amount || 0,
      insuranceInfo: insuranceInfo, // Add insurance info to state
    });

    setOriginalProductEntries(normalizedProducts);
    setShowWorkOrderModal(false);

    // Automatically fetch patient or customer details
    const consultantFromWorkOrder = selectedWorkOrder.consultant_name || '';



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
          validationErrors: {
            ...validationErrors,
            generalError: "",
          },
        });
      } else {
        updateSalesOrderForm({
          patientDetails: null,
          validationErrors: {
            ...validationErrors,
            generalError: "No patient found with the provided MR Number.",
          },
        });
      }
    } else if (selectedWorkOrder.patient_details) {
      // Use patient_details from the work order
      const patientDetails = selectedWorkOrder.patient_details;

      updateSalesOrderForm({
        patientDetails: {
          name: patientDetails.name || "",
          age: patientDetails.age || "",
          condition: patientDetails.condition || "N/A",
          phone_number: patientDetails.phone_number || "N/A",
          gender: patientDetails.gender || "N/A",
          address: patientDetails.address || "N/A",
        },
        customerName: patientDetails.name || "",
        customerPhone: patientDetails.phone_number || "",
        address: patientDetails.address || "",
        age: patientDetails.age || "",
        gender: patientDetails.gender || "",
        validationErrors: {
          ...validationErrors,
          generalError: "",
        },
      });
    } else {
      // If patient_details is not present, try fetching customer details using phone number
      const customerPhone =
        selectedWorkOrder.patient_details?.phone_number ||
        selectedWorkOrder.customer_phone;

      if (customerPhone) {
        // console.log("Fetching customer details using phone number:", customerPhone.trim());

        const customer = await fetchCustomerByPhone(customerPhone);
        if (customer) {
          updateSalesOrderForm({
            patientDetails: {
              name: customer.name,
              age: customer.age,
              condition: customer.condition || "N/A",
              phone_number: customer.phone_number || "N/A",
              gender: customer.gender || "N/A",
              address: customer.address || "N/A",
            },
            customerName: customer.name || "",
            customerPhone: customer.phone_number || "",
            address: customer.address || "",
            age: customer.age || "",
            gender: customer.gender || "",
            validationErrors: {
              ...validationErrors,
              generalError: "",
            },
          });
        } else {
          updateSalesOrderForm({
            patientDetails: null,
            validationErrors: {
              ...validationErrors,
              generalError: "No customer found with the provided phone number.",
            },
          });
        }
      } else {
        // No MR number, no patient_details, and no customer_phone
        updateSalesOrderForm({
          patientDetails: null,
          validationErrors: {
            ...validationErrors,
            generalError:
              "Selected work order doesn't contain customer details.",
          },
        });
      }
    }
    setConsultantName(consultantFromWorkOrder);
    console.log("Consultant Name from Work Order:", consultantFromWorkOrder);


    // Move to the next step
    updateSalesOrderForm({ step: 1 });
  }

  // Function to send OTP
  const handleSendOtp = () => {
    console.log("handleSendOtp called");

    const { state, dispatch } = useGlobalState();
    const { salesOrderForm, validationErrors } = state;
    const phoneNumber = salesOrderForm.customerPhone?.trim(); // Access from global state

    console.log("Entered Phone Number:", phoneNumber);

    if (
      !phoneNumber ||
      phoneNumber.length !== 10 ||
      !/^\d+$/.test(phoneNumber)
    ) {
      // Update validation error in global state
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: {
          validationErrors: {
            ...validationErrors,
            customerPhone: "Please enter a valid 10-digit phone number.",
          },
        },
      });

      privilegePhoneRef.current?.focus();
      return;
    }

    // Update isOtpSent and clear validation errors in global state
    dispatch({
      type: "SET_SALES_ORDER_FORM",
      payload: {
        isOtpSent: true,
        validationErrors: {
          ...validationErrors,
          customerPhone: null, // Clear phone validation error
        },
      },
    });

    // Mock OTP alert for testing
    alert(`Mock OTP for testing purposes: ${mockOtp}`);
    setTimeout(() => {
      otpRef.current?.focus();
    }, 100);
  };

  const handleVerifyOtp = async () => {
    // Accessing salesOrderForm and validationErrors from global state
    const { state, dispatch } = useGlobalState();
    const { salesOrderForm, validationErrors } = state;

    if (salesOrderForm.otp === mockOtp) {
      // Update global state for isPinVerified
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: {
          isPinVerified: true,
          validationErrors: {
            ...validationErrors,
            generalError: "", // Clear general errors
          },
        },
      });

      // Perform fetch privilege card operation
      await handleFetchPrivilegeCard();

      setTimeout(() => {
        if (!validationErrors.generalError) {
          nextButtonRef.current?.focus();
        }
      }, 0); // Focus on the next button if no errors
    } else {
      // Set validation error in global state
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: {
          validationErrors: {
            ...validationErrors,
            generalError: "Incorrect OTP. Please try again.",
          },
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
          privilegeCard: salesOrderForm.privilegeCard,
          redeemPoints: salesOrderForm.redeemPoints,
          redeemPointsAmount: salesOrderForm.redeemPointsAmount,
          loyaltyPoints,
          discount,
          privilegeCardNumber: salesOrderForm.privilegeCardNumber,
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
  }, [step, salesOrderForm.privilegeCard, salesOrderForm.redeemOption]);

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
    }
    if (field === "price") {
      const price = parseFloat(productEntries[index].price);
      if (isNaN(price) || price < 0) {
        errors[`productPrice-${index}`] = "Enter a valid non-negative number";
      } else {
        delete errors[`productPrice-${index}`];
      }
    } else if (field === "quantity") {
      const quantity = parseInt(productEntries[index].quantity, 10);
      if (!quantity) {
        errors[`productQuantity-${index}`] = "Quantity is required";
      } else if (quantity <= 0) {
        errors[`productQuantity-${index}`] = "Quantity must be greater than zero";
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
      productEntries.forEach((product, index) => {
        if (!product.id) errors[`productId-${index}`] = "Product ID is required";
        if (!product.price) errors[`productPrice-${index}`] = "Price is required";
        if (!product.quantity) errors[`productQuantity-${index}`] = "Quantity is required";
        else {
          const quantity = parseInt(product.quantity, 10);
          if (isNaN(quantity) || quantity <= 0) {
            errors[`productQuantity-${index}`] = "Enter a valid quantity";
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
          errors.customerName = "Name is required";
        }
        if (!customerPhone.trim()) {
          errors.customerPhone = "Phone number is required";
        } else if (!/^\d{10}$/.test(customerPhone)) {
          errors.customerPhone = "Please enter a valid 10-digit phone number";
        }
        if (!address.trim()) errors.address = "Address is required.";
        if (!age) errors.customerAge = "Age is required.";
        if (age && parseInt(age) < 0)
          errors.customerAge = "Age cannot be negative.";
        if (!gender) errors.customerGender = "Gender is required.";
      }
    } else if (step === 3 && privilegeCard) {
      if (redeemOption === "phone") {
        if (!customerPhone.trim())
          errors.customerPhone = "Phone number is required";
        if (!salesOrderForm.otp.trim()) errors.otp = "OTP is required";
        if (!isPinVerified) errors.otp = "Please verify the OTP";
      }
      if (
        redeemPointsAmount &&
        (parseFloat(redeemPointsAmount) > loyaltyPoints ||
          parseFloat(redeemPointsAmount) < 0)
      ) {
        errors.redeemPointsAmount = "Invalid redemption amount";
      }
      if (
        discount !== "" &&
        (parseFloat(discount) < 0 || parseFloat(discount) > 100)
      ) {
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
    if (step === 0) {
      workOrderInputRef.current?.focus();
    }


    if (step === 1) document.getElementById(`productId-0`)?.focus();
    if (step === 2) {
      if (hasMrNumber === "yes") {
        mrNumberRef.current?.focus();
      } else if (hasMrNumber === "no") {
        customerNameRef.current?.focus();
      }
    }
    if (step === 3 && salesOrderForm.privilegeCard) {
      if (salesOrderForm.redeemOption === "barcode") {
        privilegeCardRef.current?.focus();
      } else if (salesOrderForm.redeemOption === "phone") {
        privilegePhoneRef.current?.focus();
      }
    }
    if (step === 4) employeeRef.current?.focus();
    if (step === 5) {
      discountInputRef.current?.focus();
    }

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



  // Function to reset the form
  const resetForm = () => {
    // Only reset if user confirms
    if (window.confirm("Are you sure you want to reset the form? All unsaved changes will be lost.")) {
      dispatch({ type: "RESET_SALES_ORDER_FORM" });
      setOriginalProductEntries([
        { id: "", product_id: "", name: "", price: "", quantity: "" },
      ]);
      setProductSuggestions([]);
      setIsGeneratingId(false);
      sessionStorage.removeItem('salesOrderFormState');
    }
  };


  const handleExit = () => {
    if (window.confirm("Are you sure you want to exit?")) {
      sessionStorage.removeItem('salesOrderFormState');
      dispatch({ type: "RESET_SALES_ORDER_FORM" });
      navigate("/home");
    }
  };
  const handlePrint = useCallback(() => {
    window.print();

    // Mark as printed but don't reset yet
    dispatch({
      type: "SET_SALES_ORDER_FORM",
      payload: { isPrinted: true }
    });

    // Ask for confirmation before resetting and navigating
    if (window.confirm("Print completed. Would you like to start a new sales order?")) {
      resetForm();
      navigate("/home");
    }
  }, [dispatch, navigate]);


  // Function to save the sales order
  const saveSalesOrder = async () => {
    if (isSaving || submitted) {
      alert(submitted ? "Sales order already submitted" : "Please wait while saving...");
      return;
    }

    // Set saving state
    dispatch({
      type: "SET_SALES_ORDER_FORM",
      payload: {
        isSaving: true,
        validationErrors: {}
      }
    });

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
        dispatch({
          type: "SET_SALES_ORDER_FORM",
          payload: {
            isSaving: false,
            validationErrors: {
              ...validationErrors,
              [validation.errorKey]: validation.message
            }
          }
        });
        validation.ref.current?.focus();
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
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: {
          isSaving: false,
          validationErrors: productErrors
        }
      });
      const firstErrorKey = Object.keys(productErrors)[0];
      if (
        firstErrorKey.startsWith("productId") ||
        firstErrorKey.startsWith("productPrice") ||
        firstErrorKey.startsWith("productQuantity")
      ) {
        const index = parseInt(firstErrorKey.split("-")[1], 10);
        quantityRefs.current[index]?.focus();
      }
      return;
    }

    try {
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
        parseFloat(amountAfterDiscount), // Use amountAfterDiscount instead of subtotalWithGST
        parseFloat(subtotalWithGST),
        parseFloat(redeemPointsAmount),
        privilegeCard,
        privilegeCardDetails,
        loyaltyPoints
      );

      // Prepare the payload
      const payload = {
        sales_order_id: salesOrderId,
        branch,
        sub_role: subRole,
        work_order_id: selectedWorkOrder?.work_order_id || 'GENERAL',
        employee,
        mr_number: mrNumber,
        patient_phone: customerPhone,
        payment_method: paymentMethod,
        discount: parseFloat(discount) || 0,
        advance_details: parseFloat(advanceDetails) || 0,
        total_amount: parseFloat(finalAmount),
        subtotal: parseFloat(subtotalWithoutGST),
        cgst: parseFloat(cgstAmount),
        sgst: parseFloat(sgstAmount),
        product_entries: productEntries.map((entry) => ({
          product_id: entry.id,
          quantity: parseInt(entry.quantity, 10),
          price: parseFloat(entry.price),
          hsn_code: entry.hsn_code,
        })),
        created_at: getCurrentUTCDateTime(),
        consultant_name: consultantName,
        updated_at: getCurrentUTCDateTime(),
      };

      // Insert the sales order into the database
      const { error: insertError } = await supabase
        .from("sales_orders")
        .insert([payload]);

      if (insertError) {
        console.error("Error inserting sales order:", insertError);
        dispatch({
          type: "SET_SALES_ORDER_FORM",
          payload: {
            isSaving: false,
            validationErrors: {
              generalError: "An error occurred while saving the sales order. Please try again."
            }
          }
        });
        return;
      }

      // Update loyalty points if applicable
      if (privilegeCard && privilegeCardDetails) {
        const { error } = await supabase
          .from("privilegecards")
          .update({ loyalty_points: updatedPoints })
          .eq("pc_number", privilegeCardDetails.pc_number);

        if (error) {
          console.error("Error updating loyalty points:", error);
        } else {
          console.log("Loyalty points updated successfully.");
        }
      }

      // Update state to show success and enable print button
      // CRITICAL: Make sure this runs BEFORE the session storage is removed
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: {
          submitted: true,
          allowPrint: true,
          isSaving: false,
          isPrinted: false,
          // DON'T reset the step - keep it at 5 to show print and exit buttons
        }
      });

      // Remove form state from sessionStorage
      // sessionStorage.removeItem('salesOrderFormState');

    } catch (err) {
      console.error("Error saving sales order:", err);
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: {
          isSaving: false,
          validationErrors: {
            generalError: "Failed to save sales order. Please try again."
          }
        }
      });
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
                <strong>Work Order ID:</strong>{" "}
                {selectedWorkOrder.work_order_id}
              </p>
              <p>
                <strong>Advance Amount Paid:</strong> ₹
                {parseFloat(selectedWorkOrder.advance_details).toFixed(2)}
              </p>
              {/* <p>
                <strong>CGST:</strong> ₹
                {parseFloat(selectedWorkOrder.cgst).toFixed(2)}
              </p>
              <p>
                <strong>SGST:</strong> ₹
                {parseFloat(selectedWorkOrder.sgst).toFixed(2)}
              </p> */}
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
                              <td className="py-1 px-2">
                                {product.product_id}
                              </td>
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
                    className={`px-4 py-2 rounded-lg ${salesOrderForm.fetchMethod === "work_order_id"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                      }`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        document
                          .getElementById("fetchMethod-mr_number")
                          ?.focus();
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
                    className={`px-4 py-2 rounded-lg ${salesOrderForm.fetchMethod === "mr_number"
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
                    className={`px-4 py-2 rounded-lg ${salesOrderForm.fetchMethod === "phone_number"
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
                <p className="text-red-500 text-xs mt-1">
                  {validationErrors.generalError}
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
                            {/* <p>
                              <strong>Due Date:</strong> {workOrder.due_date}
                            </p> */}
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
                    onClick={handleProceedWithoutWorkOrder}
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
                    <div
                      key={index}
                      className="flex space-x-2 items-center relative"
                    >
                      {/* Product ID Input */}
                      <div className="relative w-2/4">
                        <input
                          type="text"
                          id={`productId-${index}`}
                          placeholder="Enter Product ID"
                          value={product.product_id || ""}
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

                            handleProductChange(index, "product_id", value); // Update product_id field
                            await handleProductInputChange(index, value); // Fetch product details
                          }}
                          onBlur={async () => {
                            const selectedProduct = productSuggestions[
                              index
                            ]?.find(
                              (prod) => prod.product_id === product.product_id // Corrected comparison
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
                                  "product_id",
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

                      {/* Product Price Input (Editable) */}
                      <div className="relative w-1/3">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="Price"
                          value={product.price}
                          onChange={(e) =>
                            handleProductChange(index, "price", e.target.value)
                          }
                          className="border border-gray-300 px-4 py-3 rounded-lg w-full text-center bg-white"
                        />
                        {validationErrors[`productPrice-${index}`] && (
                          <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                            {validationErrors[`productPrice-${index}`]}
                          </p>
                        )}
                      </div>

                      {/* Quantity Input */}
                      <div className="relative w-2/4">

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
                                      product_id: "",
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
                                    product_id: "",
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
                              // Focus on the next input field, e.g., price or delete button
                              const nextIndex = index + 1;
                              if (nextIndex < productEntries.length) {
                                document
                                  .getElementById(`productId-${nextIndex}`)
                                  ?.focus();
                              }
                            } else if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              document
                                .getElementById(`productPrice-${index}`)
                                ?.focus();
                            }
                          }}
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
                        onKeyDown={(e) => {
                          if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            document
                              .getElementById(`productQuantity-${index}`)
                              ?.focus();
                          }
                        }}
                        aria-label={`Remove Product ${index + 1}`}
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                <button
                  type="button" // Ensure type="button" to prevent form submission
                  onClick={() => {
                    updateSalesOrderForm({
                      productEntries: [
                        ...productEntries,
                        {
                          id: "",
                          product_id: "",
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
                        product_id: "",
                        name: "",
                        price: "",
                        quantity: "",
                      },
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
                        <strong>Phone number:</strong>{" "}
                        {patientDetails.phone_number}
                      </p>
                    </div>
                  )}
                </>
              )}

              {hasMrNumber === "no" && (
                <>
                  <label className="block text-gray-700 font-medium mb-1">
                    Enter Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Name"
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
                    Enter Phone Number
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
                    <option value="M">Male</option>
                    <option value="F">Female</option>
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
                      if (salesOrderForm.redeemOption === "barcode") {
                        privilegeCardRef.current?.focus();
                      } else if (salesOrderForm.redeemOption === "phone") {
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
                      if (salesOrderForm.redeemOption === "barcode") {
                        privilegeCardRef.current?.focus();
                      } else if (salesOrderForm.redeemOption === "phone") {
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
                          <strong>Name:</strong>{" "}
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
                          <strong>Loyalty Points:</strong> {loyaltyPoints}
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
                                    redeemPointsAmount: loyaltyPoints,
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
                                parseFloat(redeemPointsAmount) < 0) && (
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
              <div className="bg-white rounded-lg text-gray-800">
                <div className="printable-area print:mt-20 print:block print:absolute print:inset-0 print:w-full bg-white p-4 print:m-0 print:p-0 w-full">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">Invoice</h2>
                    <div className="text-right">
                      <p>
                        Date:<strong> {formattedDate}</strong>
                      </p>
                      <p>
                        Invoice No:<strong> {salesOrderId}</strong>
                      </p>

                      {hasMrNumber && (
                        <p>
                          MR No:<strong> {mrNumber || "NA"}</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  {step === 5 && salesOrderForm.insuranceInfo && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold text-blue-800">Insurance Information</h3>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <p className="text-sm text-gray-600">Insurance Provider:</p>
                          <p className="font-medium">{salesOrderForm.insuranceInfo.insurance_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Approved Amount:</p>
                          <p className="font-medium">₹{parseFloat(salesOrderForm.insuranceInfo.approved_amount).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )}


                  {/* Customer Details */}
                  <div className="mb-6">
                    <p>
                      Name:
                      <strong>
                        {" "}
                        {hasMrNumber === "yes"
                          ? `${patientDetails?.name || "N/A"} | ${patientDetails?.age || "N/A"
                          } | ${patientDetails?.gender || "N/A"}`
                          : `${customerName || "N/A"} | ${parseInt(age) || "N/A"
                          } | ${gender || "N/A"}`}
                      </strong>
                    </p>
                    <p>
                      Address:
                      <strong>
                        {" "}
                        {hasMrNumber === "yes"
                          ? `${patientDetails?.address || "N/A"}`
                          : `${address || "N/A"}`}
                      </strong>
                    </p>
                    <p>
                      Phone Number:
                      <strong>
                        {" "}
                        {hasMrNumber === "yes"
                          ? `${patientDetails?.phone_number || "N/A"}`
                          : `${customerPhone || "N/A"}`}
                      </strong>
                    </p>
                    <p className="mt-2">
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
                    </p>
                  </div>

                  {selectedWorkOrder.is_insurance && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-md">
                      <p className="font-medium text-blue-800">Insurance Work Order</p>
                      <p>
                        <strong>Insurance:</strong>{" "}
                        {selectedWorkOrder.insurance_name || "Not specified"}
                      </p>
                      {/* We'll fetch and show the approved amount during confirmation */}
                    </div>
                  )}

                  {/* Product Table */}
                  <table className="w-full border-collapse mb-6">
                    <thead>
                      <tr>
                        <th className="border px-4 py-2">No.</th>
                        {/* <th className="border px-4 py-2">Product ID</th> */}
                        <th className="border px-4 py-2">Service Name</th>
                        {/* <th className="border px-4 py-2">Price</th>
                        <th className="border px-4 py-2">Quantity</th> */}
                        <th className="border px-4 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productEntries.map((product, index) => {
                        const price = parseFloat(product.price) || 0;
                        const quantity = parseInt(product.quantity) || 0;
                        const subtotal = price * quantity;
                        return (
                          <tr key={index}>
                            <td className="border px-4 py-2 text-center">
                              {index + 1}
                            </td>
                            {/* <td className="border px-4 py-2 text-center">
                              {product.product_id}
                            </td> */}
                            <td className="border px-4 py-2">{product.name}</td>
                            {/* <td className="border px-4 py-2 text-center">
                              ₹{price.toFixed(2)}
                            </td> */}
                            {/* <td className="border px-4 py-2 text-center">
                              {quantity}
                            </td> */}
                            <td className="border px-4 py-2 text-center">
                              ₹{subtotal.toFixed(2)}
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
                        Total Amount:
                        <strong> ₹{parseFloat(taxableValue).toFixed(2)}</strong>
                      </p>

                      {/* Add insurance deduction if applicable */}
                      {salesOrderForm.insuranceInfo && (
                        <p className="text-blue-600">
                          Insurance Coverage:
                          <strong> -₹{parseFloat(salesOrderForm.insuranceInfo.approved_amount).toFixed(2)}</strong>
                        </p>
                      )}

                      <p className="font-bold">
                        Final Amount Due:
                        <strong> ₹{
                          salesOrderForm.insuranceInfo
                            ? (parseFloat(taxableValue) - parseFloat(salesOrderForm.insuranceInfo.approved_amount)).toFixed(2)
                            : parseFloat(taxableValue).toFixed(2)
                        }</strong>
                      </p>

                      {/* Billed By */}
                      <div className="mt-4">
                        <div className="mt-10 space-x-8">
                          <p>
                            Billed by:<strong> {employee || "N/A"}</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Loyalty Points Information */}
                  {privilegeCard && privilegeCardDetails && (
                    <div className="loyalty-points mb-6">
                      <p>
                        <span className="font-semibold">
                          Loyalty Points Redeemed:
                        </span>{" "}
                        ₹{parseFloat(redeemPointsAmount || 0).toFixed(2)}
                      </p>
                      <p>
                        <span className="font-semibold">
                          Loyalty Points Gained:
                        </span>{" "}
                        {pointsToAdd}
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
                        value={discount}
                        ref={discountInputRef}
                        onChange={(e) => {
                          const discountValue = e.target.value;
                          updateSalesOrderForm({ discount: discountValue });
                        }}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg"
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
                          updateSalesOrderForm({
                            paymentMethod: e.target.value,
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
                        <option value="card">Card</option>
                        <option value="online">UPI (Paytm/PhonePe/GPay)</option>
                        <option value="credit">Credit</option>
                        {/* <option value="online">UPI (Paytm/PhonePe/GPay)</option> */}
                      </select>
                      {validationErrors.paymentMethod && (
                        <p className="text-red-500 text-xs ml-1">
                          {validationErrors.paymentMethod}
                        </p>
                      )}
                    </div>
                  </div>


                </div>
              </div>

              {/* Action Buttons Outside Printable Area */}
              {/* Action Buttons Outside Printable Area */}
              <div className="flex justify-center text-center space-x-4 mt-6">
                {!submitted && step === 5 && (
                  <button
                    type="button"
                    onClick={saveSalesOrder}
                    ref={saveOrderRef}
                    className="flex items-center justify-center w-44 h-12 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                    disabled={isSaving}
                    aria-label="Save Sales Order"
                  >
                    {isSaving ? "Saving..." : "Save Sales Order"}
                  </button>
                )}

                {/* Critical fix: Force display after submission */}
                {submitted && (
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
                className={`bg-green-500 hover:bg-green-600 text-white mx-2 px-4 py-2 rounded-lg ${step === 4 && !salesOrderForm.isPinVerified
                  ? "opacity-50 cursor-not-allowed"
                  : ""
                  }`}
                disabled={step === 4 && !salesOrderForm.isPinVerified}
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

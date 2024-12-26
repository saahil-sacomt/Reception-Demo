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
    .eq("phone_number", phone)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching customer by phone:", error.message);
    return null;
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
  loyaltyPoints
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
    const redeemAmount = parsePrice(redeemPointsAmount);
    privilegeDiscount = Math.min(redeemAmount, loyaltyPoints, balanceDue);
    balanceDue -= privilegeDiscount;
    // Ensure balanceDue is not negative after privilege discount
    balanceDue = Math.max(balanceDue, 0);
  }

  // **Step 6: Final Payment Due**
  const finalAmount = balanceDue.toFixed(2); // Final amount after all deductions

  return {
    subtotalWithGST: subtotalWithGST.toFixed(2),
    subtotalWithoutGST: taxableValue.toFixed(2), // Add this line
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
  const { user, role, name, branch, loading: authLoading } = useAuth();
  console.log("branch:", branch); // Destructure branch from AuthContext

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
  useEffect(() => {
    resetTransientFields();
  }, []);

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

  // Helper function to update global form state
  const updateSalesOrderForm = (payload) => {
    dispatch({ type: "SET_SALES_ORDER_FORM", payload });
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

  const generateSalesOrderId = async (branch) => {
    // Define default starting sales_order_id for each branch
    const branchDefaultIds = {
      TVR: 4103, // Default ID for Trivandrum
      NTA: 2557, // Default ID for Neyyantinkara
      KOT1: 3001, // Default ID for Kottarakara 1
      KOT2: 4001, // Default ID for Kottarakara 2
      KAT: 5001, // Default ID for Kattakada
    };

    if (!branch) {
      console.error("Branch is undefined. Cannot generate Sales Order ID.");
      return;
    }

    try {
      console.log("Branch passed:", branch); // Debugging: check the branch passed
      console.log(
        "Default Sales Order ID for this branch:",
        branchDefaultIds[branch]
      ); // Debugging: check the default ID for the branch

      // Fetch the maximum sales_order_id for the specific branch
      const { data, error } = await supabase
        .from("sales_orders")
        .select("sales_order_id")
        .eq("branch", branch) // Filter by branch
        .order("sales_order_id", { ascending: false })
        .limit(1);

      if (error) {
        console.error(
          `Error fetching last sales_order_id for branch ${branch}:`,
          error
        );
        return null;
      }

      // Set the default starting sales_order_id for the branch if no orders exist
      let lastSalesOrderId = branchDefaultIds[branch] || 1000; // Default to 1000 if branch not found in the map

      // If data exists, extract the last sales_order_id for that branch
      if (data && data.length > 0) {
        lastSalesOrderId =
          parseInt(data[0].sales_order_id, 10) || lastSalesOrderId;
      }

      console.log("Calculated lastSalesOrderId:", lastSalesOrderId); // Debugging: check lastSalesOrderId

      // Increment the last sales_order_id by 1
      const newSalesOrderId = lastSalesOrderId + 1;

      // Optionally, you can update the sales order form with the new ID
      updateSalesOrderForm({ salesOrderId: newSalesOrderId });

      return newSalesOrderId.toString();
    } catch (error) {
      console.error(
        `Error generating sales_order_id for branch ${branch}:`,
        error
      );
      return null;
    }
  };

  // Function to fetch and set a new sales ID when the branch is available
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

  useEffect(() => {
    if (branch) {
      console.log("Fetching sales ID for branch:", branch);
      fetchSalesOrderId();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

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
  } = useMemo(() => {
    return calculateAmounts(
      productEntries,
      advanceDetails,
      discount, // salesDiscountAmount
      workOrderDiscount, // workOrderDiscountAmount
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

      // Exclude work orders that are already used and belong to the current branch
      query = query.eq("is_used", false).eq("branch", branch); // Added branch filter

      const { data, error } = await query
        .select("*") // Or specify the fields explicitly
        .order("created_at", { ascending: false });

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

    // Update global state
    updateSalesOrderForm({
      mrNumber: selectedWorkOrder.mr_number,
      advanceDetails: selectedWorkOrder.advance_details || "",
      hasMrNumber: selectedWorkOrder.mr_number ? "yes" : "no",
      productEntries: normalizedProducts,
      workOrderDiscount: selectedWorkOrder.discount_amount || 0,
    });

    setOriginalProductEntries(normalizedProducts);
    setShowWorkOrderModal(false);

    // Automatically fetch patient or customer details
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
        const customer = await fetchCustomerByPhone(customerPhone.trim());
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
        ] = `Quantity cannot exceed stock (${productEntries[index].stock})`;
      } else {
        delete errors[`productQuantity-${index}`];
      }
    } else {
      delete errors[
        `product${field.charAt(0).toUpperCase() + field.slice(1)}-${index}`
      ];
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

  // Updated handleOrderCompletion function with correct stock update logic
  const handleOrderCompletion = async () => {
    console.log("Submit handler triggered");
    const currentUTCDateTime = getCurrentUTCDateTime();
  
    if (isSaving) return;
    if (submitted) return; // Prevent duplicate clicks
  
    updateSalesOrderForm({ isSaving: true }); // Set isSaving to true
    updateSalesOrderForm({
      validationErrors: {
        ...validationErrors,
        generalError: "",
      },
    });
  
    try {
      let customerId = null;
  
      // **Step 1: Save Customer Details (if applicable)**
      if (hasMrNumber === "no") {
        // Validate Customer Details
        const customerErrors = {};
        if (!customerName.trim())
          customerErrors.customerName = "Name is required.";
        if (!customerPhone.trim()) {
          customerErrors.customerPhone = "Phone number is required.";
        }
        if (!address.trim()) customerErrors.address = "Address is required.";
        if (!age || parseInt(age, 10) <= 0)
          customerErrors.customerAge = "Age must be a positive number.";
        if (!gender) customerErrors.customerGender = "Gender is required.";
  
        if (Object.keys(customerErrors).length > 0) {
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              ...customerErrors,
            },
          });
          updateSalesOrderForm({ isSaving: false });
          return;
        }
  
        // Call saveCustomerDetails with customer details
        const savedCustomer = await saveCustomerDetails({
          name: customerName,
          phone_number: customerPhone,
          address,
          gender,
          age: parseInt(age, 10),
        });
  
        if (savedCustomer && savedCustomer.length > 0) {
          customerId = savedCustomer[0].customer_id; // Retrieve customer_id from the first inserted record
        } else {
          throw new Error("Failed to retrieve customer_id after insertion.");
        }
      }
  
      // **Step 2: Handle Loyalty Points Update (if applicable)**
      if (privilegeCard && privilegeCardDetails) {
        const { updatedPoints, pointsToRedeem, pointsToAdd } = calculateLoyaltyPoints(
          subtotalWithGST,
          redeemPointsAmount,
          privilegeCard,
          privilegeCardDetails,
          loyaltyPoints
        );
  
        const { error: loyaltyError } = await supabase
          .from("privilegecards")
          .update({ loyalty_points: updatedPoints })
          .eq("pc_number", privilegeCardDetails.pc_number);
  
        if (loyaltyError) {
          console.error("Error updating loyalty points:", loyaltyError);
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Failed to update loyalty points",
            },
          });
          updateSalesOrderForm({ isSaving: false });
          return;
        }
  
        updateSalesOrderForm({
          loyaltyPoints: updatedPoints,
          pointsToAdd: pointsToAdd,
        });
      }
  
      // **Step 3: Prepare Variables for Sales Data**
      const sanitizedRedeemedPoints = privilegeCard
        ? parseInt(redeemPointsAmount) || 0
        : 0;
      const sanitizedPointsAdded = privilegeCard ? pointsToAdd || 0 : 0;
  
      if (isEditing) {
        // **Step 4: Update Existing Sales Order**
        const updatePayload = {
          work_order_id: selectedWorkOrder
            ? selectedWorkOrder.work_order_id
            : null,
          items: productEntries.map((prod) => ({
            id: prod.id, // Integer id for stock
            product_id: prod.product_id, // String product_id for display
            name: prod.name,
            price: parseFloat(prod.price),
            quantity: parseInt(prod.quantity, 10),
            hsn_code: prod.hsn_code,
          })),
          mr_number: hasMrNumber === "yes" ? mrNumber : null,
          patient_phone:
            hasMrNumber === "yes" ? patientDetails.phone_number : customerPhone,
          customer_id: customerId, // Associate with customer_id
          employee: employee,
          payment_method: paymentMethod,
          subtotal: parseFloat(subtotalWithoutGST),
          discount: parseFloat(totalDiscount),
          total_amount: amountAfterDiscount,
          advance_details: parseFloat(advanceDetails) || 0,
          privilege_discount: parseFloat(privilegeDiscount),
          cgst: parseFloat(cgstAmount),
          sgst: parseFloat(sgstAmount),
          final_amount: parseFloat(balanceDue),
          loyalty_points_redeemed: sanitizedRedeemedPoints,
          loyalty_points_added: sanitizedPointsAdded,
          updated_at: currentUTCDateTime,
          branch: branch,
          // **Important:** Do NOT include 'modification_request_id' or any other invalid fields
        };
  
        console.log("Update Payload:", updatePayload); // Debugging: Inspect the payload
  
        const { error: updateError } = await supabase
          .from("sales_orders")
          .update(updatePayload)
          .eq("sales_order_id", salesOrderId);
  
        if (updateError) {
          console.error("Error updating sales order:", updateError);
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Failed to update sales order.",
            },
          });
          updateSalesOrderForm({ isSaving: false });
          return;
        }
  
        // **Step 5: Handle Stock Updates for Modifications**
        // Calculate differences between original and updated products
        const differences = calculateProductDifferences(
          originalProductEntries,
          productEntries
        );
  
        console.log("Product Differences:", differences);
  
        // Process each difference
        for (const diff of differences) {
          const { productId, diff: quantityChange } = diff;
          // Fetch current stock for the product
          const { data: stockData, error: stockError } = await supabase
            .from("stock")
            .select("quantity")
            .eq("product_id", productId)
            .eq("branch_code", branch)
            .single();
  
          if (stockError || !stockData) {
            console.error(
              `Error fetching stock for product ID ${productId}:`,
              stockError
            );
            updateSalesOrderForm({
              validationErrors: {
                ...validationErrors,
                generalError: `Failed to fetch stock for product ID ${productId}.`,
              },
            });
            updateSalesOrderForm({ isSaving: false });
            return;
          }
  
          let newQuantity = stockData.quantity + quantityChange;
  
          if (newQuantity < 0) {
            updateSalesOrderForm({
              validationErrors: {
                ...validationErrors,
                generalError: `Insufficient stock for product ID ${productId}.`,
              },
            });
            updateSalesOrderForm({ isSaving: false });
            return;
          }
  
          // Update stock
          const { error: stockUpdateError } = await supabase
            .from("stock")
            .update({ quantity: newQuantity })
            .eq("product_id", productId)
            .eq("branch_code", branch);
  
          if (stockUpdateError) {
            console.error(
              `Error updating stock for product ID ${productId}:`,
              stockUpdateError
            );
            updateSalesOrderForm({
              validationErrors: {
                ...validationErrors,
                generalError: `Failed to update stock for product ID ${productId}.`,
              },
            });
            updateSalesOrderForm({ isSaving: false });
            return;
          }
        }
  
        // **Step 6: Update Modification Request Status**
        // Fetch the 'id' (primary key) of the updated sales order
        const { data: updatedSalesOrderData, error: fetchUpdatedError } =
          await supabase
            .from("sales_orders")
            .select("id")
            .eq("sales_order_id", salesOrderId)
            .single();
  
        if (fetchUpdatedError || !updatedSalesOrderData) {
          console.error("Error fetching updated sales order ID:", fetchUpdatedError);
          alert("Failed to fetch updated sales order ID.");
        } else {
          const salesOrderRecordId = updatedSalesOrderData.id;
  
          // Now, update the corresponding modification request(s)
          try {
            // Fetch modification requests related to this sales order
            const { data: modReqData, error: modReqError } = await supabase
              .from("modification_requests")
              .select("id")
              .eq("order_id", salesOrderId) // Use 'salesOrderRecordId' here
              .eq("order_type", "sales_order")
              .eq("status", "approved"); // Assuming 'pending' is the correct status
  
            if (modReqError) {
              console.error("Error fetching modification request:", modReqError);
              // Optionally handle the error as needed
            } else if (modReqData && modReqData.length > 0) {
              // Loop through each modification request and update them
              for (const modReq of modReqData) {
                const modificationRequestId = modReq.id;
                console.log(
                  "Attempting to update modification_request with ID:",
                  modificationRequestId
                );
  
                const { error: modificationError } = await supabase
                  .from("modification_requests")
                  .update({ status: "completed" })
                  .eq("id", modificationRequestId);
  
                if (modificationError) {
                  console.error(
                    "Error updating modification request status:",
                    modificationError
                  );
                  alert(
                    "Sales order was updated, but failed to update modification request status. Please contact support."
                  );
                } else {
                  console.log("Modification request status updated to 'completed'.");
                }
              }
            } else {
              console.log("No pending modification request found for this sales order.");
            }
          } catch (err) {
            console.error("Unexpected error updating modification request:", err);
            alert(
              "An unexpected error occurred while updating modification request status."
            );
          }
        }
  
        alert("Sales order updated successfully!");
        updateSalesOrderForm({
          allowPrint: true,
          submitted: true,
        });
      } else {
        // **Step 4: Insert New Sales Order**
        const newSalesOrderId = await generateSalesOrderId(branch);
        if (!newSalesOrderId) {
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Failed to generate sales order ID.",
            },
          });
          updateSalesOrderForm({ isSaving: false });
          return;
        }
  
        const insertPayload = {
          sales_order_id: newSalesOrderId,
          work_order_id: selectedWorkOrder
            ? selectedWorkOrder.work_order_id
            : null,
          items: productEntries.map((prod) => ({
            id: prod.id, // Integer id for stock
            product_id: prod.product_id, // String product_id for display
            name: prod.name,
            price: parseFloat(prod.price),
            quantity: parseInt(prod.quantity, 10),
            hsn_code: prod.hsn_code,
          })),
          mr_number: hasMrNumber === "yes" ? mrNumber : null,
          patient_phone:
            hasMrNumber === "yes" ? patientDetails.phone_number : customerPhone,
          customer_id: customerId, // Associate with customer_id
          employee: employee,
          payment_method: paymentMethod,
          subtotal: parseFloat(subtotalWithoutGST),
          discount: parseFloat(totalDiscount),
          total_amount: parseFloat(amountAfterDiscount),
          advance_details: parseFloat(advanceDetails) || 0,
          privilege_discount: parseFloat(privilegeDiscount),
          cgst: parseFloat(cgstAmount),
          sgst: parseFloat(sgstAmount),
          final_amount: parseFloat(balanceDue),
          loyalty_points_redeemed: sanitizedRedeemedPoints,
          loyalty_points_added: sanitizedPointsAdded,
          updated_at: currentUTCDateTime,
          branch: branch,
          // **Important:** Do NOT include 'modification_request_id' or any other invalid fields
        };
  
        console.log("Insert Payload:", insertPayload); // Debugging: Inspect the payload
  
        const { error: insertError } = await supabase
          .from("sales_orders")
          .insert(insertPayload);
  
        if (insertError) {
          console.error("Error inserting sales order:", insertError);
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Failed to insert sales order.",
            },
          });
          updateSalesOrderForm({ isSaving: false });
          return;
        }
  
        // **Step 5: Mark Work Order as Used (if applicable)**
        if (selectedWorkOrder) {
          const { error: workOrderError } = await supabase
            .from("work_orders")
            .update({ is_used: true })
            .eq("work_order_id", selectedWorkOrder.work_order_id);
  
          if (workOrderError) {
            console.error("Error marking work order as used:", workOrderError);
            updateSalesOrderForm({
              validationErrors: {
                ...validationErrors,
                generalError: "Failed to update work order status.",
              },
            });
            updateSalesOrderForm({ isSaving: false });
            return;
          }
        }
  
        // **Step 6: Deduct Stock for New Orders**
        const validProducts = productEntries.filter(
          (product) => product.id && product.quantity > 0
        );
  
        if (!validProducts || validProducts.length === 0) {
          console.error("No valid products to process");
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "No valid products to deduct stock.",
            },
          });
          updateSalesOrderForm({ isSaving: false });
          return;
        }
  
        console.log("Valid Products for Deduction:", validProducts);
  
        // Fetch current stock for all valid products in one query
        const productIds = validProducts.map((prod) => prod.id); // Use integer ids
        const { data: stockData, error: stockError } = await supabase
          .from("stock")
          .select("product_id, quantity")
          .in("product_id", productIds)
          .eq("branch_code", branch);
  
        if (stockError || !stockData) {
          console.error("Error fetching stock data:", stockError);
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Failed to fetch stock data.",
            },
          });
          updateSalesOrderForm({ isSaving: false });
          return;
        }
  
        // Create a map of current stock
        const stockMap = new Map();
        stockData.forEach((stock) => {
          stockMap.set(stock.product_id, stock.quantity);
        });
  
        // Validate stock deductions
        for (const product of validProducts) {
          const currentStock = stockMap.get(product.id) || 0;
          const newStock = currentStock - product.quantity;
  
          if (newStock < 0) {
            updateSalesOrderForm({
              validationErrors: {
                ...validationErrors,
                generalError: `Insufficient stock for product ID: ${product.product_id}.`,
              },
            });
            updateSalesOrderForm({ isSaving: false });
            return;
          }
        }
  
        // Update stock quantities in bulk
        const updateStockPromises = validProducts.map((product) => {
          const newQuantity = stockMap.get(product.id) - product.quantity;
          return supabase
            .from("stock")
            .update({ quantity: newQuantity })
            .eq("product_id", product.id)
            .eq("branch_code", branch);
        });
  
        const updateStockResults = await Promise.all(updateStockPromises);
  
        // Check for any errors in stock updates
        const stockUpdateErrors = updateStockResults.filter(
          (result) => result.error
        );
  
        if (stockUpdateErrors.length > 0) {
          console.error("Error updating stock levels:", stockUpdateErrors);
          updateSalesOrderForm({
            validationErrors: {
              ...validationErrors,
              generalError: "Failed to update stock levels.",
            },
          });
          updateSalesOrderForm({ isSaving: false, submitted: true });
          return;
        }
  
        alert("Sales order created successfully!");
        updateSalesOrderForm({
          allowPrint: true,
          submitted: true,
        });
      }
  
      // **Step 7: Final Steps: Reset Form and Allow Printing**
      updateSalesOrderForm({ allowPrint: true, submitted: true });
  
      alert("Order processed successfully!");
      setTimeout(() => {
        printButtonRef.current?.focus(); // Move focus to the Print button
      }, 100);
    } catch (error) {
      console.error("Error completing the order:", error);
      updateSalesOrderForm({
        validationErrors: {
          ...validationErrors,
          generalError: "Failed to complete the order.",
        },
      });
    } finally {
      updateSalesOrderForm({ isSaving: false, submitted: true }); // Set isSaving to false
    }
  };
  

  // Function to reset the form
  const resetForm = () => {
    dispatch({ type: "RESET_SALES_ORDER_FORM" });
    setOriginalProductEntries([
      { id: "", product_id: "", name: "", price: "", quantity: "" },
    ]);
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
      resetState(); // Reset the state
      navigate("/home"); // Redirect to the home page or another page
    }
  };

  const handlePrint = useCallback(() => {
    window.print();
    dispatch({ type: "SET_SALES_ORDER_FORM", payload: { isPrinted: true } });
    resetForm();
    navigate("/home");
  }, [dispatch, navigate]);

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
                            <p>
                              <strong>Due Date:</strong> {workOrder.due_date}
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
                    <h2 className="text-3xl font-bold">Tax Invoice</h2>
                    <div className="text-right">
                      <p>
                        Date:<strong> {formattedDate}</strong>
                      </p>
                      <p>
                        Invoice No:<strong> {salesOrderId}</strong>
                      </p>

                      {hasMrNumber && (
                        <p>
                          MR Number:<strong> {mrNumber || "NA"}</strong>
                        </p>
                      )}
                    </div>
                  </div>

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
                        const price = parseFloat(product.price) || 0;
                        const quantity = parseInt(product.quantity) || 0;
                        const subtotal = price * quantity;
                        return (
                          <tr key={index}>
                            <td className="border px-4 py-2 text-center">
                              {index + 1}
                            </td>
                            <td className="border px-4 py-2 text-center">
                              {product.product_id}
                            </td>
                            <td className="border px-4 py-2">{product.name}</td>
                            <td className="border px-4 py-2 text-center">
                              {product.hsn_code}
                            </td>
                            <td className="border px-4 py-2 text-center">
                              ₹{price.toFixed(2)}
                            </td>
                            <td className="border px-4 py-2 text-center">
                              {quantity}
                            </td>
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
                      {/* Subtotal Including GST */}

                      {/* Work Order and Sales Discounts */}
                      {/* <p>
                        Work Order Discount:
                        <strong>
                          {" "}
                          ₹{parseFloat(workOrderDiscount).toFixed(2)}
                        </strong>
                      </p>
                      <p>
                        Sales Discount:
                        <strong> ₹{parseFloat(discount || 0).toFixed(2)}</strong>
                      </p>
                      <p>
                        Total Discount:
                        <strong>
                          {" "}
                          ₹{parseFloat(totalDiscount).toFixed(2)}
                        </strong>
                      </p> */}

                      {/* Amount After Discounts */}
                      <p>
                        Advance Paid:
                        <strong> ₹{parseFloat(advance).toFixed(2)}</strong>
                      </p>
                      <p>
                        Balance paid:{" "}
                        <strong>
                          <span>₹{parseFloat(balanceDue).toFixed(2)}</span>
                        </strong>
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

                    <div>
                      {/* <p className="text-lg">
                        <strong>
                          Amount After Discounts: ₹
                          {parseFloat(subtotalWithGST).toFixed(2)}
                        </strong>
                      </p> */}
                      {/* Taxable Value and GST Breakdown */}
                      <p>
                        Amt. after discount:
                        <strong> ₹{parseFloat(taxableValue).toFixed(2)}</strong>
                      </p>
                      <p>
                        CGST (6%):
                        <strong> ₹{parseFloat(cgstAmount).toFixed(2)}</strong>
                      </p>
                      <p>
                        SGST (6%):
                        <strong> ₹{parseFloat(sgstAmount).toFixed(2)}</strong>
                      </p>
                      {/* Advance Paid */}

                      {/* Final Amount Due */}

                      <p className="text-xl">
                        <strong>
                          Total Paid (Incl. GST): ₹
                          {parseFloat(amountAfterDiscount).toFixed(2)}
                        </strong>
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
                    <ol className="list-decimal list-inside">
                      <p className="mt-2 text-xs">
                        Terms and Conditions:
                        <li>Work order valid only for two months.</li>
                        <li>
                          Branded Frames/Lenses – 12 Months warranty for
                          manufacturing defects/peeling off.
                        </li>
                      </p>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Action Buttons Outside Printable Area */}
              <div className="flex justify-center text-center space-x-4 mt-6">
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
                  className={`flex items-center justify-center w-44 h-12 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition ${!paymentMethod ||
                      parseFloat(state.salesOrderForm.discount) > subtotalWithGST
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                    }`}
                  disabled={
                    !paymentMethod ||
                    isLoading ||
                    isSaving ||
                    submitted ||
                    parseFloat(state.salesOrderForm.discount) > subtotalWithGST
                  }
                >
                  {submitted
                    ? "Order Submitted"
                    : isEditing
                      ? "Update Order"
                      : "Submit Order"}{" "}
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
                    className="flex items-center justify-center w-44 h-12 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    <PrinterIcon className="w-5 h-5 inline mr-2" />
                    Print
                  </button>
                )}

                {/* Exit Button */}
                {allowPrint && (
                  <button
                    type="button" /* Ensure the type is set to "button" */
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

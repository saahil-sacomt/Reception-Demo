// client/src/pages/EmployeeStockManagement.jsx

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  addOrUpdateStock,
  addNewProduct,
  updateExistingProduct,
  addPurchase,
} from "../services/authService";
import supabase from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useGlobalState } from "../context/GlobalStateContext";
import { debounce } from "lodash";
import Modal from "react-modal";
import EmployeeVerification from "../components/EmployeeVerification";
import { format } from "date-fns";



Modal.setAppElement("#root");

const EmployeeStockManagement = ({ isCollapsed }) => {
  const { user, role, branch } = useAuth();
  const { state, dispatch } = useGlobalState();
  const [mode, setMode] = useState("update");

  // State for Add New Product
  const [newProductName, setNewProductName] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newMrp, setNewMrp] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newPurchaseFrom, setNewPurchaseFrom] = useState("");
  const [newBillNumber, setNewBillNumber] = useState("");
  const [newBillDate, setNewBillDate] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState(null);

  // State for Update Existing Product
  const [updateSearchQuery, setUpdateSearchQuery] = useState("");
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [updateQuantity, setUpdateQuantity] = useState("");
  const [updateRate, setUpdateRate] = useState("");
  const [updateMrp, setUpdateMrp] = useState("");
  const [updatePurchaseFrom, setUpdatePurchaseFrom] = useState("");
  const [updateBillNumber, setUpdateBillNumber] = useState("");
  const [updateBillDate, setUpdateBillDate] = useState("");
  const [updateEmployeeId, setUpdateEmployeeId] = useState(null);

  // State for Current Stock Search
  const [stockSearchQuery, setStockSearchQuery] = useState("");

  // State for Employees Dropdown
  const [employees, setEmployees] = useState([]);

  // Common States
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const isUploadingRef = useRef(false);
  // Function to get current date and time in the desired format
const getCurrentDateTime = () => {
  const now = new Date();
  return format(now, "yyyy-MM-dd HH:mm:ss");
};

// Use in your add/update logic
const trimmedBillDate = newBillDate.trim();
const formattedBillDate = format(new Date(trimmedBillDate), "yyyy-MM-dd");

  // Warn user before unloading the page during upload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isUploadingRef.current) {
        e.preventDefault();
        e.returnValue =
          "A stock update is in progress. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Fetch Employees for Dropdown (Branch-wise)
  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .eq("branch", branch)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching employees:", error);
        setEmployees([]);
        return;
      }

      setEmployees(data || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setEmployees([]);
    }
  }, [branch]);

  useEffect(() => {
    if (branch) {
      fetchEmployees();
    }
  }, [fetchEmployees, branch]);

  // Debounced fetchProductSuggestions to limit API calls
  const fetchProductSuggestions = useCallback(async (query) => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_name, product_id, rate, mrp, purchase_from")
        .or(`product_name.ilike.%${query}%,product_id.ilike.%${query}%`)
        .limit(20);

      if (error) {
        console.error("Error fetching suggestions:", error);
        setProductSuggestions([]);
        return;
      }

      setProductSuggestions(data || []);
    } catch (err) {
      console.error("Error fetching product suggestions:", err);
    }
  }, []);

  const debouncedFetchSuggestions = useRef(
    debounce(fetchProductSuggestions, 300)
  ).current;

  // Handler for Mode Selection
  const handleModeSelection = (selectedMode) => {
    setMode(selectedMode);
    // Reset all states when mode changes
    setError("");
    setSuccess("");
    setNewProductName("");
    setNewProductId("");
    setNewRate("");
    setNewMrp("");
    setNewQuantity("");
    setNewPurchaseFrom("");
    setNewBillNumber("");
    setNewBillDate("");
    setNewEmployeeId(null);
    setUpdateSearchQuery("");
    setProductSuggestions([]);
    setSelectedProduct(null);
    setUpdateQuantity("");
    setUpdateRate("");
    setUpdateMrp("");
    setUpdatePurchaseFrom("");
    setUpdateBillNumber("");
    setUpdateBillDate("");
    setUpdateEmployeeId(null);
    setStockSearchQuery("");
  };

  // Function to generate a unique bill number per branch
  const generateBillNumber = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("bill_number")
        .eq("branch_code", branch)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching last bill number:", error);
        return "";
      }

      let newBillNumber = "BILL-0001";

      if (data && data.length > 0) {
        const lastBillNumber = data[0].bill_number;
        const numberPart = parseInt(lastBillNumber.split("-")[1], 10);
        if (!isNaN(numberPart)) {
          const newNumber = (numberPart + 1).toString().padStart(4, "0");
          newBillNumber = `BILL-${newNumber}`;
        }
      }

      return newBillNumber;
    } catch (error) {
      console.error("Error generating bill number:", error);
      return "";
    }
  }, [branch]);

  // Generate bill numbers when branch changes or mode changes
  useEffect(() => {
    const setupBillDetails = async () => {
      const billNumber = await generateBillNumber();
      const currentDate = new Date().toISOString().split("T")[0];

      if (mode === "add") {
        setNewBillNumber(billNumber);
        setNewBillDate(currentDate);
      } else if (mode === "update") {
        setUpdateBillNumber(billNumber);
        setUpdateBillDate(currentDate);
      }
    };

    if (branch) {
      setupBillDetails();
    }
  }, [branch, mode, generateBillNumber]);

  // Handler for Add New Product Form Submission
  const handleAddNewProduct = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedProductName = newProductName.trim();
    const trimmedProductId = newProductId.trim();
    const trimmedPurchaseFrom = newPurchaseFrom.trim();
    const trimmedBillNumber = newBillNumber.trim();
    const trimmedBillDate = newBillDate.trim();

    // Collect missing fields
    const missingFields = [];
    if (!trimmedProductName) missingFields.push("Product Name");
    if (!trimmedProductId) missingFields.push("Product ID");
    if (!newRate) missingFields.push("Rate");
    if (!newMrp) missingFields.push("MRP");
    if (!newQuantity) missingFields.push("Quantity");
    if (!trimmedPurchaseFrom) missingFields.push("Purchase From");
    if (!trimmedBillNumber) missingFields.push("Bill Number");
    if (!trimmedBillDate) missingFields.push("Bill Date");
    if (!newEmployeeId) missingFields.push("Employee");

    if (missingFields.length > 0) {
      setError(`Please enter the following fields: ${missingFields.join(", ")}`);
      return;
    }

    const quantity = parseInt(newQuantity, 10);
    const rate = parseFloat(newRate);
    const mrp = parseFloat(newMrp);

    if (isNaN(quantity) || quantity <= 0) {
      setError("Please enter a valid quantity greater than 0.");
      return;
    }

    if (isNaN(rate) || rate < 0) {
      setError("Please enter a valid rate greater than 0.");
      return;
    }

    if (isNaN(mrp) || mrp < 0) {
      setError("Please enter a valid MRP greater than 0.");
      return;
    }

    if (!branch) {
      setError("Branch is not set. Cannot proceed.");
      return;
    }

    setIsLoading(true);
    isUploadingRef.current = true;

    try {
      // Check if product ID already exists
      const { data: existingProduct, error: fetchError } = await supabase
        .from("products")
        .select("id")
        .eq("product_id", trimmedProductId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Error checking existing product:", fetchError);
        setError("Failed to verify Product ID.");
        setIsLoading(false);
        isUploadingRef.current = false;
        return;
      }

      if (existingProduct) {
        setError(
          "Product ID already exists. Please use the 'Update Existing Product' section to update stock."
        );
        setIsLoading(false);
        isUploadingRef.current = false;
        return;
      }

      // Prepare data for preview
      const employeeName =
        employees.find((emp) => emp.id === newEmployeeId)?.name || "Unknown";
      const previewData = {
        mode: "Add New Product",
        bill_date: newBillDate,
        bill_number: newBillNumber,
        employee: employeeName,
        employee_id: newEmployeeId,
        product_name: trimmedProductName,
        product_id: trimmedProductId,
        rate,
        mrp,
        quantity,
        purchase_from: trimmedPurchaseFrom,
      };

      // Dispatch to set purchase modal content
      dispatch({
        type: "SET_PURCHASE_MODAL",
        payload: {
          action: "add",
          content: previewData,
          showModal: true,
        },
      });
    } catch (error) {
      console.error("Error during add new product:", error);
      setError("An unexpected error occurred.");
      setIsLoading(false);
      isUploadingRef.current = false;
    }
  };

  // Handler for Update Existing Product Form Submission
  const handleUpdateExistingProduct = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedPurchaseFrom = updatePurchaseFrom.trim();
    const trimmedBillNumber = updateBillNumber.trim();
    const trimmedBillDate = updateBillDate.trim();

    // Validation
    const missingFields = [];
    if (!updateSearchQuery) missingFields.push("Product Search");
    if (!updateQuantity) missingFields.push("Quantity to Add");
    if (!updateRate) missingFields.push("Rate");
    if (!updateMrp) missingFields.push("MRP");
    if (!trimmedPurchaseFrom) missingFields.push("Purchase From");
    if (!trimmedBillNumber) missingFields.push("Bill Number");
    if (!trimmedBillDate) missingFields.push("Bill Date");
    if (!updateEmployeeId) missingFields.push("Employee");

    if (missingFields.length > 0) {
      setError(`Please enter the following fields: ${missingFields.join(", ")}`);
      return;
    }

    if (!selectedProduct) {
      setError(
        "No product selected. Please search and select a product to update."
      );
      return;
    }

    const quantity = parseInt(updateQuantity, 10);
    const rate = parseFloat(updateRate);
    const mrp = parseFloat(updateMrp);

    if (isNaN(quantity) || quantity < 0) {
      setError("Please enter a valid quantity greater than 0.");
      return;
    }

    if (isNaN(rate) || rate < -1) {
      setError("Please enter a valid rate greater than 0.");
      return;
    }

    if (isNaN(mrp) || mrp < -1) {
      setError("Please enter a valid MRP greater than 0.");
      return;
    }

    if (!branch) {
      setError("Branch is not set. Cannot proceed.");
      return;
    }

    setIsLoading(true);
    isUploadingRef.current = true;

    try {
      // Prepare data for preview
      const employeeName =
        employees.find((emp) => emp.id === updateEmployeeId)?.name || "Unknown";
      const previewData = {
        mode: "Update Existing Product",
        bill_date: updateBillDate,
        bill_number: updateBillNumber,
        employee: employeeName,
        employee_id: updateEmployeeId,
        product_name: selectedProduct.product_name,
        product_id: selectedProduct.product_id,
        rate,
        mrp,
        quantity,
        purchase_from: trimmedPurchaseFrom,
      };

      // Dispatch to set purchase modal content
      dispatch({
        type: "SET_PURCHASE_MODAL",
        payload: {
          action: "update",
          content: previewData,
          showModal: true,
        },
      });
    } catch (error) {
      console.error("Error during update existing product:", error);
      setError("An unexpected error occurred.");
      setIsLoading(false);
      isUploadingRef.current = false;
    }
  };

  // Function to process Add New Product after confirmation
  const processAddNewProduct = async () => {
    // Retrieve modal content from global state
    const previewData = state.purchaseModal.content;

    if (!previewData) {
      setError("No purchase data to process.");
      setIsLoading(false);
      isUploadingRef.current = false;
      return;
    }

    const {
      product_name,
      product_id,
      rate,
      mrp,
      quantity,
      purchase_from,
      bill_number,
      bill_date,
      employee_id,
      employee,
    } = previewData;

    try {
      // Add New Product
      const addProductResponse = await addNewProduct({
        product_name: product_name.trim(),
        product_id: product_id.trim(),
        rate: parseFloat(rate),
        mrp: parseFloat(mrp),
        hsn_code: "9001",
        purchase_from: purchase_from.trim(),
      });

      if (!addProductResponse.success) {
        setError(addProductResponse.error);
        dispatch({ type: "RESET_PURCHASE_MODAL" });
        return;
      }

      // Update Stock for the Branch
      const updateStockResponse = await addOrUpdateStock(
        addProductResponse.data.id,
        branch,
        parseInt(quantity, 10),
        parseFloat(rate),
        parseFloat(mrp),
        purchase_from.trim()
      );

      if (!updateStockResponse.success) {
        setError(updateStockResponse.error);
        dispatch({ type: "RESET_PURCHASE_MODAL" });
        return;
      }

      // Add to Purchases Table
      const addPurchaseResponse = await addPurchase({
        product_id: addProductResponse.data.id,
        branch_code: branch,
        quantity: parseInt(quantity, 10),
        rate: parseFloat(rate),
        mrp: parseFloat(mrp),
        purchase_from: purchase_from.trim(),
        bill_number: bill_number.trim(),
        bill_date: bill_date,
        employee_id: employee_id,
        employee_name: employee,
      });

      if (!addPurchaseResponse.success) {
        setError(addPurchaseResponse.error);
        dispatch({ type: "RESET_PURCHASE_MODAL" });
        return;
      }

      setSuccess("New product added and stock updated successfully.");
      // Reset form
      handleModeSelection("add");
      // Refresh stock data
      fetchStockData();
    } catch (error) {
      console.error("Error processing add new product:", error);
      setError("An unexpected error occurred.");
    } finally {
      dispatch({ type: "RESET_PURCHASE_MODAL" });
      setIsLoading(false);
      isUploadingRef.current = false;
    }
  };

  // Function to process Update Existing Product after confirmation
  const processUpdateExistingProduct = async () => {
    // Retrieve modal content from global state
    const previewData = state.purchaseModal.content;

    if (!previewData) {
      setError("No purchase data to process.");
      setIsLoading(false);
      isUploadingRef.current = false;
      return;
    }

    const {
      product_name,
      product_id,
      rate,
      mrp,
      quantity,
      purchase_from,
      bill_number,
      bill_date,
      employee_id,
      employee,
    } = previewData;

    try {
      // Update Stock for the Branch
      const updateStockResponse = await updateExistingProduct(
        selectedProduct.id,
        branch,
        parseInt(quantity, 10),
        parseFloat(rate),
        parseFloat(mrp),
        purchase_from.trim()
      );

      if (!updateStockResponse.success) {
        setError(updateStockResponse.error);
        dispatch({ type: "RESET_PURCHASE_MODAL" });
        return;
      }

      // Add to Purchases Table
      const addPurchaseResponse = await addPurchase({
        product_id: selectedProduct.id,
        branch_code: branch,
        quantity: parseInt(quantity, 10),
        rate: parseFloat(rate),
        mrp: parseFloat(mrp),
        purchase_from: purchase_from.trim(),
        bill_number: bill_number.trim(),
        bill_date: bill_date,
        employee_id: employee_id,
        employee_name: employee,
      });

      if (!addPurchaseResponse.success) {
        setError(addPurchaseResponse.error);
        dispatch({ type: "RESET_PURCHASE_MODAL" });
        return;
      }

      setSuccess("Stock updated successfully and purchase recorded.");
      // Reset form
      handleModeSelection("update");
      // Refresh stock data
      fetchStockData();
    } catch (error) {
      console.error("Error processing update existing product:", error);
      setError("An unexpected error occurred.");
    } finally {
      dispatch({ type: "RESET_PURCHASE_MODAL" });
      setIsLoading(false);
      isUploadingRef.current = false;
    }
  };

  // Handler for Update Existing Product Search Input Change
  const handleUpdateSearchInputChange = (e) => {
    const query = e.target.value.trim();
    setUpdateSearchQuery(query);

    if (query.length > 2) {
      debouncedFetchSuggestions(query);
    } else {
      setProductSuggestions([]);
      setSelectedProduct(null);
    }
  };

  // Handler for Current Stock Search Input Change
  const handleStockSearchInputChange = (e) => {
    const query = e.target.value;
    setStockSearchQuery(query);
  };

  // Handler for Selecting a Product from Suggestions
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);

    setUpdateSearchQuery(`${product.product_name} (${product.product_id})`);
    setProductSuggestions([]);

    // Populate fields with the selected product's details
    setUpdateRate(product.rate !== null ? product.rate.toString() : "");
    setUpdateMrp(product.mrp !== null ? product.mrp.toString() : "");
    setUpdatePurchaseFrom(product.purchase_from || "");

    // Generate bill details for update
    const setupBillDetails = async () => {
      const billNumber = await generateBillNumber();
      const currentDate = new Date().toISOString().split("T")[0];
      setUpdateBillNumber(billNumber);
      setUpdateBillDate(currentDate);
    };

    if (branch) {
      setupBillDetails();
    }
  };

  // Fetch current stock data when component mounts or branch changes
  const fetchStockData = useCallback(async () => {
    if (!branch) {
      setFilteredStocks([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("stock")
        .select(
          `
                quantity,
                product:products(id, product_name, product_id, rate, mrp, purchase_from)
            `
        )
        .eq("branch_code", branch);

      if (error) {
        console.error("Error fetching stock data:", error);
        setError("Failed to fetch stock data.");
        return;
      }

      setFilteredStocks(data || []);
    } catch (err) {
      console.error("Error fetching stock data:", err);
      setError("An unexpected error occurred while fetching stock data.");
    }
  }, [branch]);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // State for displaying current stock
  const [filteredStocks, setFilteredStocks] = useState([]);

  // Memoized filtered and sorted stock based on search query
  const allFilteredStocks = useMemo(() => {
    return filteredStocks
      .filter((stock) => {
        const searchTerm = stockSearchQuery.toLowerCase();
        const productName = stock.product.product_name.toLowerCase();
        const productId = stock.product.product_id.toLowerCase();
        return (
          productName.includes(searchTerm) || productId.includes(searchTerm)
        );
      })
      .sort((a, b) =>
        a.product.product_name.localeCompare(b.product.product_name)
      );
  }, [filteredStocks, stockSearchQuery]);

  // Calculate total pages based on filtered stock
  const totalPages = useMemo(() => {
    return Math.ceil(allFilteredStocks.length / itemsPerPage);
  }, [allFilteredStocks.length, itemsPerPage]);

  // Get current page's stocks
  const displayedStocks = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return allFilteredStocks.slice(indexOfFirstItem, indexOfLastItem);
  }, [allFilteredStocks, currentPage, itemsPerPage]);

  // Reset currentPage to 1 when search query or allFilteredStocks changes
  useEffect(() => {
    setCurrentPage(1);
  }, [stockSearchQuery, allFilteredStocks]);

  // Handler for Confirming in Modal
  const handleConfirmModal = () => {
    setIsLoading(true);
    if (state.purchaseModal.action === "add") {
      processAddNewProduct();
    } else if (state.purchaseModal.action === "update") {
      processUpdateExistingProduct();
    }
  };

  // Handler for Cancelling in Modal
  const handleCancelModal = () => {
    dispatch({ type: "RESET_PURCHASE_MODAL" });
    setError("");
    setSuccess("");
    setIsLoading(false);
    isUploadingRef.current = false;
  };

  return (
    <div
      className={`transition-all duration-300 ${
        isCollapsed ? "mx-20" : "mx-20 px-20"
      } justify-center my-20 p-8 rounded-xl mx-auto max-w-4xl bg-green-50 shadow-inner`}
    >
      <h1 className="text-2xl font-semibold mb-6 text-center">
        Product Purchase
      </h1>

      {/* Mode Selection Buttons */}
      <div className="flex justify-center mb-6 text-lg font-semibold">
        <button
          onClick={() => handleModeSelection("add")}
          className={`mx-2 px-4 py-2 rounded ${
            mode === "add"
              ? "bg-green-500 text-white shadow-2xl"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Add New Product
        </button>
        <button
          onClick={() => handleModeSelection("update")}
          className={`mx-2 px-4 py-2 rounded ${
            mode === "update"
              ? "bg-green-500 text-white shadow-2xl"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Update Existing Product
        </button>
      </div>

      {/* Display Error and Success Messages */}
      {error && (
        <div className="flex items-center text-red-500 mb-4">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center text-green-500 mb-4">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>{success}</span>
        </div>
      )}

      {/* Add New Product Form */}
      {mode === "add" && (
        <form onSubmit={handleAddNewProduct} className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Add New Product</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Bill Date */}
            <div>
              <label htmlFor="newBillDate" className="block mb-2 font-medium">
                Bill Date<span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="newBillDate"
                value={newBillDate}
                onChange={(e) => setNewBillDate(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            {/* Bill Number */}
            <div>
              <label htmlFor="newBillNumber" className="block mb-2 font-medium">
                Bill Number<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="newBillNumber"
                value={newBillNumber}
                onChange={(e) => setNewBillNumber(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            {/* Employee Selection */}
            <div>
              <label htmlFor="newEmployee" className="block mb-2 font-medium">
                Employee<span className="text-red-500">*</span>
              </label>
              <select
                id="newEmployee"
                value={newEmployeeId || ""}
                onChange={(e) => setNewEmployeeId(parseInt(e.target.value, 10))}
                className="w-full p-2 border rounded"
                required
              >
                <option value="" disabled>
                  Select Employee
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Purchase From */}
            <div>
              <label
                htmlFor="newPurchaseFrom"
                className="block mb-2 font-medium"
              >
                Purchase From<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="newPurchaseFrom"
                value={newPurchaseFrom}
                onChange={(e) => setNewPurchaseFrom(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            {/* Product Name */}
            <div>
              <label
                htmlFor="newProductName"
                className="block mb-2 font-medium"
              >
                Product Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="newProductName"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            {/* Product ID */}
            <div>
              <label htmlFor="newProductId" className="block mb-2 font-medium">
                Product ID<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="newProductId"
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Rate */}
            <div>
              <label htmlFor="newRate" className="block mb-2 font-medium">
                Party Rate<span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="newRate"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="w-full p-2 border rounded"
                min="0.01"
                step="0.01"
                required
              />
            </div>

            {/* MRP */}
            <div>
              <label htmlFor="newMrp" className="block mb-2 font-medium">
                MRP<span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="newMrp"
                value={newMrp}
                onChange={(e) => setNewMrp(e.target.value)}
                className="w-full p-2 border rounded"
                min="0.01"
                step="0.01"
                required
              />
            </div>

            {/* Quantity */}
            <div>
              <label htmlFor="newQuantity" className="block mb-2 font-medium">
                Quantity<span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="newQuantity"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="w-full p-2 border rounded"
                min="1"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className={`mt-4 w-full p-2 text-white rounded ${
              isLoading
                ? "bg-blue-500 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600"
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Preparing..." : "Add New Product"}
          </button>
        </form>
      )}

      {/* Update Existing Product Form */}
      {mode === "update" && (
        <form onSubmit={handleUpdateExistingProduct} className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Update Existing Product
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Bill Date */}
            <div>
              <label
                htmlFor="updateBillDate"
                className="block mb-2 font-medium"
              >
                Bill Date<span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="updateBillDate"
                value={updateBillDate}
                onChange={(e) => setUpdateBillDate(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            {/* Bill Number */}
            <div>
              <label
                htmlFor="updateBillNumber"
                className="block mb-2 font-medium"
              >
                Bill Number<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="updateBillNumber"
                value={updateBillNumber}
                onChange={(e) => setUpdateBillNumber(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            {/* Employee Selection */}
            <div>
              <label
                htmlFor="updateEmployee"
                className="block mb-2 font-medium"
              >
                Employee<span className="text-red-500">*</span>
              </label>
              <select
                id="updateEmployee"
                value={updateEmployeeId || ""}
                onChange={(e) =>
                  setUpdateEmployeeId(parseInt(e.target.value, 10))
                }
                className="w-full p-2 border rounded"
                required
              >
                <option value="" disabled>
                  Select Employee
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Search */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-3">
              <label htmlFor="searchProduct" className="block mb-2 font-medium">
                Search Product by Name or ID<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="searchProduct"
                value={updateSearchQuery}
                onChange={handleUpdateSearchInputChange}
                onFocus={() => {
                  if (updateSearchQuery.length > 2) {
                    debouncedFetchSuggestions(updateSearchQuery);
                  }
                }}
                placeholder="Type product name or ID"
                className="w-full p-2 border rounded"
                autoComplete="off"
                required
              />

              {/* Suggestion Dropdown */}
              {productSuggestions.length > 0 && (
                <ul className="absolute z-10 border rounded bg-white shadow-md max-h-60 overflow-y-auto w-full">
                  {productSuggestions.map((product) => (
                    <li
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {product.product_name} ({product.product_id})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Display Selected Product Details */}
          {selectedProduct && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Purchase From */}
                <div>
                  <label
                    htmlFor="updatePurchaseFrom"
                    className="block mb-2 font-medium"
                  >
                    Purchase From<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="updatePurchaseFrom"
                    value={updatePurchaseFrom}
                    onChange={(e) => setUpdatePurchaseFrom(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>

                {/* Product Name */}
                <div>
                  <label
                    htmlFor="updateProductName"
                    className="block mb-2 font-medium"
                  >
                    Product Name
                  </label>
                  <input
                    type="text"
                    id="updateProductName"
                    value={selectedProduct.product_name}
                    readOnly
                    className="w-full p-2 border rounded bg-gray-100"
                  />
                </div>

                {/* Product ID */}
                <div>
                  <label
                    htmlFor="updateProductId"
                    className="block mb-2 font-medium"
                  >
                    Product ID
                  </label>
                  <input
                    type="text"
                    id="updateProductId"
                    value={selectedProduct.product_id}
                    readOnly
                    className="w-full p-2 border rounded bg-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Rate */}
                <div>
                  <label
                    htmlFor="updateRate"
                    className="block mb-2 font-medium"
                  >
                    Party Rate<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="updateRate"
                    value={updateRate}
                    onChange={(e) => setUpdateRate(e.target.value)}
                    className="w-full p-2 border rounded"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>

                {/* MRP */}
                <div>
                  <label htmlFor="updateMrp" className="block mb-2 font-medium">
                    MRP<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="updateMrp"
                    value={updateMrp}
                    onChange={(e) => setUpdateMrp(e.target.value)}
                    className="w-full p-2 border rounded"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label
                    htmlFor="updateQuantity"
                    className="block mb-2 font-medium"
                  >
                    Quantity to Add<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="updateQuantity"
                    value={updateQuantity}
                    onChange={(e) => setUpdateQuantity(e.target.value)}
                    className="w-full p-2 border rounded"
                    min="1"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {selectedProduct && (
            <button
              type="submit"
              className={`mt-4 w-full p-2 text-white rounded ${
                isLoading
                  ? "bg-blue-500 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600"
              }`}
              disabled={isLoading}
            >
              {isLoading ? "Preparing..." : "Update Stock"}
            </button>
          )}
        </form>
      )}

      {/* Current Stock Section */}
      {branch && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">
            Current Stock for Branch: {branch}
          </h2>

          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search by Product ID or Name"
            value={stockSearchQuery}
            onChange={handleStockSearchInputChange}
            className="w-full p-2 border rounded mb-4"
          />

          {/* Stock Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Product ID</th>
                  <th className="py-2 px-4 border-b">Product Name</th>
                  <th className="py-2 px-4 border-b">Quantity</th>
                  {role !== "employee" && (
                    <th className="py-2 px-4 border-b">Party Rate</th>
                  )}
                  <th className="py-2 px-4 border-b">MRP</th>
                  <th className="py-2 px-4 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedStocks.map((stock) => (
                  <tr key={stock.product.product_id}>
                    <td className="py-2 px-4 border-b text-center">
                      {stock.product.product_id}
                    </td>
                    <td className="py-2 px-4 border-b">
                      {stock.product.product_name}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      {stock.quantity}
                    </td>
                    {role !== "employee" && (
                      <td className="py-2 px-4 border-b text-center">
                        {stock.product.rate !== null
                          ? parseFloat(stock.product.rate).toFixed(2)
                          : "N/A"}
                      </td>
                    )}
                    <td className="py-2 px-4 border-b text-center">
                      {stock.product.mrp !== null
                        ? parseFloat(stock.product.mrp).toFixed(2)
                        : "N/A"}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      <button
                        onClick={() => handleSelectProduct(stock.product)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
                {displayedStocks.length === 0 && (
                  <tr>
                    <td
                      colSpan={role !== "employee" ? "6" : "5"}
                      className="py-4 text-center"
                    >
                      No stock entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-4 space-x-4">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded ${
                  currentPage === 1
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded ${
                  currentPage === totalPages
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Purchase Modal */}
      <Modal
        isOpen={state.modals.showPurchaseModal}
        onRequestClose={handleCancelModal}
        contentLabel="Preview Purchase"
        className="max-w-4xl mx-auto mt-20 bg-white p-6 rounded shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        {state.purchaseModal.content && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Preview {state.purchaseModal.content.mode}
            </h2>
            <div className="space-y-2">
              {/* Display purchase details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Bill Date:</span>
                </div>
                <div>
                  <span>{state.purchaseModal.content.bill_date}</span>
                </div>

                <div>
                  <span className="font-medium">Bill Number:</span>
                </div>
                <div>
                  <span>{state.purchaseModal.content.bill_number || ""}</span>
                </div>

                <div>
                  <span className="font-medium">Employee:</span>
                </div>
                <div>
                  <span>{state.purchaseModal.content.employee}</span>
                </div>

                <div>
                  <span className="font-medium">Product Name:</span>
                </div>
                <div>
                  <span>{state.purchaseModal.content.product_name}</span>
                </div>

                <div>
                  <span className="font-medium">Product ID:</span>
                </div>
                <div>
                  <span>{state.purchaseModal.content.product_id}</span>
                </div>

                <div>
                  <span className="font-medium">Rate:</span>
                </div>
                <div>
                  <span>{state.purchaseModal.content.rate.toFixed(2)}</span>
                </div>

                <div>
                  <span className="font-medium">MRP:</span>
                </div>
                <div>
                  <span>{state.purchaseModal.content.mrp.toFixed(2)}</span>
                </div>

                <div>
                  <span className="font-medium">Quantity:</span>
                </div>
                <div>
                  <span>{state.purchaseModal.content.quantity}</span>
                </div>

                <div>
                  <span className="font-medium">Purchase From:</span>
                </div>
                <div>
                  <span>{state.purchaseModal.content.purchase_from}</span>
                </div>
              </div>
            </div>

            {/* Employee Verification inside the modal */}
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Verify Employee</h3>
              <EmployeeVerification
                employee={state.purchaseModal.content.employee}
                onVerify={(isVerified) => {
                  if (isVerified) {
                    // Enable confirm button
                    dispatch({
                      type: "SET_PURCHASE_MODAL",
                      payload: {
                        action: state.purchaseModal.action,
                        content: {
                          ...state.purchaseModal.content,
                          isEmployeeVerified: true,
                        },
                        showModal: true,
                      },
                    });
                  }
                }}
              />
            </div>

            {/* Error and Success Messages within Modal */}
            {error && (
              <div className="flex items-center text-red-500 mt-4">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center text-green-500 mt-4">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>{success}</span>
              </div>
            )}

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={handleCancelModal}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmModal}
                className={`px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 ${
                  !state.purchaseModal.content.isEmployeeVerified
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                disabled={!state.purchaseModal.content.isEmployeeVerified}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeeStockManagement;

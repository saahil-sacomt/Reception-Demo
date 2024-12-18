// client/src/pages/StockManagement.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import supabase from "../supabaseClient";
import { debounce } from "lodash";
import { useAuth } from "../context/AuthContext";
import { useGlobalState } from "../context/GlobalStateContext";
import { ClipLoader } from "react-spinners";
import ReactPaginate from "react-paginate";
import {
  addOrUpdateStock,
  bulkUploadStock,
  assignStock,
  editStock,
} from "../services/authService";
import EditStockModal from "../components/EditStockModal";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const StockManagement = ({ isCollapsed }) => {
  const { user, role } = useAuth();
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const { state, dispatch } = useGlobalState();

  // ============================
  // Add/Update Stock States
  // ============================
  const [searchProductAdd, setSearchProductAdd] = useState("");
  const [productSuggestionsAdd, setProductSuggestionsAdd] = useState([]);
  const [selectedProductAdd, setSelectedProductAdd] = useState("");
  const [quantityAdd, setQuantityAdd] = useState("");
  const [rateAdd, setRateAdd] = useState("");
  const [mrpAdd, setMrpAdd] = useState("");
  const [showSuggestionsAdd, setShowSuggestionsAdd] = useState(false);
  const [selectedBranchAdd, setSelectedBranchAdd] = useState("");

  // ============================
  // Assign Stock States
  // ============================
  const [searchProductAssign, setSearchProductAssign] = useState("");
  const [productSuggestionsAssign, setProductSuggestionsAssign] = useState([]);
  const [selectedProductAssign, setSelectedProductAssign] = useState(""); // internal PK
  const [quantityAssign, setQuantityAssign] = useState("");
  const [rateAssign, setRateAssign] = useState("");
  const [mrpAssign, setMrpAssign] = useState("");
  const [hsnCodeAssign, setHsnCodeAssign] = useState("");
  const [fromBranchAssign, setFromBranchAssign] = useState("");
  const [toBranchAssign, setToBranchAssign] = useState("");
  const [showSuggestionsAssign, setShowSuggestionsAssign] = useState(false);

  // ============================
  // Bulk Upload Stock States
  // ============================
  const [bulkBranchUpload, setBulkBranchUpload] = useState("");
  const [uploadFormatUpload, setUploadFormatUpload] = useState("csv");
  const [fileUpload, setFileUpload] = useState(null);
  const [bulkUploadMode, setBulkUploadMode] = useState("add"); 

  // ============================
  // Bulk Assign Stock States
  // ============================
  const [bulkFromBranchAssign, setBulkFromBranchAssign] = useState("");
  const [bulkToBranchAssign, setBulkToBranchAssign] = useState("");
  const [uploadFormatAssign, setUploadFormatAssign] = useState("csv");
  const [fileAssign, setFileAssign] = useState(null);

  // ============================
  // Lookup Stock States
  // ============================
  const [lookupSearchProduct, setLookupSearchProduct] = useState("");
  const [lookupProductSuggestions, setLookupProductSuggestions] = useState([]);
  const [showSuggestionsLookup, setShowSuggestionsLookup] = useState(false);
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupBranch, setLookupBranch] = useState("");

  const isLoadingRef = useRef(false);
  const fileUploadRef = useRef(null);
  const fileAssignRef = useRef(null);
  const isUploadingRef = useRef(false);
  const [stockToEdit, setStockToEdit] = useState(null);

  // ============================
  // Pagination States
  // ============================
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  // ============================
  // Warn user before unloading during upload
  // ============================
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isUploadingRef.current) {
        e.preventDefault();
        e.returnValue =
          "A bulk upload is in progress. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // ============================
  // Fetch branches and products on mount
  // ============================
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch branches
        const { data: branchesData, error: branchesError } = await supabase
          .from("branches")
          .select("*");

        if (branchesError) {
          toast.error("Failed to fetch branches.");
          return;
        }
        setBranches(branchesData);

        // Fetch products (all products from DB)
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("*");

        if (productsError) {
          toast.error("Failed to fetch products.");
          return;
        }
        setProducts(productsData || []);
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("An unexpected error occurred while fetching data.");
      }
    };
    fetchData();
  }, []);

  // ============================
  // Debounced fetch for product suggestions (Add)
  // ============================
  const fetchProductSuggestionsAdd = useCallback(
    debounce(async (query) => {
      if (query.length < 1) {
        setProductSuggestionsAdd([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, product_name, product_id, rate, mrp")
          .or(`product_name.ilike.%${query}%,product_id.ilike.%${query}%`)
          .limit(20);

        if (error) {
          console.error("Error fetching product suggestions (Add):", error);
          setProductSuggestionsAdd([]);
          return;
        }
        setProductSuggestionsAdd(data || []);
      } catch (err) {
        console.error("Error fetching product suggestions (Add):", err);
        setProductSuggestionsAdd([]);
      }
    }, 300),
    []
  );

  // ============================
  // Debounced fetch for product suggestions (Assign)
  // ============================
  const fetchProductSuggestionsAssign = useCallback(
    debounce(async (query) => {
      if (query.length < 1) {
        setProductSuggestionsAssign([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, product_name, product_id, rate, mrp, hsn_code")
          .or(`product_name.ilike.%${query}%,product_id.ilike.%${query}%`)
          .limit(20);

        if (error) {
          console.error("Error fetching product suggestions (Assign):", error);
          setProductSuggestionsAssign([]);
          return;
        }
        setProductSuggestionsAssign(data || []);
      } catch (err) {
        console.error("Error fetching product suggestions (Assign):", err);
        setProductSuggestionsAssign([]);
      }
    }, 300),
    []
  );

  // ============================
  // Debounced fetch for product suggestions (Lookup)
  // ============================
  const fetchProductSuggestionsLookup = useCallback(
    debounce(async (query) => {
      if (query.length < 1) {
        setLookupProductSuggestions([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, product_name, product_id")
          .or(`product_name.ilike.%${query}%,product_id.ilike.%${query}%`)
          .limit(20);

        if (error) {
          console.error("Error fetching product suggestions (Lookup):", error);
          setLookupProductSuggestions([]);
          return;
        }
        setLookupProductSuggestions(data || []);
      } catch (err) {
        console.error("Error fetching product suggestions (Lookup):", err);
        setLookupProductSuggestions([]);
      }
    }, 300),
    []
  );

  // ============================
  // Handlers for Add/Update Stock Form
  // ============================
  const handleProductInputAdd = (e) => {
    const query = e.target.value;
    setSearchProductAdd(query);
    fetchProductSuggestionsAdd(query);
    setShowSuggestionsAdd(true);
  };

  const handleProductSelectAdd = (product) => {
    setSelectedProductAdd(product.id); // internal PK
    setSearchProductAdd(`${product.product_name} (${product.product_id})`);
    setProductSuggestionsAdd([]);
    setShowSuggestionsAdd(false);
    // set Rate & MRP from product DB
    setRateAdd(product.rate !== null ? product.rate.toFixed(2) : "");
    setMrpAdd(product.mrp !== null ? product.mrp.toFixed(2) : "");
  };

  // ============================
  // Handlers for Assign Stock Form
  // ============================
  const handleProductInputAssign = (e) => {
    const query = e.target.value;
    setSearchProductAssign(query);
    fetchProductSuggestionsAssign(query);
    setShowSuggestionsAssign(true);
  };

  const handleProductSelectAssign = (product) => {
    setSelectedProductAssign(product.id); // internal PK
    setSearchProductAssign(`${product.product_name} (${product.product_id})`);
    setProductSuggestionsAssign([]);
    setShowSuggestionsAssign(false);
    setRateAssign(product.rate !== null ? product.rate.toFixed(2) : "");
    setMrpAssign(product.mrp !== null ? product.mrp.toFixed(2) : "");
    setHsnCodeAssign(product.hsn_code || "");
  };

  // ============================
  // Handlers for Lookup Stock Form
  // ============================
  const handleLookupProductInput = (e) => {
    const query = e.target.value;
    setLookupSearchProduct(query);
    fetchProductSuggestionsLookup(query);
    setShowSuggestionsLookup(true);
  };

  const handleLookupProductSelect = (product) => {
    setLookupSearchProduct(`${product.product_name} (${product.product_id})`);
    setLookupProductSuggestions([]);
    setShowSuggestionsLookup(false);

    // Fetch specific product's stock in lookupBranch
    const fetchLookupStock = async () => {
      try {
        const { data, error } = await supabase
          .from("stock")
          .select(`
            quantity,
            product:products(id, product_name, product_id, rate, mrp, hsn_code)
          `)
          .eq("branch_code", lookupBranch)
          .eq("product_id", product.id) // Internal ID
          .single();

        if (error || !data) {
          setLookupResults([]);
          toast.info("No stock found for the selected product.");
        } else {
          setLookupResults([data]);
        }
      } catch (err) {
        console.error("Error fetching lookup stock:", err);
        setLookupResults([]);
        toast.error("Failed to fetch stock details.");
      }
    };
    fetchLookupStock();
  };

  // ============================
  // Refresh stock data
  // ============================
  const refreshStockData = useCallback(async () => {
    if (!lookupBranch) return;
    try {
      const { data, error } = await supabase
        .from("stock")
        .select(`
          quantity,
          product:products(id, product_name, product_id, rate, mrp, hsn_code)
        `)
        .eq("branch_code", lookupBranch);

      if (error) {
        toast.error("Failed to refresh stock data.");
        return;
      }

      let filtered = data;
      if (searchProductAdd.trim()) {
        const searchLower = searchProductAdd.toLowerCase();
        filtered = data.filter(
          (stock) =>
            stock.product.product_id.toLowerCase().includes(searchLower) ||
            stock.product.product_name.toLowerCase().includes(searchLower)
        );
      }
      setFilteredStocks(filtered);
      setCurrentPage(0);
    } catch (err) {
      console.error("Error refreshing stock data:", err);
      toast.error("An unexpected error occurred while refreshing stock data.");
    }
  }, [lookupBranch, searchProductAdd]);

  // ============================
  // Bulk Upload to Single Branch
  // ============================
  const handleBulkUploadToBranch = useCallback(
    async (e) => {
      e.preventDefault();
      if (!bulkBranchUpload || !fileUpload) {
        toast.error("Please select a branch and upload a file.");
        return;
      }

      const allowedExtensions = ["csv"];
      const fileExtension = fileUpload.name.split(".").pop().toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        toast.error("Invalid file format. Please upload a CSV file.");
        return;
      }

      isLoadingRef.current = true;
      isUploadingRef.current = true;

      try {
        const response = await bulkUploadStock(
          fileUpload,
          uploadFormatUpload,
          bulkBranchUpload,
          null,
          bulkUploadMode
        );

        if (response.success) {
          toast.success("Bulk stock upload successful.");
          setFileUpload(null);
          setBulkBranchUpload("");
          setUploadFormatUpload("csv");
          setBulkUploadMode("add");
          if (fileUploadRef.current) fileUploadRef.current.value = "";
          refreshStockData();
        } else {
          toast.error(response.error || "Bulk upload failed.");
        }
      } catch (err) {
        console.error("Error during bulk upload:", err);
        toast.error("An unexpected error occurred during bulk upload.");
      } finally {
        isUploadingRef.current = false;
        isLoadingRef.current = false;
      }
    },
    [bulkBranchUpload, fileUpload, uploadFormatUpload, bulkUploadMode, refreshStockData]
  );

  // ============================
  // UseEffect: fetch stock data based on lookupBranch
  // ============================
  useEffect(() => {
    const fetchStockData = async () => {
      if (!lookupBranch) {
        setFilteredStocks([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("stock")
          .select(`
            quantity,
            product:products(id, product_name, product_id, rate, mrp, hsn_code)
          `)
          .eq("branch_code", lookupBranch);

        if (error) {
          toast.error("Failed to fetch stock data.");
          return;
        }
        let filtered = data;
        if (searchProductAdd.trim()) {
          const searchLower = searchProductAdd.toLowerCase();
          filtered = data.filter(
            (stock) =>
              stock.product.product_id.toLowerCase().includes(searchLower) ||
              stock.product.product_name.toLowerCase().includes(searchLower)
          );
        }
        setFilteredStocks(filtered);
        setCurrentPage(0);
      } catch (err) {
        console.error("Error fetching stock data:", err);
        toast.error("An unexpected error occurred while fetching stock data.");
      }
    };
    fetchStockData();
  }, [lookupBranch, searchProductAdd]);

  // ============================
  // File change handlers
  // ============================
  const handleFileChangeUpload = useCallback((e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) setFileUpload(uploadedFile);
    else setFileUpload(null);
  }, []);

  const handleFileChangeAssign = useCallback((e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) setFileAssign(uploadedFile);
    else setFileAssign(null);
  }, []);

  // ============================
  // Bulk Assign Stock
  // ============================
  const handleBulkAssign = useCallback(
    async (e) => {
      e.preventDefault();
      if (!bulkFromBranchAssign || !bulkToBranchAssign || !fileAssign) {
        toast.error("Please select both source and destination branches and upload a file.");
        return;
      }
      if (bulkFromBranchAssign === bulkToBranchAssign) {
        toast.error("From and To branches cannot be the same.");
        return;
      }

      const allowedExtensions = ["csv"];
      const fileExtension = fileAssign.name.split(".").pop().toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        toast.error(
          `Invalid file format. Please upload a ${uploadFormatAssign === "csv" ? "CSV" : "XML"} file.`
        );
        return;
      }

      isLoadingRef.current = true;
      isUploadingRef.current = true;

      try {
        // Bulk stock function with "add" mode
        const response = await bulkUploadStock(
          fileAssign,
          uploadFormatAssign,
          bulkFromBranchAssign,
          bulkToBranchAssign,
          "add"
        );

        if (response.success) {
          let message = "Bulk stock assign successful.";
          if (response.insertedProducts && response.insertedProducts.length > 0) {
            message += ` Inserted ${response.insertedProducts.length} new product(s).`;
          }
          toast.success(message);
          setFileAssign(null);
          setUploadFormatAssign("csv");
          setBulkFromBranchAssign("");
          setBulkToBranchAssign("");
          if (fileAssignRef.current) fileAssignRef.current.value = "";
          refreshStockData();
        } else {
          toast.error(response.error || "Bulk assign failed.");
        }
      } catch (err) {
        console.error("Error during bulk assign:", err);
        toast.error("An unexpected error occurred during bulk assign.");
      } finally {
        isUploadingRef.current = false;
        isLoadingRef.current = false;
      }
    },
    [
      bulkFromBranchAssign,
      bulkToBranchAssign,
      fileAssign,
      uploadFormatAssign,
      refreshStockData,
    ]
  );

  // ============================
  // Pagination handlers
  // ============================
  const handlePageClick = (selectedItem) => {
    setCurrentPage(selectedItem.selected);
  };

  const offset = currentPage * itemsPerPage;
  const dataSource = lookupResults.length > 0 ? lookupResults : filteredStocks;
  const currentItems = dataSource.slice(offset, offset + itemsPerPage);
  const pageCount = Math.ceil(dataSource.length / itemsPerPage);

  // ============================
  // Handler for Add/Update Stock
  // ============================
  const handleAddUpdateStock = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selectedBranchAdd || !selectedProductAdd || !quantityAdd) {
        toast.error("Please fill in all required fields.");
        return;
      }

      const product = products.find((p) => p.id === parseInt(selectedProductAdd, 10));
      if (!product) {
        toast.error("Selected product does not exist.");
        return;
      }

      const qty = parseInt(quantityAdd, 10);
      if (isNaN(qty) || qty < 0) {
        toast.error("Please enter a valid quantity.");
        return;
      }

      isLoadingRef.current = true;
      try {
        const response = await addOrUpdateStock(
          product.id,
          selectedBranchAdd,
          qty,
          rateAdd ? parseFloat(rateAdd) : null,
          mrpAdd ? parseFloat(mrpAdd) : null
        );
        if (response.success) {
          toast.success("Stock updated successfully.");
          // Reset form
          setSelectedProductAdd("");
          setSearchProductAdd("");
          setQuantityAdd("");
          setRateAdd("");
          setMrpAdd("");
          setProductSuggestionsAdd([]);
          setShowSuggestionsAdd(false);
          refreshStockData();
        } else {
          toast.error(response.error || "Failed to update stock.");
        }
      } catch (err) {
        console.error("Error updating stock:", err);
        toast.error("An unexpected error occurred.");
      } finally {
        isLoadingRef.current = false;
      }
    },
    [
      selectedBranchAdd,
      selectedProductAdd,
      quantityAdd,
      rateAdd,
      mrpAdd,
      products,
      addOrUpdateStock,
      refreshStockData,
    ]
  );

  // ============================
  // Handler for Assigning Stock
  // ============================
  const handleAssignStock = useCallback(
    async (e) => {
      e.preventDefault();
  
      // Basic validations
      if (!fromBranchAssign || !toBranchAssign || !quantityAssign) {
        toast.error("Please fill in all required fields.");
        return;
      }
      if (fromBranchAssign === toBranchAssign) {
        toast.error("From and To branches cannot be the same.");
        return;
      }
  
      // Ensure a product is selected
      if (!selectedProductAssign) {
        toast.error("Please select a product from the suggestions.");
        return;
      }
  
      // Find the product in the local products array
      let product = products.find(
        (p) => p.id === parseInt(selectedProductAssign, 10)
      );
  
      // If product not found locally, perform a fallback lookup
      if (!product && searchProductAssign) {
        try {
          const input = searchProductAssign.toLowerCase().trim();
  
          // Step 1: Attempt exact match on product_id
          const { data: exactData, error: exactError } = await supabase
            .from("products")
            .select("id, product_name, product_id, rate, mrp, hsn_code")
            .eq("product_id", input)
            .single();
  
          if (!exactError && exactData) {
            product = exactData;
            setSelectedProductAssign(product.id.toString());
          } else {
            // Step 2: Attempt partial match on product_name
            const { data: partialData, error: partialError } = await supabase
              .from("products")
              .select("id, product_name, product_id, rate, mrp, hsn_code")
              .ilike("product_name", `%${input}%`)
              .limit(1);
  
            if (!partialError && partialData.length > 0) {
              product = partialData[0];
              setSelectedProductAssign(product.id.toString());
            }
          }
        } catch (errFetch) {
          console.error("Error in fallback DB lookup:", errFetch);
          toast.error("Failed to fetch product details. Please try again.");
          return;
        }
      }
  
      // If product is still not found, notify the user
      if (!product) {
        toast.error(
          "Selected product doesn't exist in the database. Please add it first."
        );
        return;
      }
  
      // Validate quantity
      const qty = parseInt(quantityAssign, 10);
      if (isNaN(qty) || qty <= 0) {
        toast.error("Please enter a valid quantity.");
        return;
      }
  
      // Validate rate and MRP
      if (rateAssign === "" || mrpAssign === "") {
        toast.error("Rate and MRP must be provided for the selected product.");
        return;
      }
  
      isLoadingRef.current = true;
  
      try {
        const assignments = [
          {
            product_id: product.id, // Internal PK
            from_branch_code: fromBranchAssign,
            to_branch_code: toBranchAssign,
            quantity: qty,
            notes: "", // Optional, can be customized
            rate: parseFloat(rateAssign),
            mrp: parseFloat(mrpAssign),
            hsn_code: hsnCodeAssign,
          },
        ];
  
        console.log("Submitting Assignments:", assignments);
  
        const response = await assignStock(assignments);
  
        if (response.success) {
          console.log("AssignStock Success:", response);
          toast.success("Stock assigned successfully.");
          // Reset form fields
          setFromBranchAssign("");
          setToBranchAssign("");
          setSelectedProductAssign("");
          setSearchProductAssign("");
          setRateAssign("");
          setMrpAssign("");
          setHsnCodeAssign("");
          setQuantityAssign("");
          setProductSuggestionsAssign([]);
          setShowSuggestionsAssign(false);
          refreshStockData();
        } else {
          console.error("AssignStock Failed:", response.error);
          toast.error(response.error || "Failed to assign stock.");
        }
      } catch (err) {
        console.error("Error assigning stock:", err);
        toast.error("An unexpected error occurred.");
      } finally {
        isLoadingRef.current = false;
      }
    },
    [
      fromBranchAssign,
      toBranchAssign,
      selectedProductAssign,
      quantityAssign,
      rateAssign,
      mrpAssign,
      hsnCodeAssign,
      searchProductAssign,
      products,
      assignStock,
      refreshStockData,
    ]
  );
  

  return (
    <div
      className={`transition-all duration-300 ${
        isCollapsed ? "mx-20" : "mx-20 px-20"
      } justify-center my-20 p-8 rounded-xl mx-auto max-w-4xl bg-green-50 shadow-inner`}
    >
      <h1 className="text-2xl font-semibold mb-6 text-center">Stock Management</h1>

      {/* ======= Add/Update Stock Manually ======= */}
      <form onSubmit={handleAddUpdateStock} className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Add or Update Stock Manually</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Branch Selection */}
          <div>
            <label htmlFor="branchAdd" className="block mb-2 font-medium">
              Select Branch
            </label>
            <select
              id="branchAdd"
              value={selectedBranchAdd}
              onChange={(e) => setSelectedBranchAdd(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="" disabled>
                Select Branch
              </option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name} {branch.type === "godown" ? "(Godown)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Product Selection */}
          <div className="relative">
            <label htmlFor="productSearchAdd" className="block mb-2 font-medium">
              Search Product
            </label>
            <input
              type="text"
              id="productSearchAdd"
              value={searchProductAdd}
              onChange={handleProductInputAdd}
              onFocus={() => setShowSuggestionsAdd(true)}
              onBlur={() => setTimeout(() => setShowSuggestionsAdd(false), 200)}
              placeholder="Type product name or ID"
              className="w-full p-2 border rounded"
              required
            />
            {showSuggestionsAdd && productSuggestionsAdd.length > 0 && (
              <ul className="absolute z-10 border rounded bg-white shadow-md max-h-40 overflow-y-auto w-full">
                {productSuggestionsAdd.map((product) => (
                  <li
                    key={product.id}
                    onClick={() => handleProductSelectAdd(product)}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {product.product_name} ({product.product_id})
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label htmlFor="quantityAdd" className="block mb-2 font-medium">
              Quantity
            </label>
            <input
              type="number"
              id="quantityAdd"
              value={quantityAdd}
              onChange={(e) => setQuantityAdd(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              required
            />
          </div>

          {/* Rate (Optional) */}
          <div>
            <label htmlFor="rateAdd" className="block mb-2 font-medium">
              Rate (Optional)
            </label>
            <input
              type="number"
              id="rateAdd"
              value={rateAdd}
              onChange={(e) => setRateAdd(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
            />
          </div>

          {/* MRP (Optional) */}
          <div>
            <label htmlFor="mrpAdd" className="block mb-2 font-medium">
              MRP (Optional)
            </label>
            <input
              type="number"
              id="mrpAdd"
              value={mrpAdd}
              onChange={(e) => setMrpAdd(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <button
          type="submit"
          className={`mt-4 w-full p-2 text-white rounded flex items-center justify-center ${
            isLoadingRef.current ? "bg-blue-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
          disabled={isLoadingRef.current}
        >
          {isLoadingRef.current ? (
            <>
              <ClipLoader size={20} color="#ffffff" />
              <span className="ml-2">Updating...</span>
            </>
          ) : (
            "Add/Update Stock"
          )}
        </button>
      </form>

      {/* ======= Bulk Upload to a Single Branch ======= */}
      <form onSubmit={handleBulkUploadToBranch} className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Bulk Upload Stock to a Branch</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="bulkBranchUpload" className="block mb-2 font-medium">
              Select Branch/Godown
            </label>
            <select
              id="bulkBranchUpload"
              value={bulkBranchUpload}
              onChange={(e) => setBulkBranchUpload(e.target.value)}
              className="w-full p-2 mt-2 border rounded"
              required
            >
              <option value="" disabled>
                Select Branch
              </option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name} {branch.type === "godown" ? "(Godown)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="uploadFormatUpload" className="block mb-2 font-medium">
              File Format
            </label>
            <select
              id="uploadFormatUpload"
              value={uploadFormatUpload}
              onChange={(e) => setUploadFormatUpload(e.target.value)}
              className="w-full p-2 mt-2 border rounded"
              required
            >
              <option value="csv">CSV</option>
            </select>
          </div>
          <div className="mb-4">
            <h2 className="font-semibold mb-4">Select Upload Mode</h2>
            <div className="flex space-x-4">
              <button
                type="button"
                className={`px-4 py-2 rounded ${
                  bulkUploadMode === "add" ? "bg-green-500 text-white shadow-xl" : "bg-gray-200 text-gray-700"
                }`}
                onClick={() => setBulkUploadMode("add")}
              >
                Update Stock
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded ${
                  bulkUploadMode === "rewrite" ? "bg-green-500 text-white shadow-xl" : "bg-gray-200 text-gray-700"
                }`}
                onClick={() => setBulkUploadMode("rewrite")}
              >
                Rewrite Stock
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="bulkBranchFile" className="block mb-2 font-medium">
            Upload CSV File
          </label>
          <input
            type="file"
            id="bulkBranchFile"
            accept=".csv"
            onChange={handleFileChangeUpload}
            className="w-full p-2 border rounded"
            required
            ref={fileUploadRef}
          />
        </div>
        <button
          type="submit"
          className={`mt-4 w-full p-2 text-white rounded flex items-center justify-center ${
            isLoadingRef.current ? "bg-blue-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
          disabled={isLoadingRef.current}
        >
          {isLoadingRef.current ? (
            <>
              <ClipLoader size={20} color="#ffffff" />
              <span className="ml-2">Uploading... Please wait</span>
            </>
          ) : (
            "Upload Bulk Stock"
          )}
        </button>
      </form>

      {/* ======= Assign Stock Between Branches ======= */}
      <form onSubmit={handleAssignStock} className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Assign Stock Between Branches/Godowns</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="fromBranchAssign" className="block mb-2 font-medium">
              From Branch/Godown
            </label>
            <select
              id="fromBranchAssign"
              value={fromBranchAssign}
              onChange={(e) => setFromBranchAssign(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="" disabled>
                Select Source
              </option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name} {branch.type === "godown" ? "(Godown)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="toBranchAssign" className="block mb-2 font-medium">
              To Branch/Godown
            </label>
            <select
              id="toBranchAssign"
              value={toBranchAssign}
              onChange={(e) => setToBranchAssign(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="" disabled>
                Select Destination
              </option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name} {branch.type === "godown" ? "(Godown)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <label htmlFor="assignProduct" className="block mb-2 font-medium">
              Product
            </label>
            <input
              type="text"
              id="assignProduct"
              name="assignProduct"
              value={searchProductAssign}
              onChange={handleProductInputAssign}
              onFocus={() => setShowSuggestionsAssign(true)}
              onBlur={() => setTimeout(() => setShowSuggestionsAssign(false), 200)}
              placeholder="Type product name or ID"
              className="w-full p-2 border rounded"
              required
            />
            {showSuggestionsAssign && productSuggestionsAssign.length > 0 && (
              <ul className="absolute z-10 border rounded bg-white shadow-md max-h-40 overflow-y-auto w-full">
                {productSuggestionsAssign.map((prod) => (
                  <li
                    key={prod.id}
                    onClick={() => handleProductSelectAssign(prod)}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {prod.product_name} ({prod.product_id})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="rateAssign" className="block mb-2 font-medium">
              Rate
            </label>
            <input
              type="number"
              id="rateAssign"
              value={rateAssign}
              onChange={(e) => setRateAssign(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
              required
              disabled={!selectedProductAssign || isLoadingRef.current}
            />
          </div>
          <div>
            <label htmlFor="mrpAssign" className="block mb-2 font-medium">
              MRP
            </label>
            <input
              type="number"
              id="mrpAssign"
              value={mrpAssign}
              onChange={(e) => setMrpAssign(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
              required
              disabled={!selectedProductAssign || isLoadingRef.current}
            />
          </div>
          <div>
            <label htmlFor="hsnCodeAssign" className="block mb-2 font-medium">
              HSN Code
            </label>
            <input
              type="text"
              id="hsnCodeAssign"
              value={hsnCodeAssign}
              onChange={(e) => setHsnCodeAssign(e.target.value)}
              className="w-full p-2 border rounded"
              required
              disabled={!selectedProductAssign || isLoadingRef.current}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="quantityAssign" className="block mb-2 font-medium">
            Quantity
          </label>
          <input
            type="number"
            id="quantityAssign"
            name="quantityAssign"
            value={quantityAssign}
            onChange={(e) => setQuantityAssign(e.target.value)}
            className="w-full p-2 border rounded"
            min="1"
            required
            disabled={isLoadingRef.current}
          />
        </div>

        <button
          type="submit"
          className={`mt-4 w-full p-2 text-white rounded flex items-center justify-center ${
            isLoadingRef.current ? "bg-blue-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
          disabled={isLoadingRef.current}
        >
          {isLoadingRef.current ? (
            <>
              <ClipLoader size={20} color="#ffffff" />
              <span className="ml-2">Assigning...</span>
            </>
          ) : (
            "Assign Stock"
          )}
        </button>
      </form>

      {/* ======= Bulk Assign Stock ======= */}
      <form onSubmit={handleBulkAssign} className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Bulk Assign Stock</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="bulkFromBranchAssign" className="block mb-2 font-medium">
              From Branch/Godown
            </label>
            <select
              id="bulkFromBranchAssign"
              value={bulkFromBranchAssign}
              onChange={(e) => setBulkFromBranchAssign(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="" disabled>
                Select Source
              </option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name} {branch.type === "godown" ? "(Godown)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bulkToBranchAssign" className="block mb-2 font-medium">
              To Branch/Godown
            </label>
            <select
              id="bulkToBranchAssign"
              value={bulkToBranchAssign}
              onChange={(e) => setBulkToBranchAssign(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="" disabled>
                Select Destination
              </option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name} {branch.type === "godown" ? "(Godown)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="uploadFormatAssign" className="block mb-2 font-medium">
              File Format
            </label>
            <select
              id="uploadFormatAssign"
              value={uploadFormatAssign}
              onChange={(e) => setUploadFormatAssign(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="csv">CSV</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="bulkAssignFile" className="block mb-2 font-medium">
            Upload CSV File
          </label>
          <input
            type="file"
            id="bulkAssignFile"
            accept=".csv"
            onChange={handleFileChangeAssign}
            className="w-full p-2 border rounded"
            required
            ref={fileAssignRef}
          />
        </div>
        <button
          type="submit"
          className={`mt-4 w-full p-2 text-white rounded flex items-center justify-center ${
            isLoadingRef.current ? "bg-blue-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
          disabled={isLoadingRef.current}
        >
          {isLoadingRef.current ? (
            <>
              <ClipLoader size={20} color="#ffffff" />
              <span className="ml-2">Uploading... Please wait</span>
            </>
          ) : (
            "Upload Bulk Assign"
          )}
        </button>
      </form>

      {/* ======= Lookup Stock Details ======= */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Lookup Stock Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lookupBranch" className="block mb-2 font-medium">
              Select Branch
            </label>
            <select
              id="lookupBranch"
              value={lookupBranch}
              onChange={(e) => {
                setLookupBranch(e.target.value);
                setLookupResults([]); 
              }}
              className="w-full p-2 border rounded"
              required
            >
              <option value="" disabled>
                Select Branch
              </option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name} {branch.type === "godown" ? "(Godown)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <label htmlFor="lookupProduct" className="block mb-2 font-medium">
              Search Product by ID or Name
            </label>
            <input
              type="text"
              id="lookupProduct"
              value={lookupSearchProduct}
              onChange={handleLookupProductInput}
              onFocus={() => setShowSuggestionsLookup(true)}
              onBlur={() => setTimeout(() => setShowSuggestionsLookup(false), 200)}
              placeholder="Type product name or ID"
              className="w-full p-2 border rounded"
              required
            />
            {showSuggestionsLookup && lookupProductSuggestions.length > 0 && (
              <ul className="absolute z-10 border rounded bg-white shadow-md max-h-40 overflow-y-auto w-full">
                {lookupProductSuggestions.map((product) => (
                  <li
                    key={product.id}
                    onClick={() => handleLookupProductSelect(product)}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {product.product_name} ({product.product_id})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {lookupBranch && (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Product ID</th>
                  <th className="py-2 px-4 border-b">Product Name</th>
                  <th className="py-2 px-4 border-b">Quantity</th>
                  <th className="py-2 px-4 border-b">Rate</th>
                  <th className="py-2 px-4 border-b">MRP</th>
                  <th className="py-2 px-4 border-b">HSN Code</th>
                  <th className="py-2 px-4 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((stock) => (
                    <tr key={`${stock.product.id}-${lookupBranch}`}>
                      <td className="py-2 px-4 border-b text-center">
                        {stock.product.product_id}
                      </td>
                      <td className="py-2 px-4 border-b">{stock.product.product_name}</td>
                      <td className="py-2 px-4 border-b text-center">{stock.quantity}</td>
                      <td className="py-2 px-4 border-b text-center">
                        {stock.product.rate !== null ? stock.product.rate.toFixed(2) : "N/A"}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        {stock.product.mrp !== null ? stock.product.mrp.toFixed(2) : "N/A"}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        {stock.product.hsn_code || "N/A"}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        <button
                          onClick={() => {
                            setStockToEdit({
                              ...stock,
                              branch_code: lookupBranch,
                            });
                            dispatch({
                              type: "SET_MODAL_STATE",
                              payload: { showEditStockModal: true },
                            });
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-4 text-center">
                      No stock entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {pageCount > 1 && (
              <div className="flex justify-center mt-4">
                <ReactPaginate
                  previousLabel={"← Previous"}
                  nextLabel={"Next →"}
                  pageCount={pageCount}
                  onPageChange={handlePageClick}
                  containerClassName={"flex space-x-2"}
                  previousLinkClassName={"px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"}
                  nextLinkClassName={"px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"}
                  disabledClassName={"opacity-50 cursor-not-allowed"}
                  activeClassName={"bg-blue-500 text-white rounded"}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======= Edit Stock Modal ======= */}
      {state.modals.showEditStockModal && stockToEdit && (
        <EditStockModal
          isOpen={state.modals.showEditStockModal}
          onClose={() =>
            dispatch({
              type: "SET_MODAL_STATE",
              payload: { showEditStockModal: false },
            })
          }
          stockEntry={stockToEdit}
          refreshStockData={refreshStockData}
        />
      )}

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default StockManagement;

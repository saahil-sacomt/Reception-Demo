// client/src/pages/StockManagement.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  addOrUpdateStock,
  bulkUploadStock,
  editStock,
} from "../services/authService"; // Updated import path
import supabase from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import EditStockModal from "../components/EditStockModal";
import { debounce } from "lodash"; // Ensure this component exists
import Papa from "papaparse"; // Ensure PapaParse is installed: npm install papaparse
import xml2js from "xml2js"; // Ensure xml2js is installed: npm install xml2js

const StockManagement = ({ isCollapsed }) => {
  const { user, role } = useAuth();
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [rate, setRate] = useState("");
  const [mrp, setMrp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [file, setFile] = useState(null);
  const [uploadFormat, setUploadFormat] = useState("csv");
  const [isLoading, setIsLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [stockToEdit, setStockToEdit] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState([]); // Define the state

  const [searchProduct, setSearchProduct] = useState("");
  const [filteredStocks, setFilteredStocks] = useState([]);

  const fileInputRef = useRef(null);
  const isUploadingRef = useRef(false); // To track if upload is in progress

  // Warn user before unloading the page during upload
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

  // Fetch branches and products on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch branches
        const { data: branchesData, error: branchesError } = await supabase
          .from("branches")
          .select("*");

        if (branchesError) {
          setError("Failed to fetch branches.");
          return;
        }

        setBranches(branchesData);

        // Fetch products
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("*");

        if (productsError) {
          setError("Failed to fetch products.");
          return;
        }

        setProducts(productsData);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("An unexpected error occurred while fetching data.");
      }
    };

    fetchData();
  }, []);

  // Debounced fetchProductSuggestions to limit API calls
  const fetchProductSuggestions = useCallback(
    async (query) => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, product_name, product_id")
          .ilike("product_name", `%${query}%`) // Match query anywhere in the name
          .limit(10);

        if (error) {
          console.error("Error fetching suggestions:", error);
          setProductSuggestions([]);
          return;
        }

        setProductSuggestions(data || []); // Update suggestions list
      } catch (err) {
        console.error("Error fetching product suggestions:", err);
      }
    },
    [setProductSuggestions]
  );

  const debouncedFetchSuggestions = useRef(
    debounce(fetchProductSuggestions, 300)
  ).current;

  // Function to refresh stock data
  const refreshStockData = useCallback(async () => {
    if (!selectedBranch) return;

    try {
      const { data, error } = await supabase
        .from("stock")
        .select(
          `
            quantity,
            product:products(id, product_name, product_id, rate, mrp)
          `
        )
        .eq("branch_code", selectedBranch);

      if (error) {
        setError("Failed to refresh stock data.");
        return;
      }

      let filtered = data;
      if (searchProduct.trim()) {
        const searchLower = searchProduct.toLowerCase();
        filtered = data.filter(
          (stock) =>
            stock.product.product_id.toLowerCase().includes(searchLower) ||
            stock.product.product_name.toLowerCase().includes(searchLower)
        );
      }

      setFilteredStocks(filtered);
    } catch (err) {
      console.error("Error refreshing stock data:", err);
      setError("An unexpected error occurred while refreshing stock data.");
    }
  }, [selectedBranch, searchProduct]);

  const handleSearchInput = useCallback(
    (e) => {
      const query = e.target.value;
      setSearchProduct(query);

      if (query.length > 1) {
        debouncedFetchSuggestions(query); // Use the debounced function
        setShowSuggestions(true);
      } else {
        setProductSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [debouncedFetchSuggestions]
  );

  // Fetch stock data based on selectedBranch and searchProduct
  useEffect(() => {
    const fetchStockData = async () => {
      if (!selectedBranch) {
        setFilteredStocks([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("stock")
          .select(
            `
              quantity,
              product:products(id, product_name, product_id, rate, mrp)
            `
          )
          .eq("branch_code", selectedBranch);

        if (error) {
          setError("Failed to fetch stock data.");
          return;
        }

        let filtered = data;
        if (searchProduct.trim()) {
          const searchLower = searchProduct.toLowerCase();
          filtered = data.filter(
            (stock) =>
              stock.product.product_id.toLowerCase().includes(searchLower) ||
              stock.product.product_name.toLowerCase().includes(searchLower)
          );
        }

        setFilteredStocks(filtered);
      } catch (err) {
        console.error("Error fetching stock data:", err);
        setError("An unexpected error occurred while fetching stock data.");
      }
    };

    fetchStockData();
  }, [selectedBranch, searchProduct]);

  // Handler to open edit modal
  const openEditModal = useCallback(
    (stockEntry) => {
      setStockToEdit({
        ...stockEntry,
        branch_code: selectedBranch, // Ensure branch_code is included
      });
      setIsEditModalOpen(true);
    },
    [selectedBranch]
  );

  // Handler to close edit modal
  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setStockToEdit(null);
  }, []);

  // Handler for manual stock addition
  const handleAddStock = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      setSuccess("");

      if (!selectedBranch || !selectedProduct || !quantity) {
        setError("Please fill in all required fields.");
        return;
      }

      const product = products.find(
        (p) => p.id === parseInt(selectedProduct, 10)
      );

      if (!product) {
        setError("Selected product does not exist.");
        return;
      }

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty < 0) {
        setError("Please enter a valid quantity.");
        return;
      }

      setIsLoading(true);
      const response = await addOrUpdateStock(
        product.id,
        selectedBranch,
        qty,
        rate ? parseFloat(rate) : null,
        mrp ? parseFloat(mrp) : null
      );
      setIsLoading(false);

      if (response.success) {
        setSuccess("Stock updated successfully.");
        // Reset form
        setSelectedBranch("");
        setSelectedProduct("");
        setSearchProduct(""); // Clear search input
        setQuantity("");
        setRate("");
        setMrp("");
        setProductSuggestions([]); // Clear suggestions
        setShowSuggestions(false); // Hide suggestions
        // Refresh stock data
        refreshStockData();
      } else {
        setError(response.error);
      }
    },
    [
      selectedBranch,
      selectedProduct,
      quantity,
      rate,
      mrp,
      products,
      addOrUpdateStock,
      refreshStockData,
    ]
  );

  

  const handleSuggestionClick = useCallback(
    (product) => {
      setSelectedProduct(product.id); // Set product ID
      setSearchProduct(product.product_name); // Set only the product name
      setShowSuggestions(false); // Hide suggestions
    },
    []
  );

  // Handler for bulk upload
  const handleBulkUpload = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      setSuccess("");

      if (!file || !selectedBranch) {
        setError("Please select a branch and upload a file.");
        return;
      }

      // Validate file type based on uploadFormat
      const allowedExtensions = uploadFormat === "csv" ? ["csv"] : ["xml"];
      const fileExtension = file.name.split(".").pop().toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        setError(
          `Invalid file format. Please upload a ${
            uploadFormat === "csv" ? "CSV" : "XML"
          } file.`
        );
        return;
      }

      setIsLoading(true);
      isUploadingRef.current = true; // Indicate that upload is in progress

      const response = await bulkUploadStock(file, uploadFormat, selectedBranch);

      isUploadingRef.current = false; // Reset the flag
      setIsLoading(false);

      if (response.success) {
        let message = "Bulk stock upload successful.";

        if (response.insertedProducts && response.insertedProducts.length > 0) {
          message += `\nInserted ${response.insertedProducts.length} new product(s).`;
        }

        setSuccess(message);
        setFile(null);
        setUploadFormat("csv");
        if (fileInputRef.current) fileInputRef.current.value = "";
        // Refresh stock data
        refreshStockData();
      } else {
        setError(response.error);
      }
    },
    [file, selectedBranch, uploadFormat, bulkUploadStock, refreshStockData]
  );

  // Handler for file selection
  const handleFileChange = useCallback((e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
    } else {
      setFile(null);
    }
  }, []);

  return (
    <div
      className={`transition-all duration-300 ${
        isCollapsed ? "mx-20" : "mx-20 px-20"
      } justify-center my-20 p-8 rounded-xl mx-auto max-w-4xl bg-green-50 shadow-inner`}
    >
      <h1 className="text-2xl font-semibold mb-6 text-center">
        Stock Management
      </h1>

      {/* Display Error and Success Messages */}
      {error && (
        <div className="flex items-center text-red-500 mb-4 whitespace-pre-line">
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
        <div className="flex items-center text-green-500 mb-4 whitespace-pre-line">
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

      {/* Manual Stock Addition Form */}
      <form onSubmit={handleAddStock} className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          Add or Update Stock Manually
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Branch Selection */}
          <div>
            <label htmlFor="branch" className="block mb-2 font-medium">
              Select Branch
            </label>
            <select
              id="branch"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="" disabled>
                Select Branch
              </option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Selection */}
          <div className="relative">
            <label htmlFor="productSearch" className="block mb-2 font-medium">
              Search Product
            </label>
            <input
              id="productSearch"
              type="text"
              value={searchProduct}
              onChange={handleSearchInput}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
              placeholder="Type product name or ID"
              className="w-full p-2 border rounded"
            />

            {/* Suggestion Dropdown */}
            {showSuggestions && productSuggestions.length > 0 && (
              <ul className="absolute z-10 border rounded bg-white shadow-md max-h-40 overflow-y-auto w-full">
                {productSuggestions.map((product) => (
                  <li
                    key={product.id}
                    onClick={() => handleSuggestionClick(product)}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {product.product_name} ({product.product_id})
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quantity Input */}
          <div>
            <label htmlFor="quantity" className="block mb-2 font-medium">
              Quantity
            </label>
            <input
              type="number"
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              required
            />
          </div>

          {/* Rate Input (Optional) */}
          <div>
            <label htmlFor="rate" className="block mb-2 font-medium">
              Rate (Optional)
            </label>
            <input
              type="number"
              id="rate"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
            />
          </div>

          {/* MRP Input (Optional) */}
          <div>
            <label htmlFor="mrp" className="block mb-2 font-medium">
              MRP (Optional)
            </label>
            <input
              type="number"
              id="mrp"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
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
          {isLoading ? "Updating..." : "Add/Update Stock"}
        </button>
      </form>

      {/* Bulk Stock Upload Form */}
      <form onSubmit={handleBulkUpload} className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Bulk Stock Upload</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Branch Selection */}
          <div>
            <label htmlFor="bulkBranch" className="block mb-2 font-medium">
              Select Branch
            </label>
            <select
              id="bulkBranch"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="" disabled>
                Select Branch
              </option>
              {branches.map((branch) => (
                <option key={branch.branch_code} value={branch.branch_code}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </div>

          {/* File Format Selection */}
          <div>
            <label htmlFor="format" className="block mb-2 font-medium">
              File Format
            </label>
            <select
              id="format"
              value={uploadFormat}
              onChange={(e) => setUploadFormat(e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="csv">CSV</option>
              <option value="xml">XML</option>
            </select>
          </div>

          {/* File Input */}
          <div>
            <label htmlFor="file" className="block mb-2 font-medium">
              Upload File
            </label>
            <input
              type="file"
              id="file"
              accept={uploadFormat === "csv" ? ".csv" : ".xml"}
              onChange={handleFileChange}
              className="w-full p-2 border rounded"
              required
              ref={fileInputRef}
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
          {isLoading ? "Uploading... Please wait" : "Upload Stock"}
        </button>
      </form>

      {/* Current Stock Section */}
      {selectedBranch && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">
            Current Stock for{" "}
            {branches.find((b) => b.branch_code === selectedBranch)
              ?.branch_name || "Selected Branch"}
          </h2>

          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search by Product ID or Name"
            value={searchProduct}
            onChange={handleSearchInput}
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
                  <th className="py-2 px-4 border-b">Rate</th>
                  <th className="py-2 px-4 border-b">MRP</th>
                  <th className="py-2 px-4 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((stock) => (
                  <tr key={`${stock.product.product_id}-${selectedBranch}`}>
                    <td className="py-2 px-4 border-b text-center">
                      {stock.product.product_id}
                    </td>
                    <td className="py-2 px-4 border-b">
                      {stock.product.product_name}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      {stock.quantity}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      {stock.product.rate !== null
                        ? stock.product.rate.toFixed(2)
                        : "N/A"}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      {stock.product.mrp !== null
                        ? stock.product.mrp.toFixed(2)
                        : "N/A"}
                    </td>
                    <td className="py-2 px-4 border-b text-center">
                      <button
                        onClick={() => openEditModal(stock)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStocks.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-4 text-center">
                      No stock entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {isEditModalOpen && stockToEdit && (
        <EditStockModal
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
          stockEntry={stockToEdit}
          refreshStockData={refreshStockData} // Pass the function
        />
      )}
    </div>
  );
};

export default StockManagement;

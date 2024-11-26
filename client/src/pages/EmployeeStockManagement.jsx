
// client/src/pages/EmployeeStockManagement.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    addOrUpdateStock,
    addNewProduct,
    updateExistingProduct,
} from "../services/authService"; // Updated service functions
import supabase from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { debounce } from "lodash"; // Ensure lodash is installed: npm install lodash

const EmployeeStockManagement = ({ isCollapsed }) => {
    const { user, role, branch } = useAuth(); // Correct destructuring
    const [mode, setMode] = useState("add"); // 'add' or 'update'

    // State for Add New Product
    const [newProductName, setNewProductName] = useState("");
    const [newProductId, setNewProductId] = useState("");
    const [newRate, setNewRate] = useState("");
    const [newMrp, setNewMrp] = useState("");
    const [newQuantity, setNewQuantity] = useState("");
    const [newPurchaseFrom, setNewPurchaseFrom] = useState("");

    // State for Update Existing Product
    const [updateSearchQuery, setUpdateSearchQuery] = useState("");
    const [productSuggestions, setProductSuggestions] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [updateQuantity, setUpdateQuantity] = useState("");
    const [updateRate, setUpdateRate] = useState("");
    const [updateMrp, setUpdateMrp] = useState("");
    const [updatePurchaseFrom, setUpdatePurchaseFrom] = useState("");

    // State for Current Stock Search
    const [stockSearchQuery, setStockSearchQuery] = useState("");

    // Common States
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; // Adjust this number as needed
    const [pageInput, setPageInput] = useState("");

    const isUploadingRef = useRef(false); // To track if an upload is in progress

    // Warn user before unloading the page during upload
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isUploadingRef.current) {
                e.preventDefault();
                e.returnValue = "A stock update is in progress. Are you sure you want to leave?";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    // Debounced fetchProductSuggestions to limit API calls
    const fetchProductSuggestions = useCallback(
        async (query) => {
            try {
                const { data, error } = await supabase
                    .from("products")
                    .select("id, product_name, product_id, rate, mrp, purchase_from")
                    .or(`product_name.ilike.%${query}%,product_id.ilike.%${query}%`) // Combined conditions
                    .limit(20); // Limit to 20 suggestions

                if (error) {
                    console.error("Error fetching suggestions:", error);
                    setProductSuggestions([]);
                    return;
                }

                console.log("Fetched product suggestions:", data);
                setProductSuggestions(data || []); // Update suggestions list
            } catch (err) {
                console.error("Error fetching product suggestions:", err);
            }
        },
        []
    );

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
        setUpdateSearchQuery("");
        setProductSuggestions([]);
        setSelectedProduct(null);
        setUpdateQuantity("");
        setUpdateRate("");
        setUpdateMrp("");
        setUpdatePurchaseFrom("");
        setStockSearchQuery("");
    };

    // Handler for Add New Product Form Submission
    const handleAddNewProduct = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
    
        // Log input values for debugging
        console.log({
            newProductName,
            newProductId,
            newRate,
            newMrp,
            newQuantity,
            newPurchaseFrom,
        });
    
        // Trim string values to avoid validation failures due to extra spaces
        const trimmedProductName = newProductName.trim();
        const trimmedProductId = newProductId.trim();
        const trimmedPurchaseFrom = newPurchaseFrom.trim();
    
        // Validate inputs
        if (
            !trimmedProductName ||
            !trimmedProductId ||
            !newRate ||
            !newMrp ||
            !newQuantity ||
            !trimmedPurchaseFrom
        ) {
            setError("Please fill in all required fields.");
            return;
        }
    
        const quantity = parseInt(newQuantity, 10);
        const rate = parseFloat(newRate);
        const mrp = parseFloat(newMrp);
    
        if (isNaN(quantity) || quantity <= 0) {
            setError("Please enter a valid quantity greater than 0.");
            return;
        }
    
        if (isNaN(rate) || rate <= 0) {
            setError("Please enter a valid rate greater than 0.");
            return;
        }
    
        if (isNaN(mrp) || mrp <= 0) {
            setError("Please enter a valid MRP greater than 0.");
            return;
        }
    
        // Log branch to verify
        console.log("Adding product with branch:", branch);
        if (!branch) {
            setError("Branch is not set. Cannot proceed.");
            return;
        }
    
        setIsLoading(true);
        isUploadingRef.current = true;
    
        try {
            // Add New Product
            const addProductResponse = await addNewProduct({
                product_name: trimmedProductName,
                product_id: trimmedProductId,
                rate,
                mrp,
                hsn_code: "9001", // Default HSN code
                purchase_from: trimmedPurchaseFrom,
            });
    
            if (!addProductResponse.success) {
                setError(addProductResponse.error);
                setIsLoading(false);
                isUploadingRef.current = false;
                return;
            }
    
            console.log("New product added with ID:", addProductResponse.data.id);
    
            // Update Stock for the Branch
            const updateStockResponse = await addOrUpdateStock(
                addProductResponse.data.id,
                branch,
                quantity,
                rate,
                mrp,
                trimmedPurchaseFrom
            );
    
            setIsLoading(false);
            isUploadingRef.current = false;
    
            if (updateStockResponse.success) {
                setSuccess("New product added and stock updated successfully.");
    
                // Reset form
                setNewProductName("");
                setNewProductId("");
                setNewRate("");
                setNewMrp("");
                setNewQuantity("");
                setNewPurchaseFrom("");
            } else {
                setError(updateStockResponse.error);
            }
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

        if (!selectedProduct) {
            setError("No product selected. Please search and select a product to update.");
            return;
          }
        
          const trimmedPurchaseFrom = updatePurchaseFrom.trim();
        
          if (!updateQuantity || !updateRate || !updateMrp || !trimmedPurchaseFrom) {
            setError("Please fill in all required fields.");
            return;
          }

        const quantity = parseInt(updateQuantity, 10);
        const rate = parseFloat(updateRate);
        const mrp = parseFloat(updateMrp);

        if (isNaN(quantity) || quantity <= 0) {
            setError("Please enter a valid quantity greater than 0.");
            return;
        }

        if (isNaN(rate) || rate <= 0) {
            setError("Please enter a valid rate greater than 0.");
            return;
        }

        if (isNaN(mrp) || mrp <= 0) {
            setError("Please enter a valid MRP greater than 0.");
            return;
        }

        // Log branch and selectedProduct to verify
        console.log("Updating product with branch:", branch, "Product ID:", selectedProduct.id);
        if (!branch) {
            setError("Branch is not set. Cannot proceed.");
            return;
        }

        setIsLoading(true);
        isUploadingRef.current = true; // Indicate that an upload is in progress

        try {
            // Update Stock for the Branch
            const updateStockResponse = await updateExistingProduct(
                selectedProduct.id, // Internal product ID
                branch, // Replaced 'branchCode' with 'branch'
                quantity,
                rate,
                mrp,
                trimmedPurchaseFrom // Pass purchase_from if needed
            );

            setIsLoading(false);
            isUploadingRef.current = false;

            if (updateStockResponse.success) {
                setSuccess("Stock updated successfully.");
                // Append the new product to productSuggestions
            setProductSuggestions((prevSuggestions) => [
                ...prevSuggestions,
                {
                    id: selectedProduct.id,
                    product_name: newProductName,
                    product_id: newProductId,
                },
            ]);
                // Reset form
                setUpdateSearchQuery("");
                setProductSuggestions([]);
                setSelectedProduct(null);
                setUpdateQuantity("");
                setUpdateRate("");
                setUpdateMrp("");
                setUpdatePurchaseFrom("");
            } else {
                setError(updateStockResponse.error);
            }
        } catch (error) {
            console.error("Error during update existing product:", error);
            setError("An unexpected error occurred.");
            setIsLoading(false);
            isUploadingRef.current = false;
        }
    };

    // Handler for Update Existing Product Search Input Change
    const handleUpdateSearchInputChange = (e) => {
        const query = e.target.value.trim();
        setUpdateSearchQuery(query);

        if (query.length > 2) {
            debouncedFetchSuggestions(query); // Use the debounced function
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
        setProductSuggestions([]); // Clear suggestions dropdown
    
        // Populate fields with the selected product's details
        setUpdateRate(product.rate !== null ? product.rate.toString() : ""); // Populate rate
        setUpdateMrp(product.mrp !== null ? product.mrp.toString() : "");   // Populate MRP
        setUpdatePurchaseFrom(product.purchase_from || "");                // Populate purchase_from if available
    };


    // Fetch current stock data when component mounts or branch changes
    useEffect(() => {
        const fetchStockData = async () => {
            if (!branch) {
                setFilteredStocks([]);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from("stock")
                    .select(`
                        quantity,
                        product:products(id, product_name, product_id, rate, mrp, purchase_from)
                    `)
                    .eq("branch_code", branch); // Replaced 'branchCode' with 'branch'

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
        };

        fetchStockData();
    }, [branch]);

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
        ); // Sort alphabetically by product name
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

    return (
        <div
            className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
                } justify-center my-20 p-8 rounded-xl mx-auto max-w-4xl bg-green-50 shadow-inner`}
        >
            <h1 className="text-2xl font-semibold mb-6 text-center">
                Product Purchase
            </h1>

            {/* Mode Selection Buttons */}
            <div className="flex justify-center mb-6">
                <button
                    onClick={() => handleModeSelection("add")}
                    className={`mx-2 px-4 py-2 rounded ${mode === "add"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                >
                    Add New Product
                </button>
                <button
                    onClick={() => handleModeSelection("update")}
                    className={`mx-2 px-4 py-2 rounded ${mode === "update"
                            ? "bg-blue-500 text-white"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Purchase From */}
                        <div>
                            <label htmlFor="newPurchaseFrom" className="block mb-2 font-medium">
                                Purchase From
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
                            <label htmlFor="newProductName" className="block mb-2 font-medium">
                                Product Name
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
                                Product ID
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

                        {/* Rate */}
                        <div>
                            <label htmlFor="newRate" className="block mb-2 font-medium">
                                Rate
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
                                MRP
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

                        {/* Purchase From */}
                        


                        {/* Quantity */}
                        <div>
                            <label htmlFor="newQuantity" className="block mb-2 font-medium">
                                Quantity
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
                        className={`mt-4 w-full p-2 text-white rounded ${isLoading
                                ? "bg-blue-500 cursor-not-allowed"
                                : "bg-green-500 hover:bg-green-600"
                            }`}
                        disabled={isLoading}
                    >
                        {isLoading ? "Adding..." : "Add New Product"}
                    </button>
                </form>
            )}

            {/* Update Existing Product Form */}
            {mode === "update" && (
                <form onSubmit={handleUpdateExistingProduct} className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Update Existing Product</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                            <label htmlFor="updatePurchaseFrom" className="block mb-2 font-medium">
                                Purchase From
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

                        {/* Product Search */}
                        <div className="relative md:col-span-2">
                            <label htmlFor="searchProduct" className="block mb-2 font-medium">
                                Search Product ID
                            </label>
                            <input
                                type="text"
                                id="searchProduct"
                                value={updateSearchQuery}
                                onChange={handleUpdateSearchInputChange}
                                onFocus={() => {
                                    if (updateSearchQuery.length > 1) {
                                        debouncedFetchSuggestions(updateSearchQuery);
                                    }
                                }}
                                placeholder="Type product name or ID"
                                className="w-full p-2 border rounded"
                                autoComplete="off"
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

                        {/* Display Selected Product Details */}
                        {selectedProduct && (
                            <>
                                {/* Rate */}
                                <div>
                                    <label htmlFor="updateRate" className="block mb-2 font-medium">
                                        Rate
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
                                        MRP
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
                                    <label htmlFor="updateQuantity" className="block mb-2 font-medium">
                                        Quantity to Add
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
                            </>
                        )}
                    </div>

                    {selectedProduct && (
                        <button
                            type="submit"
                            className={`mt-4 w-full p-2 text-white rounded ${isLoading
                                    ? "bg-blue-500 cursor-not-allowed"
                                    : "bg-green-500 hover:bg-green-600"
                                }`}
                            disabled={isLoading}
                        >
                            {isLoading ? "Updating..." : "Update Stock"}
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
                                    <th className="py-2 px-4 border-b">Rate</th>
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
                                        <td className="py-2 px-4 border-b text-center">
                                            {stock.product.rate !== null
                                                ? parseFloat(stock.product.rate).toFixed(2)
                                                : "N/A"}
                                        </td>
                                        <td className="py-2 px-4 border-b text-center">
                                            {stock.product.mrp !== null
                                                ? parseFloat(stock.product.mrp).toFixed(2)
                                                : "N/A"}
                                        </td>
                                        <td className="py-2 px-4 border-b text-center">
                                            {/* Button to select the product for updating */}
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
        </div>
    );
};

export default EmployeeStockManagement;

// client/src/pages/AddService.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

Modal.setAppElement("#root");

const AddService = ({ isCollapsed }) => {
    const { user, role, branch } = useAuth();
    const { state, dispatch } = useGlobalState();

    const [mode, setMode] = useState("add");
    const [isLoading, setIsLoading] = useState(false);
    const isUploadingRef = useRef(false);
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 10;

    // Define targetBranch based on role
    const targetBranch = role === "admin" ? "G001" : branch;

    // Lookup Branch for Stock Viewing (Admins can select any branch)
    const [lookupBranch, setLookupBranch] = useState(branch);

    // Fetch all branches for Admin's dropdown
    const [branchesList, setBranchesList] = useState([]);

    useEffect(() => {
        const fetchAllBranches = async () => {
            try {
                const { data, error } = await supabase
                    .from("branches")
                    .select("branch_code, branch_name, type")
                    .order("branch_name", { ascending: true });

                if (error) {
                    console.error("Error fetching branches:", error);
                    toast.error("Failed to fetch branches.");
                    setBranchesList([]);
                    return;
                }

                setBranchesList(data || []);
            } catch (err) {
                console.error("Error fetching branches:", err);
                toast.error("An unexpected error occurred while fetching branches.");
                setBranchesList([]);
            }
        };

        if (role === "admin") {
            fetchAllBranches();
        }
    }, [role]);

    // For Add New Products (Multiple)
    const [addProducts, setAddProducts] = useState([{
        productName: "",
        productId: "",
        rate: "",
        mrp: "",
        quantity: "",
        hsnCode: "9003",
        doctorname: "",
        department: ""
    }]);
    const [addBillNumber, setAddBillNumber] = useState("");
    const [addBillDate, setAddBillDate] = useState("");
    const [addEmployeeId, setAddEmployeeId] = useState(null);
    const [addPurchaseFrom, setAddPurchaseFrom] = useState("");

    // For Update Existing Products (Multiple)
    const [updateProducts, setUpdateProducts] = useState([{
        searchQuery: "",
        selectedProduct: null,
        rate: "",
        mrp: "",
        quantity: "",
        hsnCode: "",
    }]);
    const [updateBillNumber, setUpdateBillNumber] = useState("");
    const [updateBillDate, setUpdateBillDate] = useState("");
    const [updateEmployeeId, setUpdateEmployeeId] = useState(null);
    const [updatePurchaseFrom, setUpdatePurchaseFrom] = useState("");

    // Current Stock Search
    const [stockSearchQuery, setStockSearchQuery] = useState("");

    // Employees & Purchase From Lists
    const [employees, setEmployees] = useState([]);
    const [purchaseFromList, setPurchaseFromList] = useState([]);

    // Product Suggestions for Update Mode
    const [productSuggestions, setProductSuggestions] = useState([]);

    // Stock Data
    const [filteredStocks, setFilteredStocks] = useState([]);

    // Warn user before unloading if upload in progress
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

    // Fetch Employees with Role Filtering for Admins
    const fetchEmployees = useCallback(async () => {
        try {
            let query = supabase
                .from("employees")
                .select("id, name")
                .eq("branch", branch)
                .order("name", { ascending: true });

            if (role === "admin") {
                // **Change:** Filter to show only admin employees if user is admin
                query = query.eq("role", "admin");
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching employees:", error);
                toast.error("Failed to fetch employees.");
                setEmployees([]);
                return;
            }
            setEmployees(data || []);
        } catch (err) {
            console.error("Error fetching employees:", err);
            toast.error("An unexpected error occurred while fetching employees.");
            setEmployees([]);
        }
    }, [branch, role]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // Fetch unique purchase_from values
    const fetchPurchaseFromOptions = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("products")
                .select("purchase_from", { distinct: true });

            if (error) {
                console.error("Error fetching purchase_from options:", error);
                return;
            }

            // Ensure unique values by using a Set
            const uniquePlaces = Array.from(
                new Set((data || []).map(d => d.purchase_from).filter(Boolean))
            );
            setPurchaseFromList(uniquePlaces);
        } catch (err) {
            console.error("Error fetching purchase_from options:", err);
        }
    }, []);

    useEffect(() => {
        fetchPurchaseFromOptions();
    }, [fetchPurchaseFromOptions]);

    // Debounced product suggestions
    const debouncedFetchSuggestions = useRef(
        debounce(async (query) => {
            if (query.length < 3) {
                setProductSuggestions([]);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from("products")
                    .select("id, product_name, product_id, rate, mrp, purchase_from, hsn_code")
                    .or(`product_name.ilike.%${query}%,product_id.ilike.%${query}%`)
                    .limit(20);

                if (error) throw error;
                setProductSuggestions(data || []);
            } catch (err) {
                console.error("Error fetching product suggestions:", err);
                toast.error("Failed to fetch product suggestions.");
            }
        }, 300)
    ).current;

    useEffect(() => {
        return () => {
            debouncedFetchSuggestions.cancel();
        };
    }, []);

    // Mode change handler
    const handleModeSelection = (selectedMode) => {
        setMode(selectedMode);
        // Reset Add mode states
        setAddProducts([{
            productName: "",
            productId: "",
            rate: "",
            mrp: "",
            quantity: "",
            hsnCode: "9003",
        }]);
        setAddBillNumber("");
        setAddBillDate("");
        setAddEmployeeId(null);
        setAddPurchaseFrom("");

        // Reset Update mode states
        setUpdateProducts([{
            searchQuery: "",
            selectedProduct: null,
            rate: "",
            mrp: "",
            quantity: "",
            hsnCode: "",
        }]);
        setUpdateBillNumber("");
        setUpdateBillDate("");
        setUpdateEmployeeId(null);
        setUpdatePurchaseFrom("");

        setStockSearchQuery("");
        toast.dismiss();
    };

    // Generate Bill Number based on targetBranch
    const generateBillNumber = useCallback(async () => {
        if (!targetBranch) return "BILL-0001";
        try {
            const { data, error } = await supabase
                .from("purchases")
                .select("bill_number")
                .eq("branch_code", targetBranch)
                .order("created_at", { ascending: false })
                .limit(1);

            if (error) {
                console.error("Error fetching last bill number:", error);
                toast.error("Failed to generate bill number.");
                return "BILL-0001";
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
            toast.error("An unexpected error occurred while generating bill number.");
            return "BILL-0001";
        }
    }, [targetBranch]);

    useEffect(() => {
        const setupBillDetails = async () => {
            const billNumber = await generateBillNumber();
            const currentDate = new Date().toISOString().split("T")[0];

            if (mode === "add") {
                setAddBillNumber(billNumber);
                setAddBillDate(currentDate);
            } else if (mode === "update") {
                setUpdateBillNumber(billNumber);
                setUpdateBillDate(currentDate);
            }
        };
        if (targetBranch) {
            setupBillDetails();
        }
    }, [targetBranch, mode, generateBillNumber]);

    // Add another product entry for Add mode
    const handleAddProductEntry = () => {
        setAddProducts([...addProducts, {
            productName: "",
            productId: "",
            rate: "",
            mrp: "",
            quantity: "",
            hsnCode: "9003",
        }]);
    };

    const handleRemoveAddProductEntry = (index) => {
        const updated = [...addProducts];
        updated.splice(index, 1);
        setAddProducts(updated);
    };

    // Add another product entry for Update mode
    const handleAddUpdateProductEntry = () => {
        setUpdateProducts([...updateProducts, {
            searchQuery: "",
            selectedProduct: null,
            rate: "",
            mrp: "",
            quantity: "",
            hsnCode: "",
        }]);
    };

    const handleRemoveUpdateProductEntry = (index) => {
        const updated = [...updateProducts];
        updated.splice(index, 1);
        setUpdateProducts(updated);
    };

    // Handle Add New Products Submission
    const handleAddNewProducts = async (e) => {
        e.preventDefault();
        // if (!addBillNumber || !addBillDate || !addEmployeeId || !addPurchaseFrom.trim()) {
        //     toast.error("Please fill Bill Number, Bill Date, Employee and Purchase From.");
        //     return;
        // }

        for (let i = 0; i < addProducts.length; i++) {
            const p = addProducts[i];
            const missingFields = [];
            if (!p.productName.trim()) missingFields.push(`Product Name (#${i + 1})`);
            if (!p.productId.trim()) missingFields.push(`Product ID (#${i + 1})`);
            // if (!p.rate) missingFields.push(`Rate (#${i + 1})`);
            // if (!p.mrp) missingFields.push(`MRP (#${i + 1})`);
            // if (!p.quantity) missingFields.push(`Quantity (#${i + 1})`);
            if (!p.doctorname.trim()) missingFields.push(`Doctor Name (#${i + 1})`);
            if (!p.department.trim()) missingFields.push(`Department (#${i + 1})`);

            if (missingFields.length > 0) {
                toast.error(`Please fill: ${missingFields.join(", ")}`);
                return;
            }

            const q = parseInt(p.quantity, 10), r = parseFloat(p.rate), m = parseFloat(p.mrp);

            // if (p.rate && (isNaN(parseFloat(p.rate)) || parseFloat(p.rate) < 0)) {
            //     toast.error(`Invalid rate for service #${i + 1}`);
            //     return;
            // }
            // if (isNaN(m) || m <= 0) {
            //     toast.error(`Invalid MRP for product #${i + 1}`);
            //     return;
            // }
        }

        if (!targetBranch) {
            toast.error("Branch not set");
            return;
        }

        setIsLoading(true);
        isUploadingRef.current = true;

        try {
            const employeeName = employees.find(emp => emp.id === addEmployeeId)?.name || "Unknown";
            const previewData = {
                mode: "Add New Products",
                bill_date: addBillDate,
                bill_number: addBillNumber,
                employee: employeeName,
                employee_id: addEmployeeId,
                products: addProducts.map(p => ({
                    product_name: p.productName.trim(),
                    product_id: p.productId.trim(),
                    rate: parseFloat(p.rate),
                    mrp: parseFloat(p.mrp),
                    hsn_code: p.hsnCode.trim(),
                    quantity: parseInt(p.quantity, 10),
                    purchase_from: addPurchaseFrom.trim(),
                    doctorname: p.doctorname.trim(),    // New field
                    department: p.department.trim()      // New field
                })),
            };

            dispatch({
                type: "SET_PURCHASE_MODAL",
                payload: {
                    action: "add",
                    content: previewData,
                    showModal: true,
                },
            });
        } catch (err) {
            console.error("Error preparing add new products:", err);
            toast.error("An unexpected error occurred.");
            setIsLoading(false);
            isUploadingRef.current = false;
        }
    };

    // Handle Update Existing Products Submission
    const handleUpdateExistingProducts = async (e) => {
        e.preventDefault();
        if (!updateBillNumber || !updateBillDate || !updateEmployeeId || !updatePurchaseFrom.trim()) {
            toast.error("Please fill Bill Number, Bill Date, Employee and Purchase From.");
            return;
        }

        for (let i = 0; i < updateProducts.length; i++) {
            const p = updateProducts[i];
            const missingFields = [];
            if (!p.searchQuery) missingFields.push(`Product Search (#${i + 1})`);
            if (!p.quantity) missingFields.push(`Quantity (#${i + 1})`);
            if (!p.rate) missingFields.push(`Rate (#${i + 1})`);
            if (!p.mrp) missingFields.push(`MRP (#${i + 1})`);
            if (!p.selectedProduct) {
                toast.error(`No product selected for #${i + 1}`);
                return;
            }

            if (missingFields.length > 0) {
                toast.error(`Please fill: ${missingFields.join(", ")}`);
                return;
            }

            const q = parseInt(p.quantity, 10), r = parseFloat(p.rate), m = parseFloat(p.mrp);
            if (isNaN(q) || q <= 0) {
                toast.error(`Invalid quantity for product #${i + 1}`);
                return;
            }
            if (isNaN(r) || r <= 0) {
                toast.error(`Invalid rate for product #${i + 1}`);
                return;
            }
            if (isNaN(m) || m <= 0) {
                toast.error(`Invalid MRP for product #${i + 1}`);
                return;
            }
        }

        if (!targetBranch) {
            toast.error("Branch not set");
            return;
        }

        setIsLoading(true);
        isUploadingRef.current = true;

        try {
            const employeeName = employees.find(emp => emp.id === updateEmployeeId)?.name || "Unknown";
            const previewData = {
                mode: "Update Existing Products",
                bill_date: updateBillDate,
                bill_number: updateBillNumber,
                employee: employeeName,
                employee_id: updateEmployeeId,
                products: updateProducts.map(p => ({
                    product_name: p.selectedProduct.product_name,
                    product_id: p.selectedProduct.product_id,
                    product_id_db: p.selectedProduct.id,
                    rate: parseFloat(p.rate),
                    mrp: parseFloat(p.mrp),
                    hsn_code: p.hsnCode.trim(),
                    quantity: parseInt(p.quantity, 10),
                    purchase_from: updatePurchaseFrom.trim(),
                })),
            };

            dispatch({
                type: "SET_PURCHASE_MODAL",
                payload: {
                    action: "update",
                    content: previewData,
                    showModal: true,
                },
            });
        } catch (err) {
            console.error("Error preparing update existing products:", err);
            toast.error("An unexpected error occurred.");
            setIsLoading(false);
            isUploadingRef.current = false;
        }
    };


    const resetServiceId = (index) => {
        const updatedProducts = [...addProducts];
        updatedProducts[index].productId = '';
        setAddProducts(updatedProducts);
    };

    const processAddNewProducts = async () => {
        const previewData = state.purchaseModal.content;
        if (!previewData) {
            toast.error("No purchase data to process.");
            setIsLoading(false);
            isUploadingRef.current = false;
            return;
        }

        const { products, bill_number, bill_date, employee_id, employee } = previewData;

        try {
            for (let p of products) {
                const resAdd = await addNewProduct({
                    product_name: p.product_name,
                    product_id: p.product_id,
                    rate: p.rate,
                    mrp: p.mrp,
                    hsn_code: p.hsn_code,
                    purchase_from: p.purchase_from,
                    doctorname: p.doctorname,
                    department: p.department
                });

                if (!resAdd.success) {
                    if (resAdd.isExistingProduct) {

                        toast.error(`Service ID ${p.product_id} already exists. Press OK to continue.`, {
                            autoClose: false,
                            closeButton: true,
                            closeOnClick: false,
                            onClose: () => resetServiceId(products.indexOf(p))
                        });
                        return;
                    }
                    toast.error(resAdd.error);
                    return;
                }

                // const resStock = await addOrUpdateStock(
                //     resAdd.data.product_id,
                //     targetBranch, // Use targetBranch (G001 for admin)
                //     p.quantity,
                //     p.rate,
                //     p.mrp
                // );
                // if (!resStock.success) {
                //     toast.error(`Failed to update stock for ${p.product_id}: ${resStock.error}`);
                //     continue;
                // }

                // const resPurchase = await addPurchase({
                //     product_id: resAdd.data.id,
                //     branch_code: targetBranch, // Use targetBranch (G001 for admin)
                //     quantity: p.quantity || 1,
                //     rate: p.rate,
                //     mrp: p.mrp,
                //     purchase_from: p.purchase_from,
                //     bill_number,
                //     bill_date,
                //     employee_id,
                //     employee_name: employee,
                // });

                // if (!resPurchase.success) {
                //     toast.error(`Failed to record purchase for ${p.product_id}: ${resPurchase.error}`);
                //     continue;
                // }

                setTimeout(() => {
                    toast.success(`Service ${p.product_id} added successfully.`);
                }, 500);
            }

            handleModeSelection("add");
            await fetchPurchaseFromOptions();
            fetchStockData();
        } catch (err) {
            console.error("Error processing add new products:", err);

            toast.error("An unexpected error occurred.", {
                autoClose: false,  // Won't auto close
                closeButton: true
            });
            resetFormFields();

        }
        finally {
            resetFormFields();
            dispatch({ type: "RESET_PURCHASE_MODAL" });
            setIsLoading(false);
            isUploadingRef.current = false;

        }
    };

    const processUpdateExistingProducts = async () => {
        const previewData = state.purchaseModal.content;
        if (!previewData) {
            toast.error("No purchase data to process.");
            setIsLoading(false);
            isUploadingRef.current = false;
            return;
        }

        const { products, bill_number, bill_date, employee_id, employee } = previewData;
        try {
            for (let p of products) {
                const resUpdate = await updateExistingProduct(
                    p.product_id_db,
                    targetBranch, // Use targetBranch (G001 for admin)
                    p.quantity,
                    p.rate,
                    p.mrp,
                    p.purchase_from,
                    p.hsn_code
                );

                if (!resUpdate.success) {
                    toast.error(`Failed to update ${p.product_id}: ${resUpdate.error}`);
                    continue;
                }

                const resPurchase = await addPurchase({
                    product_id: p.product_id_db,
                    branch_code: targetBranch, // Use targetBranch (G001 for admin)
                    quantity: p.quantity,
                    rate: p.rate,
                    mrp: p.mrp,
                    purchase_from: p.purchase_from,
                    bill_number,
                    bill_date,
                    employee_id,
                    employee_name: employee,
                });

                if (!resPurchase.success) {
                    toast.error(`Failed to record purchase for ${p.product_id}: ${resPurchase.error}`);
                    continue;
                }

                toast.success(`Service ${p.product_id} updated successfully.`);
            }

            handleModeSelection("update");
            await fetchPurchaseFromOptions();
            fetchStockData();
        } catch (err) {
            console.error("Error processing update existing products:", err);
            toast.error("An unexpected error occurred.");
        } finally {
            dispatch({ type: "RESET_PURCHASE_MODAL" });
            setIsLoading(false);
            isUploadingRef.current = false;
        }
    };

    const resetFormFields = () => {
        setAddProducts([{
            productName: "",
            productId: "",
            rate: "",
            mrp: "",
            hsnCode: "9003",
            doctorname: "",
            department: ""
        }]);
    };

    const handleConfirmModal = () => {
        if (state.purchaseModal.action === "add") {
            processAddNewProducts();
        } else if (state.purchaseModal.action === "update") {
            processUpdateExistingProducts();
        }
    };

    const handleCancelModal = () => {
        dispatch({ type: "RESET_PURCHASE_MODAL" });
        setIsLoading(false);
        isUploadingRef.current = false;
        toast.dismiss();
    };

    const handleUpdateSearchInputChange = (e, index = 0) => {
        const query = e.target.value.trim();
        const updated = [...updateProducts];
        updated[index].searchQuery = query;
        setUpdateProducts(updated);

        if (query.length > 2) {
            debouncedFetchSuggestions(query);
        } else {
            setProductSuggestions([]);
            updated[index].selectedProduct = null;
            setUpdateProducts(updated);
        }
    };

    const handleSelectProduct = (product, index = null) => {
        if (mode === "update") {
            const updated = [...updateProducts];
            const i = index !== null ? index : 0;
            updated[i].selectedProduct = product;
            updated[i].searchQuery = `${product.product_name} (${product.product_id})`;
            updated[i].rate = product.rate !== null ? product.rate.toString() : "";
            updated[i].mrp = product.mrp !== null ? product.mrp.toString() : "";
            updated[i].hsnCode = product.hsn_code || "";
            setUpdateProducts(updated);
            setProductSuggestions([]);
        }
    };

    const allFilteredStocks = useMemo(() => {
        return filteredStocks
            .filter((stock) => {
                const searchTerm = stockSearchQuery.toLowerCase();
                return (
                    stock.product.product_name.toLowerCase().includes(searchTerm) ||
                    stock.product.product_id.toLowerCase().includes(searchTerm)
                );
            })
            .sort((a, b) => a.product.product_name.localeCompare(b.product.product_name));
    }, [filteredStocks, stockSearchQuery]);

    const totalPages = Math.ceil(allFilteredStocks.length / itemsPerPage);
    const displayedStocks = useMemo(() => {
        return allFilteredStocks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [allFilteredStocks, currentPage, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [stockSearchQuery, allFilteredStocks]);

    const handleStockSearchInputChange = (e) => {
        setStockSearchQuery(e.target.value);
    };

    const fetchStockData = useCallback(async () => {
        if (!lookupBranch) {
            setFilteredStocks([]);
            return;
        }

        try {
            const { data, error } = await supabase
                .from("stock")
                .select(
                    `quantity,
           product:products(id, product_name, product_id, rate, mrp, purchase_from, hsn_code)`
                )
                .eq("branch_code", lookupBranch);

            if (error) {
                console.error("Error fetching stock data:", error);
                toast.error("Failed to fetch stock data.");
                return;
            }

            setFilteredStocks(data || []);
        } catch (err) {
            console.error("Error fetching stock data:", err);
            toast.error("An unexpected error occurred while fetching stock data.");
        }
    }, [lookupBranch]);

    useEffect(() => {
        fetchStockData();
    }, [fetchStockData]);

    return (
        <div
            className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
                } justify-center my-20 p-8 rounded-xl mx-auto max-w-4xl bg-blue-50 shadow-inner`}
        >
            <ToastContainer
                position="top-right"
                autoClose={8000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
            />

            <h1 className="text-2xl font-semibold mb-6 text-center">
                Add Service
            </h1>

            {/* Mode Selection Buttons */}
            <div className="flex justify-center mb-6 text-lg font-semibold">
                <button
                    onClick={() => handleModeSelection("add")}
                    className={`mx-2 px-4 py-2 rounded ${mode === "add"
                        ? "bg-blue-500 text-white shadow-2xl"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                >
                    Add New Services
                </button>
                {/* <button
          onClick={() => handleModeSelection("update")}
          className={`mx-2 px-4 py-2 rounded ${
            mode === "update"
              ? "bg-blue-500 text-white shadow-2xl"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Update Existing Products
        </button> */}
            </div>

            {mode === "add" && (
                <form onSubmit={handleAddNewProducts} className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Add New Service</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label htmlFor="addBillDate" className="block mb-2 font-medium">
                                Bill Date<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                id="addBillDate"
                                value={addBillDate}
                                onChange={(e) => setAddBillDate(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            />
                        </div>


                        <div>
                            <label htmlFor="addEmployee" className="block mb-2 font-medium">
                                Employee<span className="text-red-500">*</span>
                            </label>
                            <select
                                id="addEmployee"
                                value={addEmployeeId || ""}
                                onChange={(e) => setAddEmployeeId(parseInt(e.target.value, 10))}
                                className="w-full p-2 border rounded"
                                required
                            >
                                <option value="" disabled>Select Employee</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block mb-2 font-medium">
                                Purchase From<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                list="purchaseFromList"
                                value={addPurchaseFrom}
                                onChange={(e) => setAddPurchaseFrom(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            />
                            <datalist id="purchaseFromList">
                                {purchaseFromList.map((pf, idx) => (
                                    <option key={idx} value={pf} />
                                ))}
                            </datalist>
                        </div>
                    </div> */}

                    {addProducts.map((prod, i) => (
                        <div key={i} className="border p-4 mb-4 rounded-lg bg-white relative">
                            {addProducts.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveAddProductEntry(i)}
                                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                    title="Remove Product"
                                >
                                    &times;
                                </button>
                            )}
                            <h3 className="text-lg font-medium mb-2">   Service {i + 1}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block mb-2 font-medium">
                                        Service Name<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={prod.productName}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].productName = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block mb-2 font-medium">
                                        Service ID<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={prod.productId}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].productId = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block mb-2 font-medium">
                                        HSN Code<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={prod.hsnCode}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].hsnCode = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                </div>


                                <div>
                                    <label className="block mb-2 font-medium">
                                        Rate<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={prod.mrp}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].mrp = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                        min="0.01" step="0.01"
                                        required
                                    />
                                </div>
                            </div>



                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block mb-2 font-medium">
                                        Doctor Name<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={prod.doctorname}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].doctorname = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block mb-2 font-medium">
                                        Department<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={prod.department}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].department = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                </div>
                            </div>

                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={handleAddProductEntry}
                        className="mb-4 text-blue-500 hover:underline"
                    >
                        + Add Another Service
                    </button>

                    <button
                        type="submit"
                        className={`mt-4 w-full p-2 text-white rounded ${isLoading
                            ? "bg-blue-500 cursor-not-allowed flex items-center justify-center"
                            : "bg-blue-500 hover:bg-blue-600"
                            }`}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <svg
                                    className="animate-spin h-5 w-5 mr-3 border-t-2 border-b-2 border-white rounded-full"
                                    viewBox="0 0 24 24"
                                ></svg>
                                Preparing...
                            </>
                        ) : (
                            "Add New Services"
                        )}
                    </button>
                </form>
            )}

            {mode === "update" && (
                <form onSubmit={handleUpdateExistingProducts} className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">
                        Update Existing Service
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block mb-2 font-medium">
                                Bill Date<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={updateBillDate}
                                onChange={(e) => setUpdateBillDate(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            />
                        </div>



                        <div>
                            <label className="block mb-2 font-medium">
                                Employee<span className="text-red-500">*</span>
                            </label>
                            <select
                                value={updateEmployeeId || ""}
                                onChange={(e) => setUpdateEmployeeId(parseInt(e.target.value, 10))}
                                className="w-full p-2 border rounded"
                                required
                            >
                                <option value="" disabled>Select Employee</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block mb-2 font-medium">
                                Purchase From<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                list="purchaseFromList"
                                value={updatePurchaseFrom}
                                onChange={(e) => setUpdatePurchaseFrom(e.target.value)}
                                className="w-full p-2 border rounded"
                                required
                            />
                            <datalist id="purchaseFromList">
                                {purchaseFromList.map((pf, idx) => (
                                    <option key={idx} value={pf} />
                                ))}
                            </datalist>
                        </div>
                    </div>

                    {updateProducts.map((prod, i) => (
                        <div key={i} className="border p-4 mb-4 rounded-lg bg-white relative">
                            {updateProducts.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveUpdateProductEntry(i)}
                                    className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                                    title="Remove Product"
                                >
                                    &times;
                                </button>
                            )}
                            <h3 className="text-lg font-medium mb-2">Service {i + 1}</h3>
                            <div className="md:col-span-3 mb-4">
                                <label className="block mb-2 font-medium">
                                    Search Service by Name or ID<span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={prod.searchQuery}
                                    onChange={(e) => handleUpdateSearchInputChange(e, i)}
                                    onFocus={() => {
                                        if (prod.searchQuery.length > 2) {
                                            debouncedFetchSuggestions(prod.searchQuery);
                                        }
                                    }}
                                    placeholder="Type product name or ID"
                                    className="w-full p-2 border rounded"
                                    autoComplete="off"
                                    required
                                />

                                {productSuggestions.length > 0 && (
                                    <ul className="absolute z-10 border rounded bg-white shadow-md max-h-60 overflow-y-auto w-[calc(100%-1rem)] mt-1">
                                        {productSuggestions.map((pSuggest) => (
                                            <li
                                                key={pSuggest.id}
                                                onClick={() => handleSelectProduct(pSuggest, i)}
                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                            >
                                                {pSuggest.product_name} ({pSuggest.product_id})
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {prod.selectedProduct && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-2 font-medium">Service Name</label>
                                            <input
                                                type="text"
                                                value={prod.selectedProduct.product_name}
                                                readOnly
                                                className="w-full p-2 border rounded bg-gray-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="block mb-2 font-medium">Service ID</label>
                                            <input
                                                type="text"
                                                value={prod.selectedProduct.product_id}
                                                readOnly
                                                className="w-full p-2 border rounded bg-gray-100"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-2 font-medium">
                                                HSN Code<span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={prod.hsnCode}
                                                onChange={(e) => {
                                                    const updated = [...updateProducts];
                                                    updated[i].hsnCode = e.target.value;
                                                    setUpdateProducts(updated);
                                                }}
                                                className="w-full p-2 border rounded"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block mb-2 font-medium">
                                                Party Rate<span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={prod.rate}
                                                onChange={(e) => {
                                                    const updated = [...updateProducts];
                                                    updated[i].rate = e.target.value;
                                                    setUpdateProducts(updated);
                                                }}
                                                className="w-full p-2 border rounded"
                                                min="0.01" step="0.01"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block mb-2 font-medium">
                                                MRP<span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={prod.mrp}
                                                onChange={(e) => {
                                                    const updated = [...updateProducts];
                                                    updated[i].mrp = e.target.value;
                                                    setUpdateProducts(updated);
                                                }}
                                                className="w-full p-2 border rounded"
                                                min="0.01" step="0.01"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-2 font-medium">
                                                Quantity to Add<span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={prod.quantity}
                                                onChange={(e) => {
                                                    const updated = [...updateProducts];
                                                    updated[i].quantity = e.target.value;
                                                    setUpdateProducts(updated);
                                                }}
                                                className="w-full p-2 border rounded"
                                                min="1"
                                                required
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={handleAddUpdateProductEntry}
                        className="mb-4 text-blue-500 hover:underline"
                    >
                        + Add Another Service
                    </button>

                    <button
                        type="submit"
                        className={`mt-4 w-full p-2 text-white rounded ${isLoading
                            ? "bg-blue-500 cursor-not-allowed flex items-center justify-center"
                            : "bg-blue-500 hover:bg-blue-600"
                            }`}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <svg
                                    className="animate-spin h-5 w-5 mr-3 border-t-2 border-b-2 border-white rounded-full"
                                    viewBox="0 0 24 24"
                                ></svg>
                                Preparing...
                            </>
                        ) : (
                            "Update Services"
                        )}
                    </button>
                </form>
            )}

            {role === "admin" && (
                <div className="mt-8">
                    {/* Branch Selection Dropdown for Admin */}
                    <div className="mb-4 relative">
                        <label htmlFor="lookupBranch" className="block mb-2 font-medium">
                            Select Branch to View Stock
                        </label>
                        <select
                            id="lookupBranch"
                            value={lookupBranch}
                            onChange={(e) => setLookupBranch(e.target.value)}
                            className="w-full p-2 border rounded"
                        >
                            <option value="" disabled>Select Branch</option>
                            {branchesList.map((b) => (
                                <option key={b.branch_code} value={b.branch_code}>
                                    {b.branch_name} {b.type === "godown" ? "(Godown)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {role !== "admin" && branch && (
                <div className="mt-8">
                    {/* Optionally, you can add content here for non-admin roles */}
                </div>
            )}

            {/* Stock Search and Table */}
            <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">
                    Current Stock for Branch: {role === "admin" ? lookupBranch : branch}
                </h2>

                {/* Stock Search Input */}
                <input
                    type="text"
                    placeholder="Search by Service ID or Name"
                    value={stockSearchQuery}
                    onChange={handleStockSearchInputChange}
                    className="w-full p-2 border rounded mb-4"
                />

                {/* Stock Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead>
                            <tr>
                                <th className="py-2 px-4 border-b">Service ID</th>
                                <th className="py-2 px-4 border-b">Service Name</th>
                                {role !== "employee" && <th className="py-2 px-4 border-b">Party Rate</th>}
                                <th className="py-2 px-4 border-b">MRP</th>
                                <th className="py-2 px-4 border-b">HSN Code</th>
                                <th className="py-2 px-4 border-b">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedStocks.map((stock) => (
                                <tr key={stock.product.product_id}>
                                    <td className="py-2 px-4 border-b text-center">{stock.product.product_id}</td>
                                    <td className="py-2 px-4 border-b">{stock.product.product_name}</td>
                                    {role !== "employee" && (
                                        <td className="py-2 px-4 border-b text-center">
                                            {stock.product.rate !== null ? parseFloat(stock.product.rate).toFixed(2) : "N/A"}
                                        </td>
                                    )}
                                    <td className="py-2 px-4 border-b text-center">
                                        {stock.product.mrp !== null ? parseFloat(stock.product.mrp).toFixed(2) : "N/A"}
                                    </td>
                                    <td className="py-2 px-4 border-b text-center">{stock.product.hsn_code || "N/A"}</td>
                                    <td className="py-2 px-4 border-b text-center">
                                        <button
                                            onClick={() => {
                                                if (mode === "update") {
                                                    const product = stock.product;
                                                    const updated = [...updateProducts];

                                                    updated[0].selectedProduct = {
                                                        id: product.id,
                                                        product_name: product.product_name,
                                                        product_id: product.product_id,
                                                        rate: product.rate,
                                                        mrp: product.mrp,
                                                        purchase_from: product.purchase_from,
                                                        hsn_code: product.hsn_code
                                                    };

                                                    updated[0].searchQuery = `${product.product_name} (${product.product_id})`;
                                                    updated[0].rate = product.rate !== null ? product.rate.toString() : "";
                                                    updated[0].mrp = product.mrp !== null ? product.mrp.toString() : "";
                                                    updated[0].hsnCode = product.hsn_code || "";

                                                    setUpdateProducts(updated);
                                                    toast.success(`${product.product_name} selected for update.`);
                                                } else {
                                                    toast.info("Select button action is only meaningful in update mode.");
                                                }
                                            }}
                                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                                        >
                                            Select
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {displayedStocks.length === 0 && (
                                <tr>
                                    <td colSpan={role !== "employee" ? "7" : "6"} className="py-4 text-center">
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
                            className={`px-3 py-1 rounded ${currentPage === 1
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-blue-500 text-white hover:bg-blue-600"
                                }`}
                        >
                            Previous
                        </button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1 rounded ${currentPage === totalPages
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-blue-500 text-white hover:bg-blue-600"
                                }`}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Purchase Modal */}
            <Modal
                isOpen={state.modals.showPurchaseModal}
                onRequestClose={handleCancelModal}
                contentLabel="Preview Purchase"
                className="max-w-4xl mx-auto mt-20 bg-white p-6 rounded shadow-lg outline-none max-h-screen overflow-auto"
                overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
            >
                {state.purchaseModal.content && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">
                            Preview {state.purchaseModal.content.mode}
                        </h2>

                        {state.purchaseModal.content.mode.includes("Products") ? (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><span className="font-medium">Bill Date:</span></div>
                                    <div>{state.purchaseModal.content.bill_date}</div>

                                    <div><span className="font-medium">Bill Number:</span></div>
                                    <div>{state.purchaseModal.content.bill_number || ""}</div>

                                    <div><span className="font-medium">Employee:</span></div>
                                    <div>{state.purchaseModal.content.employee}</div>
                                </div>

                                <h3 className="font-medium mt-4">Services:</h3>
                                <table className="min-w-full bg-gray-100">
                                    <thead>
                                        <tr>
                                            <th className="py-2 px-4 border-b">Service ID</th>
                                            <th className="py-2 px-4 border-b">Name</th>
                                            <th className="py-2 px-4 border-b">Rate</th>
                                            <th className="py-2 px-4 border-b">Rate</th>
                                            <th className="py-2 px-4 border-b">Doctor Name</th>
                                            <th className="py-2 px-4 border-b">Department</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {state.purchaseModal.content.products.map((p, idx) => (
                                            <tr key={idx}>
                                                <td className="py-2 px-4 border-b text-center">{p.product_id}</td>
                                                <td className="py-2 px-4 border-b">{p.product_name}</td>
                                                <td className="py-2 px-4 border-b text-center">{p.rate.toFixed(2)}</td>
                                                <td className="py-2 px-4 border-b text-center">{p.mrp.toFixed(2)}</td>
                                                <td className="py-2 px-4 border-b text-center">{p.doctorname}</td>
                                                <td className="py-2 px-4 border-b text-center">{p.department}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><span className="font-medium">Bill Date:</span></div>
                                    <div><span>{state.purchaseModal.content.bill_date}</span></div>

                                    <div><span className="font-medium">Bill Number:</span></div>
                                    <div><span>{state.purchaseModal.content.bill_number || ""}</span></div>

                                    <div><span className="font-medium">Employee:</span></div>
                                    <div><span>{state.purchaseModal.content.employee}</span></div>

                                    <div><span className="font-medium">Service Name:</span></div>
                                    <div><span>{state.purchaseModal.content.product_name}</span></div>

                                    <div><span className="font-medium">Service ID:</span></div>
                                    <div><span>{state.purchaseModal.content.product_id}</span></div>


                                    <div><span className="font-medium">Rate:</span></div>
                                    <div><span>{state.purchaseModal.content.rate.toFixed(2)}</span></div>

                                    <div><span className="font-medium">MRP:</span></div>
                                    <div><span>{state.purchaseModal.content.mrp.toFixed(2)}</span></div>

                                </div>
                            </div>
                        )}

                        <div className="mt-6">
                            <h3 className="text-lg font-medium mb-2">Verify Employee</h3>
                            <EmployeeVerification
                                employee={state.purchaseModal.content.employee}
                                onVerify={(isVerified, message) => {
                                    if (isVerified) {
                                        dispatch({
                                            type: "SET_PURCHASE_MODAL",
                                            payload: {
                                                ...state.purchaseModal,
                                                content: {
                                                    ...state.purchaseModal.content,
                                                    isEmployeeVerified: true,
                                                    verificationMessage: message,
                                                },
                                                showModal: true,
                                            },
                                        });
                                        toast.success(message);
                                    } else {
                                        toast.error(message);
                                    }
                                }}
                            />
                        </div>

                        <div className="flex justify-end space-x-4 mt-6">
                            <button
                                onClick={handleCancelModal}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmModal}
                                className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${!state.purchaseModal.content.isEmployeeVerified
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

export default AddService;

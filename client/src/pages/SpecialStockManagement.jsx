// client/src/pages/SpecialEmployeeStockManagement.jsx

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

const SpecialEmployeeStockManagement = ({ isCollapsed }) => {
    const { user, role } = useAuth();
    const useBranch = () => {
        const { role, branch } = useAuth();

        const employeeBranch = branch;
        const effectiveBranch = role === 'admin' ? 'G001' : branch;

        return { effectiveBranch, employeeBranch };
    };

    const { effectiveBranch, employeeBranch } = useBranch();
    const branch = effectiveBranch;
    const { state, dispatch } = useGlobalState();

    const [mode, setMode] = useState("update");
    const [isLoading, setIsLoading] = useState(false);
    const isUploadingRef = useRef(false);
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 10;

    // For Add New Products (Multiple)
    const [addProducts, setAddProducts] = useState([{
        productName: "",
        productId: "",
        rate: "",
        mrp: "",
        quantity: "",
        hsnCode: "9003",
        purchase_discount: "", // Add this line
        frameShape: "",
        frameSize: "",
        sgst: "6", // Default SGST 6%
        cgst: "6", // Default CGST 6%
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
        purchase_discount: "", // Add this line
        frameShape: "",
        frameSize: "",
        sgst: "6", // Default SGST 6%
        cgst: "6", // Default CGST 6%
    }]);
    const [updateBillNumber, setUpdateBillNumber] = useState("");
    const [updateBillDate, setUpdateBillDate] = useState("");
    const [updateEmployeeId, setUpdateEmployeeId] = useState(null);
    const [updatePurchaseFrom, setUpdatePurchaseFrom] = useState("");

    const [addFreightCharges, setAddFreightCharges] = useState("0");
    const [updateFreightCharges, setUpdateFreightCharges] = useState("0");


    // Current Stock Search
    const [stockSearchQuery, setStockSearchQuery] = useState("");

    // Employees & Purchase From Lists
    const [employees, setEmployees] = useState([]);
    const [purchaseFromList, setPurchaseFromList] = useState([]);

    // Product Suggestions for Update Mode
    const [productSuggestions, setProductSuggestions] = useState([]);

    // Stock Data
    const [filteredStocks, setFilteredStocks] = useState([]);

    const calculateTotalWithTax = (rate, quantity, discount, sgst = 6, cgst = 6) => {
        const subtotal = (rate * quantity);
        const discountAmount = discount;
        const afterDiscount = subtotal - discountAmount;

        // Calculate tax based on SGST and CGST percentages
        const sgstAmount = afterDiscount * (sgst / 100);
        const cgstAmount = afterDiscount * (cgst / 100);
        const totalWithTax = afterDiscount + sgstAmount + cgstAmount;

        return Math.round(totalWithTax);
    };

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

    // Fetch Employees
    const fetchEmployees = useCallback(async () => {
        if (!branch) return;
        try {
            const { data, error } = await supabase
                .from("employees")
                .select("id, name")
                .eq("branch", employeeBranch)
                .order("name", { ascending: true });

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
    }, [branch]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);



    const fetchPurchaseFromOptions = useCallback(async () => {
        try {
            // Get values from products table
            const { data: productData, error: productError } = await supabase
                .from("specialproducts")
                .select("purchase_from", { distinct: true });

            if (productError) {
                console.error("Error fetching purchase_from options from products:", productError);
                return;
            }

            // Get values from purchases table
            const { data: purchaseData, error: purchaseError } = await supabase
                .from("purchases")
                .select("purchase_from", { distinct: true });

            if (purchaseError) {
                console.error("Error fetching purchase_from options from purchases:", purchaseError);
                return;
            }

            // Combine values from both tables
            const allValues = [
                ...(productData || []).map(d => d.purchase_from),
                ...(purchaseData || []).map(d => d.purchase_from)
            ];

            // Ensure unique values using Set
            const uniquePlaces = Array.from(
                new Set(allValues.filter(Boolean))
            ).sort();

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
                    .from("specialproducts")
                    .select("id, product_name, product_id, rate, mrp, purchase_from, hsn_code, frame_shape, frame_size,cgst,sgst")
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
            purchase_discount: '',

        }]);
        setAddBillNumber("");
        setAddBillDate("");
        setAddEmployeeId(null);
        setAddFreightCharges("0"); // Add this line

        setAddPurchaseFrom("");

        // Reset Update mode states
        setUpdateProducts([{
            searchQuery: "",
            selectedProduct: null,
            rate: "",
            mrp: "",
            quantity: "",
            hsnCode: "",
            purchase_discount: '',
        }]);
        setUpdateBillNumber("");
        setUpdateBillDate("");
        setUpdateEmployeeId(null);
        setUpdateFreightCharges("0"); // Add this line

        setUpdatePurchaseFrom("");

        setStockSearchQuery("");
        toast.dismiss();
    };

    const generateBillNumber = useCallback(async () => {
        if (!branch) return "BILL-0001";
        try {
            const { data, error } = await supabase
                .from("purchases")
                .select("bill_number")
                .eq("branch_code", branch,)
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
    }, [branch]);

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
        if (branch) {
            setupBillDetails();
        }
    }, [branch, mode, generateBillNumber]);

    // Add another product entry for Add mode
    const handleAddProductEntry = () => {
        setAddProducts([...addProducts, {
            productName: "",
            productId: "",
            rate: "",
            mrp: "",
            quantity: "",
            hsnCode: "9003",
            purchase_discount: "",
            sgst: "6", // Default 6%
            cgst: "6", // Default 6%
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
            purchase_discount: "",  // Ensure number
            sgst: "6", // Default 6% 
            cgst: "6", // Default 6%
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
        if (!addBillNumber || !addBillDate || !addEmployeeId || !addPurchaseFrom.trim()) {
            toast.error("Please fill Bill Number, Bill Date, Employee and Purchase From.");
            return;
        }

        for (let i = 0; i < addProducts.length; i++) {
            const p = addProducts[i];
            const missingFields = [];
            if (!p.productName.trim()) missingFields.push(`Product Name (#${i + 1})`);
            if (!p.productId.trim()) missingFields.push(`Product ID (#${i + 1})`);
            if (!p.rate) missingFields.push(`Rate (#${i + 1})`);
            if (!p.mrp) missingFields.push(`MRP (#${i + 1})`);
            if (!p.quantity) missingFields.push(`Quantity (#${i + 1})`);

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

        if (!branch) {
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
                    purchase_discount: parseFloat(p.purchase_discount) || 0, // Ensure number
                    frameShape: p.frameShape?.trim() || "", // Add this line
                    frameSize: p.frameSize?.trim() || "",    // Add this line
                    // freight_charges: Number(addFreightCharges || 0), // Ensure this is a number
                    sgst: parseFloat(p.sgst) || 6,
                    cgst: parseFloat(p.cgst) || 6,

                })),
                freight_charges: Number(addFreightCharges || 0)

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

    const calculateMRPWithTax = (baseMRP, sgst = 6, cgst = 6) => {
        // Calculate tax based on SGST and CGST percentages
        const sgstAmount = baseMRP * (sgst / 100);
        const cgstAmount = baseMRP * (cgst / 100);
        const mrpWithTax = baseMRP + sgstAmount + cgstAmount;

        return Math.round(mrpWithTax);
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

        if (!branch) {
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
                    purchase_discount: parseFloat(p.purchase_discount) || 0,  // Ensure number
                    frameShape: p.frameShape?.trim() || "", // Add this line
                    frameSize: p.frameSize?.trim() || "",// Add this line
                    // freight_charges: Number(addFreightCharges || 0), // Ensure this is a number
                    sgst: parseFloat(p.sgst) || 6,
                    cgst: parseFloat(p.cgst) || 6,

                })),
                freight_charges: Number(updateFreightCharges || 0)

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

    const processAddNewProducts = async () => {
        const previewData = state.purchaseModal.content;
        if (!previewData) {
            toast.error("No purchase data to process.");
            setIsLoading(false);
            isUploadingRef.current = false;
            return;
        }

        const { products, bill_number, bill_date, employee_id, employee, freight_charges } = previewData;

        try {
            for (let p of products) {
                const resAdd = await addNewProduct({
                    product_name: p.product_name,
                    product_id: p.product_id,
                    rate: p.rate,
                    // mrp: p.mrp,
                    mrp: calculateMRPWithTax(p.mrp, parseFloat(p.sgst) || 6, parseFloat(p.cgst) || 6),
                    hsn_code: p.hsn_code,
                    purchase_from: p.purchase_from,
                    purchase_discount: p.purchase_discount,
                    frame_shape: p.frameShape,
                    frame_size: p.frameSize,
                    sgst: parseFloat(p.sgst) || 6,
                    cgst: parseFloat(p.cgst) || 6
                });

                if (!resAdd.success) {
                    toast.error(`Failed to add ${p.product_id}: ${resAdd.error}`);
                    continue;
                }

                const resStock = await addOrUpdateStock(
                    resAdd.data.id,
                    branch,
                    p.quantity,
                    p.rate,
                    // p.mrp
                    calculateMRPWithTax(p.mrp, parseFloat(p.sgst) || 6, parseFloat(p.cgst) || 6)

                );
                if (!resStock.success) {
                    toast.error(`Failed to update stock for ${p.product_id}: ${resStock.error}`);
                    continue;
                }

                // Add this utility function
                // const calculateTotalWithTax = (rate, quantity, discount) => {
                //   const subtotal = (rate * quantity);
                //   const discountAmount = discount
                //   const afterDiscount = subtotal - discountAmount;
                //   return Math.round(afterDiscount * 1.12); // Adding 12% tax
                // };


                // const calculateTotalWithTax = (rate, quantity, discount, sgst = 6, cgst = 6) => {
                //   const subtotal = (rate * quantity);
                //   const discountAmount = discount;
                //   const afterDiscount = subtotal - discountAmount;

                //   // Calculate tax based on SGST and CGST percentages
                //   const sgstAmount = afterDiscount * (sgst / 100);
                //   const cgstAmount = afterDiscount * (cgst / 100);
                //   const totalWithTax = afterDiscount + sgstAmount + cgstAmount;

                //   return Math.round(totalWithTax);
                // };

                const resPurchase = await addPurchase({
                    product_id: resAdd.data.id,
                    branch_code: branch,
                    quantity: p.quantity,
                    rate: p.rate,
                    mrp: p.mrp,
                    purchase_from: p.purchase_from,
                    bill_number,
                    bill_date,
                    employee_id,
                    employee_name: employee,
                    purchase_discount: p.purchase_discount,
                    freight_charges: freight_charges,
                    sgst: p.sgst,
                    cgst: p.cgst,
                    // total_rate_with_tax: calculateTotalWithTax(p.rate, p.quantity, p.purchase_discount) // Add this
                    total_rate_with_tax: calculateTotalWithTax(
                        p.rate,
                        p.quantity,
                        p.purchase_discount,
                        p.sgst,
                        p.cgst
                    )

                });

                if (!resPurchase.success) {
                    toast.error(`Failed to record purchase for ${p.product_id}: ${resPurchase.error}`);
                    continue;
                }

                toast.success(`Product ${p.product_id} added successfully.`);
            }

            if (!purchaseFromList.includes(previewData.products[0].purchase_from)) {
                setPurchaseFromList(prev => [...prev, previewData.products[0].purchase_from].sort());
            }

            // Then refresh from server with a slight delay to ensure DB operations complete
            setTimeout(() => {
                fetchPurchaseFromOptions();
            }, 1000);

            handleModeSelection("add");
            fetchStockData();

            // handleModeSelection("add");
            // await fetchPurchaseFromOptions();
            // fetchStockData();
        } catch (err) {
            console.error("Error processing add new products:", err);
            toast.error("An unexpected error occurred.");
        } finally {
            dispatch({ type: "RESET_PURCHASE_MODAL" });
            setIsLoading(false);
            isUploadingRef.current = false;
        }
    };

    const calculatePartyRate = (rate, quantity) => {
        return ((parseFloat(rate) || 0) * (parseInt(quantity) || 0)).toFixed(2);
    };

    const processUpdateExistingProducts = async () => {
        const previewData = state.purchaseModal.content;
        if (!previewData) {
            toast.error("No purchase data to process.");
            setIsLoading(false);
            isUploadingRef.current = false;
            return;
        }

        const { products, bill_number, bill_date, employee_id, employee, freight_charges } = previewData;
        try {
            for (let p of products) {
                const resUpdate = await updateExistingProduct(
                    p.product_id_db,
                    branch,
                    parseInt(p.quantity, 10),
                    parseFloat(p.rate) || null,
                    parseFloat(p.mrp) || null,
                    p.purchase_from,
                    p.hsnCode,
                    p.purchase_discount,
                    p.frameShape,
                    p.frameSize,
                    parseFloat(p.sgst || "6"),    // Default to 6 if empty or invalid
                    parseFloat(p.cgst || "6")     // Default to 6 if empty or invalid
                );
                if (!resUpdate.success) {
                    toast.error(`Failed to update ${p.product_id}: ${resUpdate.error}`);
                    continue;
                }

                const resPurchase = await addPurchase({
                    product_id: p.product_id_db,
                    branch_code: branch,
                    quantity: p.quantity,
                    rate: p.rate,
                    mrp: p.mrp,
                    purchase_from: p.purchase_from,
                    bill_number,
                    bill_date,
                    employee_id,
                    employee_name: employee,
                    purchase_discount: p.purchase_discount,
                    // freight_charges: parseFloat(addFreightCharges || 0), // Ensure this is always a number
                    freight_charges: freight_charges, // Fix - use freight_charges from state, not addFreightCharges
                    sgst: p.sgst, // Add this line
                    cgst: p.cgst, // Add this line
                    total_rate_with_tax: calculateTotalWithTax(
                        p.rate,
                        p.quantity,
                        p.purchase_discount,
                        p.sgst,
                        p.cgst
                    )
                });

                if (!resPurchase.success) {
                    toast.error(`Failed to record purchase for ${p.product_id}: ${resPurchase.error}`);
                    continue;
                }

                toast.success(`Product ${p.product_id} updated successfully.`);
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
            updated[i].purchase_discount = product.purchase_discount || 0; // Add this line
            updated[i].frameShape = product.frame_shape || "";
            updated[i].frameSize = product.frame_size || "";
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
        if (!branch) {
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
                .eq("branch_code", branch);

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
    }, [branch]);

    useEffect(() => {
        fetchStockData();
    }, [fetchStockData]);

    return (
        <div
            className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
                } justify-center my-20 p-8 rounded-xl mx-auto max-w-4xl bg-green-50 shadow-inner`}
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
                Product Purchase
            </h1>

            {/* Mode Selection Buttons */}
            <div className="flex justify-center mb-6 text-lg font-semibold">
                <button
                    onClick={() => handleModeSelection("add")}
                    className={`mx-2 px-4 py-2 rounded ${mode === "add"
                        ? "bg-green-500 text-white shadow-2xl"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                >
                    Add New Products
                </button>
                <button
                    onClick={() => handleModeSelection("update")}
                    className={`mx-2 px-4 py-2 rounded ${mode === "update"
                        ? "bg-green-500 text-white shadow-2xl"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                >
                    Update Existing Products
                </button>
            </div>

            {mode === "add" && (
                <form onSubmit={handleAddNewProducts} className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Add New Products</h2>
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
                            <label htmlFor="addBillNumber" className="block mb-2 font-medium">
                                Bill Number<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="addBillNumber"
                                value={addBillNumber}
                                onChange={(e) => setAddBillNumber(e.target.value)}
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                    </div>



                    <div className="mt-1">
                        <button
                            type="button"
                            onClick={() => {
                                const newValue = mode === "add" ? addPurchaseFrom.trim() : updatePurchaseFrom.trim();
                                if (newValue && !purchaseFromList.includes(newValue)) {
                                    setPurchaseFromList(prev => [...prev, newValue].sort());
                                    toast.success(`Added "${newValue}" to purchase from options`);
                                } else if (purchaseFromList.includes(newValue)) {
                                    toast.info(`"${newValue}" is already in the options list`);
                                } else {
                                    toast.error("Please enter a valid purchase from value");
                                }
                            }}
                            className="text-sm text-blue-500 hover:underline"
                        >
                            Save as new purchase source
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block mb-2 font-medium">
                                Freight Charges
                            </label>
                            <input
                                type="number"
                                value={addFreightCharges}
                                onChange={(e) => setAddFreightCharges(e.target.value)}
                                className="w-full p-2 border rounded"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

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
                            <h3 className="text-lg font-medium mb-2">Product {i + 1}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block mb-2 font-medium">
                                        Product Name<span className="text-red-500">*</span>
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
                                        Product ID<span className="text-red-500">*</span>
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
                                        Party Rate<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={prod.rate}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].rate = e.target.value;
                                            setAddProducts(updated);
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
                                        Quantity<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={prod.quantity}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].quantity = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                        min="1"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block mb-2 font-medium">
                                        Total Party Rate
                                    </label>
                                    <div className="w-full p-2 border rounded bg-gray-100">
                                        ₹{calculatePartyRate(prod.rate, prod.quantity)}
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 font-medium">
                                        Purchase Discount<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={prod.purchase_discount}
                                        onChange={(e) => {
                                            const updated = [...addProducts]; // or updateProducts
                                            updated[i].purchase_discount = e.target.value;
                                            setAddProducts(updated); // or setUpdateProducts
                                        }}
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block mb-2 font-medium">
                                        SGST %
                                    </label>
                                    <input
                                        type="number"
                                        value={prod.sgst}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].sgst = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                    />
                                </div>

                                <div>
                                    <label className="block mb-2 font-medium">
                                        CGST %
                                    </label>
                                    <input
                                        type="number"
                                        value={prod.cgst}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].cgst = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                {/* Existing fields */}

                                <div>
                                    <label className="block mb-2 font-medium">
                                        Frame Shape
                                    </label>
                                    <input
                                        type="text"
                                        value={prod.frameShape}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].frameShape = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>

                                <div>
                                    <label className="block mb-2 font-medium">
                                        Frame Size
                                    </label>
                                    <input
                                        type="text"
                                        value={prod.frameSize}
                                        onChange={(e) => {
                                            const updated = [...addProducts];
                                            updated[i].frameSize = e.target.value;
                                            setAddProducts(updated);
                                        }}
                                        className="w-full p-2 border rounded"
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
                        + Add Another Product
                    </button>

                    <button
                        type="submit"
                        className={`mt-4 w-full p-2 text-white rounded ${isLoading
                            ? "bg-blue-500 cursor-not-allowed"
                            : "bg-green-500 hover:bg-green-600"
                            }`}
                        disabled={isLoading}
                    >
                        {isLoading ? "Preparing..." : "Add New Products"}
                    </button>
                </form>
            )}

            {mode === "update" && (
                <form onSubmit={handleUpdateExistingProducts} className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">
                        Update Existing Products
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
                                Bill Number<span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={updateBillNumber}
                                onChange={(e) => setUpdateBillNumber(e.target.value)}
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block mb-2 font-medium">
                                Freight Charges
                            </label>
                            <input
                                type="number"
                                value={updateFreightCharges}
                                onChange={(e) => setUpdateFreightCharges(e.target.value)}
                                className="w-full p-2 border rounded"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div className="mt-1">
                        <button
                            type="button"
                            onClick={() => {
                                const newValue = mode === "add" ? addPurchaseFrom.trim() : updatePurchaseFrom.trim();
                                if (newValue && !purchaseFromList.includes(newValue)) {
                                    setPurchaseFromList(prev => [...prev, newValue].sort());
                                    toast.success(`Added "${newValue}" to purchase from options`);
                                } else if (purchaseFromList.includes(newValue)) {
                                    toast.info(`"${newValue}" is already in the options list`);
                                } else {
                                    toast.error("Please enter a valid purchase from value");
                                }
                            }}
                            className="text-sm text-blue-500 hover:underline"
                        >
                            Save as new purchase source
                        </button>
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
                            <h3 className="text-lg font-medium mb-2">Product {i + 1}</h3>
                            <div className="md:col-span-3 mb-4">
                                <label className="block mb-2 font-medium">
                                    Search Product by Name or ID<span className="text-red-500">*</span>
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
                                            <label className="block mb-2 font-medium">Product Name</label>
                                            <input
                                                type="text"
                                                value={prod.selectedProduct.product_name}
                                                readOnly
                                                className="w-full p-2 border rounded bg-gray-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="block mb-2 font-medium">Product ID</label>
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
                                                Frame Shape
                                            </label>
                                            <input
                                                type="text"
                                                value={prod.frameShape || ''}
                                                onChange={(e) => {
                                                    const updated = [...updateProducts];
                                                    updated[i].frameShape = e.target.value;
                                                    setUpdateProducts(updated);
                                                }}
                                                className="w-full p-2 border rounded"
                                            />
                                        </div>

                                        <div>
                                            <label className="block mb-2 font-medium">
                                                Frame Size
                                            </label>
                                            <input
                                                type="text"
                                                value={prod.frameSize || ''}
                                                onChange={(e) => {
                                                    const updated = [...updateProducts];
                                                    updated[i].frameSize = e.target.value;
                                                    setUpdateProducts(updated);
                                                }}
                                                className="w-full p-2 border rounded"
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

                                        {prod.selectedProduct && (
                                            <div>
                                                <label className="block mb-2 font-medium">
                                                    Total Party Rate
                                                </label>
                                                <div className="w-full p-2 border rounded bg-gray-100">
                                                    ₹{calculatePartyRate(prod.rate, prod.quantity)}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block mb-2 font-medium">
                                                Purchase Discount<span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={prod.purchase_discount}
                                                placeholder=""
                                                onChange={(e) => {
                                                    const updated = [...updateProducts];
                                                    // Store the raw value so that "15" stays "15"
                                                    updated[i].purchase_discount = e.target.value;
                                                    setUpdateProducts(updated);
                                                }}
                                                className="w-full p-2 border rounded"
                                                step="1"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-2 font-medium">
                                                SGST %
                                            </label>
                                            <input
                                                type="number"
                                                value={prod.sgst}
                                                onChange={(e) => {
                                                    const updated = [...updateProducts];
                                                    updated[i].sgst = e.target.value;
                                                    setUpdateProducts(updated);
                                                }}
                                                className="w-full p-2 border rounded"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                            />
                                        </div>

                                        <div>
                                            <label className="block mb-2 font-medium">
                                                CGST %
                                            </label>
                                            <input
                                                type="number"
                                                value={prod.cgst}
                                                onChange={(e) => {
                                                    const updated = [...updateProducts];
                                                    updated[i].cgst = e.target.value;
                                                    setUpdateProducts(updated);
                                                }}
                                                className="w-full p-2 border rounded"
                                                min="0"
                                                max="100"
                                                step="0.01"
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
                        + Add Another Product
                    </button>

                    <button
                        type="submit"
                        className={`mt-4 w-full p-2 text-white rounded ${isLoading
                            ? "bg-blue-500 cursor-not-allowed"
                            : "bg-green-500 hover:bg-green-600"
                            }`}
                        disabled={isLoading}
                    >
                        {isLoading ? "Preparing..." : "Update Products"}
                    </button>
                </form>
            )}

            {branch && (
                <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-4">
                        Current Stock for Branch: {branch}
                    </h2>

                    <input
                        type="text"
                        placeholder="Search by Product ID or Name"
                        value={stockSearchQuery}
                        onChange={handleStockSearchInputChange}
                        className="w-full p-2 border rounded mb-4"
                    />

                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white">
                            <thead>
                                <tr>
                                    <th className="py-2 px-4 border-b">Product ID</th>
                                    <th className="py-2 px-4 border-b">Product Name</th>
                                    <th className="py-2 px-4 border-b">Quantity</th>
                                    {role !== "employee" && <th className="py-2 px-4 border-b">Party Rate</th>}
                                    <th className="py-2 px-4 border-b">MRP</th>
                                    <th className="py-2 px-4 border-b">HSN Code</th>
                                    <th className="py-2 px-4 border-b">Discount </th>
                                    <th className="py-2 px-4 border-b">Frame Shape</th>
                                    <th className="py-2 px-4 border-b">Frame Size</th>
                                    <th className="py-2 px-4 border-b">Actions</th>

                                </tr>
                            </thead>
                            <tbody>
                                {displayedStocks.map((stock) => (
                                    <tr key={stock.product.product_id}>
                                        <td className="py-2 px-4 border-b text-center">{stock.product.product_id}</td>
                                        <td className="py-2 px-4 border-b">{stock.product.product_name}</td>
                                        <td className="py-2 px-4 border-b text-center">{stock.quantity}</td>
                                        {role !== "employee" && (
                                            <td className="py-2 px-4 border-b text-center">
                                                {stock.product.rate !== null ? parseFloat(stock.product.rate).toFixed(2) : "N/A"}
                                            </td>
                                        )}
                                        <td className="py-2 px-4 border-b text-center">
                                            {stock.product.mrp !== null ? parseFloat(stock.product.mrp).toFixed(2) : "N/A"}
                                        </td>
                                        <td className="py-2 px-4 border-b text-center">{stock.product.hsn_code || "N/A"}</td>
                                        <td className="py-2 px-4 border-b text-center">{stock.purchase_discount}%</td>
                                        <td className="py-2 px-4 border-b text-center">{stock.frameShape || "-"}</td> {/* Add this */}
                                        <td className="py-2 px-4 border-b text-center">{stock.frameSize || "-"}</td>  {/* Add this */}
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
            )}

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

                                <h3 className="font-medium mt-4">Products:</h3>
                                <table className="min-w-full bg-gray-100">
                                    <thead>
                                        <tr>
                                            <th className="py-2 px-4 border-b">Product ID</th>
                                            <th className="py-2 px-4 border-b">Name</th>
                                            <th className="py-2 px-4 border-b">Qty</th>
                                            <th className="py-2 px-4 border-b">Rate</th>
                                            <th className="py-2 px-4 border-b">MRP</th>
                                            <th className="py-2 px-4 border-b">HSN</th>
                                            <th className="py-2 px-4 border-b">Discount </th>
                                            <th className="py-2 px-4 border-b">SGST %</th>
                                            <th className="py-2 px-4 border-b">CGST %</th>
                                            <th className="py-2 px-4 border-b">Frame Shape</th> {/* Add this */}
                                            <th className="py-2 px-4 border-b">Frame Size</th>  {/* Add this */}
                                            <th className="py-2 px-4 border-b">Purchase From</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {state.purchaseModal.content.products.map((p, idx) => (
                                            <tr key={idx}>
                                                <td className="py-2 px-4 border-b text-center">{p.product_id}</td>
                                                <td className="py-2 px-4 border-b">{p.product_name}</td>
                                                <td className="py-2 px-4 border-b text-center">{p.quantity}</td>
                                                <td className="py-2 px-4 border-b text-center">{p.rate.toFixed(2)}</td>
                                                <td className="py-2 px-4 border-b text-center">{p.mrp.toFixed(2)}</td>
                                                <td className="py-2 px-4 border-b text-center">{p.hsn_code}</td>
                                                <td className="py-2 px-4 border-b text-center">
                                                    {p.purchase_discount === "" || p.purchase_discount === undefined
                                                        ? "0"
                                                        : `${p.purchase_discount}`}
                                                </td>
                                                <td className="py-2 px-4 border-b text-center">{p.sgst}%</td>
                                                <td className="py-2 px-4 border-b text-center">{p.cgst}%</td>
                                                <td className="py-2 px-4 border-b text-center">{p.frameShape || "-"}</td> {/* Add this */}
                                                <td className="py-2 px-4 border-b text-center">{p.frameSize || "-"}</td>  {/* Add this */}
                                                <td className="py-2 px-4 border-b text-center">{p.purchase_from}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {/* <tfoot>
                    <tr className="bg-gray-200">
                      <td colSpan="3" className="py-2 px-4 border-t font-semibold text-right">Freight Charges:</td>
                      <td className="py-2 px-4 border-t font-semibold text-center">
                        ₹{state.purchaseModal?.content ?
                          (Number(state.purchaseModal.content.freight_charges || 0)).toFixed(2)
                          : "0.00"}
                      </td>
                      <td colSpan="6" className="py-2 px-4 border-t"></td>
                    </tr>
                    <tr className="bg-gray-200">
                      <td colSpan="3" className="py-2 px-4 border-t font-semibold text-right">Total Party Rate(Incl. GST):</td>
                      <td className="py-2 px-4 border-t font-semibold text-center">
                        ₹{state.purchaseModal.content.products.reduce((total, p) => {
                          const rate = p.unit_rate_applicable ? p.rate / p.quantity : p.rate;
                          const discount = (p.purchase_discount);
                          const subtotal = (rate * p.quantity) - discount;

                          // Multiply subtotal by 1.12 to add 12% tax
                          return total + (subtotal * 1.12);
                        }, 0).toFixed(0)}
                      </td>
                      <td colSpan="8" className="py-2 px-4 border-t"></td>
                    </tr>
                  </tfoot> */}
                                    <tfoot>
                                        <tr className="bg-gray-200">
                                            <td colSpan="3" className="py-2 px-4 border-t font-semibold text-right">Freight Charges:</td>
                                            <td className="py-2 px-4 border-t font-semibold text-center">
                                                ₹{state.purchaseModal?.content ?
                                                    (Number(state.purchaseModal.content.freight_charges || 0)).toFixed(2)
                                                    : "0.00"}
                                            </td>
                                            <td colSpan="8" className="py-2 px-4 border-t"></td>
                                        </tr>
                                        <tr className="bg-gray-200">
                                            <td colSpan="3" className="py-2 px-4 border-t font-semibold text-right">Total Party Rate (Incl. GST):</td>
                                            <td className="py-2 px-4 border-t font-semibold text-center">
                                                ₹{state.purchaseModal.content.products.reduce((total, p) => {
                                                    const rate = p.unit_rate_applicable ? p.rate / p.quantity : p.rate;
                                                    const discount = (p.purchase_discount);
                                                    const subtotal = (rate * p.quantity) - discount;

                                                    // Calculate tax based on SGST and CGST
                                                    const sgstAmount = subtotal * (p.sgst / 100);
                                                    const cgstAmount = subtotal * (p.cgst / 100);
                                                    const totalWithTax = subtotal + sgstAmount + cgstAmount;

                                                    return total + totalWithTax;
                                                }, 0).toFixed(2)}
                                            </td>
                                            <td colSpan="8" className="py-2 px-4 border-t"></td>
                                        </tr>
                                    </tfoot>
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

                                    <div><span className="font-medium">Product Name:</span></div>
                                    <div><span>{state.purchaseModal.content.product_name}</span></div>

                                    <div><span className="font-medium">Product ID:</span></div>
                                    <div><span>{state.purchaseModal.content.product_id}</span></div>

                                    <div><span className="font-medium">HSN Code:</span></div>
                                    <div><span>{state.purchaseModal.content.hsn_code}</span></div>

                                    <div><span className="font-medium">Rate:</span></div>
                                    <div><span>{state.purchaseModal.content.rate.toFixed(2)}</span></div>

                                    <div><span className="font-medium">MRP:</span></div>
                                    <div><span>{state.purchaseModal.content.mrp.toFixed(2)}</span></div>

                                    <div><span className="font-medium">Quantity:</span></div>
                                    <div><span>{state.purchaseModal.content.quantity}</span></div>

                                    <div><span className="font-medium">Purchase From:</span></div>
                                    <div><span>{state.purchaseModal.content.purchase_from}</span></div>
                                    <div><span className="font-medium">Freight Charges:</span></div>
                                    <div>₹{state.purchaseModal.content.freight_charges.toFixed(2)}</div>
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
                                className={`px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 ${!state.purchaseModal.content.isEmployeeVerified
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

export default SpecialEmployeeStockManagement;

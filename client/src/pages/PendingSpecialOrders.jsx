import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircleIcon, ArrowLeftIcon, EyeIcon, XMarkIcon } from "@heroicons/react/24/outline";
import supabase from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const PendingSpecialOrders = ({ isCollapsed }) => {
    const { branch } = useAuth();
    const [pendingOrders, setPendingOrders] = useState([]);
    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    // Track which order is being viewed in detail
    const [viewingOrderId, setViewingOrderId] = useState(null);
    const [orderDetails, setOrderDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Format date helper with null check
    const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = new Date(date);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    // Fetch pending orders
    const fetchPendingOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            console.log("Fetching pending orders for branch:", branch);
            const { data, error } = await supabase
                .from("specialworkorders")
                .select("*")
                .eq("is_used", false)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching pending orders:", error);
                return;
            }

            console.log("Pending Orders Data:", data);
            setPendingOrders(data || []);
        } catch (err) {
            console.error("Unexpected error fetching pending orders:", err);
        } finally {
            setIsLoading(false);
        }
    }, [branch]);

    // Load pending orders when component mounts
    useEffect(() => {
        fetchPendingOrders();
    }, [fetchPendingOrders]);

    // Mark order complete
    const markOrderComplete = useCallback(async (orderId) => {
        if (isMarkingComplete) return;

        setIsMarkingComplete(true);
        try {
            const { error } = await supabase
                .from("specialworkorders")
                .update({ is_used: true })  // Remove completed_at
                .eq("work_order_id", orderId);

            if (error) {
                console.error("Error marking order complete:", error);
                alert("Failed to mark order as complete");
            } else {
                // Remove the completed order from the local state
                setPendingOrders(pendingOrders.filter(order => order.work_order_id !== orderId));
                // Close detail view if this was the order being viewed
                if (viewingOrderId === orderId) {
                    setViewingOrderId(null);
                    setOrderDetails(null);
                }
                alert("Order marked as complete!");
            }
        } catch (err) {
            console.error("Unexpected error marking order complete:", err);
            alert("An unexpected error occurred");
        } finally {
            setIsMarkingComplete(false);
        }
    }, [pendingOrders, isMarkingComplete, viewingOrderId]);

    // View order details
    const viewOrderDetails = useCallback(async (orderId) => {
        // Toggle off if already viewing
        if (viewingOrderId === orderId) {
            setViewingOrderId(null);
            setOrderDetails(null);
            return;
        }

        setViewingOrderId(orderId);
        setLoadingDetails(true);

        try {
            const { data, error } = await supabase
                .from("specialworkorders")
                .select("*")
                .eq("work_order_id", orderId)
                .single();

            if (error) {
                console.error("Error fetching order details:", error);
                alert("Failed to load order details");
                setViewingOrderId(null);
                return;
            }

            setOrderDetails(data);
        } catch (err) {
            console.error("Unexpected error fetching order details:", err);
            alert("An unexpected error occurred");
            setViewingOrderId(null);
        } finally {
            setLoadingDetails(false);
        }
    }, [viewingOrderId]);

    // Go back to previous page
    const handleGoBack = () => {
        navigate(-1);
    };

    return (
        <div className={`transition-all duration-300 ${isCollapsed ? "ml-16" : "ml-64"} pt-20 px-6 pb-8`}>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <button
                        onClick={handleGoBack}
                        className="mr-4 bg-gray-100 p-2 rounded-full hover:bg-gray-200"
                    >
                        <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800">Pending Special Work Orders</h1>
                </div>

                <button
                    onClick={fetchPendingOrders}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                >
                    Refresh
                </button>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-lg shadow-md p-6">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : pendingOrders.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-gray-500 mb-4">No pending orders found</p>
                        <button
                            onClick={() => navigate('/special-work-order')}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                        >
                            Create New Order
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                        Order ID
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                        Customer
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                        Date
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                        Total Amount
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {pendingOrders.map((order) => (
                                    <React.Fragment key={order.work_order_id}>
                                        <tr className={`hover:bg-gray-50 ${viewingOrderId === order.work_order_id ? 'bg-blue-50' : ''}`}>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {order.work_order_id}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {order.mr_number
                                                    ? order.patient_details?.name || "N/A"
                                                    : order.patient_details?.name || "N/A"}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {formatDate(order.created_at)}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                ₹{order.total_amount?.toFixed(2) || "0.00"}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => markOrderComplete(order.work_order_id)}
                                                        disabled={isMarkingComplete}
                                                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-md flex items-center"
                                                    >
                                                        <CheckCircleIcon className="w-4 h-4 mr-1" />
                                                        Complete
                                                    </button>
                                                    <button
                                                        onClick={() => viewOrderDetails(order.work_order_id)}
                                                        className={`${viewingOrderId === order.work_order_id
                                                            ? 'bg-gray-500 hover:bg-gray-600'
                                                            : 'bg-blue-500 hover:bg-blue-600'} text-white px-3 py-1.5 rounded-md flex items-center`}
                                                    >
                                                        {viewingOrderId === order.work_order_id ? (
                                                            <>
                                                                <XMarkIcon className="w-4 h-4 mr-1" />
                                                                Close
                                                            </>
                                                        ) : (
                                                            <>
                                                                <EyeIcon className="w-4 h-4 mr-1" />
                                                                View
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Details row - shown when an order is selected for viewing */}
                                        {viewingOrderId === order.work_order_id && (
                                            <tr>
                                                <td colSpan="5" className="px-4 py-4 bg-blue-50">
                                                    {loadingDetails ? (
                                                        <div className="flex justify-center py-8">
                                                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                                                        </div>
                                                    ) : orderDetails ? (
                                                        <div className="p-4">
                                                            <h3 className="font-bold text-lg mb-4">Order Details</h3>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                                <div className="p-4 border rounded-md bg-white">
                                                                    <h4 className="font-medium text-gray-700 mb-2">Customer Information</h4>
                                                                    <p><span className="font-semibold">Name:</span> {orderDetails.patient_details?.name || 'N/A'}</p>
                                                                    <p><span className="font-semibold">Contact:</span> {orderDetails.patient_details?.phone_number || 'N/A'}</p>
                                                                    <p><span className="font-semibold">Address:</span> {orderDetails.patient_details?.address || 'N/A'}</p>
                                                                </div>

                                                                <div className="p-4 border rounded-md bg-white">
                                                                    <h4 className="font-medium text-gray-700 mb-2">Order Summary</h4>
                                                                    <p><span className="font-semibold">Order ID:</span> {orderDetails.work_order_id}</p>
                                                                    <p><span className="font-semibold">Date:</span> {formatDate(orderDetails.created_at)}</p>
                                                                    <p><span className="font-semibold">Status:</span> Pending</p>
                                                                </div>
                                                            </div>

                                                            <div className="mb-4">
                                                                <h4 className="font-medium text-gray-700 mb-2">Products</h4>
                                                                <div className="overflow-x-auto">
                                                                    <table className="min-w-full divide-y divide-gray-200 border">
                                                                        <thead className="bg-gray-50">
                                                                            <tr>
                                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                                            {orderDetails.product_entries && orderDetails.product_entries.map((product, idx) => (
                                                                                <tr key={idx}>
                                                                                    <td className="px-3 py-2">{product.name}</td>
                                                                                    <td className="px-3 py-2">{product.quantity}</td>
                                                                                    <td className="px-3 py-2">₹{parseFloat(product.rate).toFixed(2)}</td>
                                                                                    <td className="px-3 py-2">₹{(parseFloat(product.rate) * parseInt(product.quantity)).toFixed(2)}</td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-end space-x-2 mt-6">
                                                                <div className="text-right">
                                                                    <p className="mb-1"><span className="font-semibold">Subtotal:</span> ₹{orderDetails.subtotal?.toFixed(2) || "0.00"}</p>
                                                                    <p className="mb-1"><span className="font-semibold">Tax:</span> ₹{((orderDetails.cgst || 0) + (orderDetails.sgst || 0)).toFixed(2)}</p>
                                                                    <p className="mb-1"><span className="font-semibold">Discount:</span> ₹{orderDetails.discount_amount?.toFixed(2) || "0.00"}</p>
                                                                    <p className="text-lg font-bold"><span className="font-semibold">Total:</span> ₹{orderDetails.total_amount?.toFixed(2) || "0.00"}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-center text-gray-500 py-4">Could not load order details</p>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingSpecialOrders;
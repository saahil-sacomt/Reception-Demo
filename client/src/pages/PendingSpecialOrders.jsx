import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircleIcon, ClockIcon, XMarkIcon } from "@heroicons/react/24/outline";
// import { supabase } from '../../services/supabaseClient';
import supabase from '../supabaseClient';

const PendingSpecialOrders = ({ branch }) => {
    const [pendingOrders, setPendingOrders] = useState([]);
    const [showPendingOrders, setShowPendingOrders] = useState(false);
    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    // Format date helper
    const formatDate = (date) => {
        const d = new Date(date);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    // Fetch pending orders
    const fetchPendingOrders = useCallback(async () => {
        if (!branch) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from("specialworkorders")
                .select("*")
                .eq("is_used", false)
                .order("created_at", { ascending: false });

                console.log("Pending Orders Data:", data);
                

            if (error) {
                console.error("Error fetching pending orders:", error);
                return;
            }

            setPendingOrders(data || []);
        } catch (err) {
            console.error("Unexpected error fetching pending orders:", err);
        } finally {
            setIsLoading(false);
        }
    }, [branch]);

    // Load pending orders when component mounts or when branch changes
    useEffect(() => {
        if (branch && showPendingOrders) {
            fetchPendingOrders();
        }
    }, [branch, fetchPendingOrders, showPendingOrders]);

    // Mark order complete
    const markOrderComplete = useCallback(async (orderId) => {
        if (isMarkingComplete) return;

        setIsMarkingComplete(true);
        try {
            const { error } = await supabase
                .from("specialworkorders")
                .update({ is_used: true, completed_at: new Date().toISOString() })
                .eq("work_order_id", orderId);

            if (error) {
                console.error("Error marking order complete:", error);
                alert("Failed to mark order as complete");
            } else {
                // Remove the completed order from the local state
                setPendingOrders(pendingOrders.filter(order => order.work_order_id !== orderId));
                alert("Order marked as complete!");
            }
        } catch (err) {
            console.error("Unexpected error marking order complete:", err);
            alert("An unexpected error occurred");
        } finally {
            setIsMarkingComplete(false);
        }
    }, [pendingOrders, isMarkingComplete]);

    // Toggle view
    const togglePendingOrdersView = () => {
        setShowPendingOrders(!showPendingOrders);
        if (!showPendingOrders && branch) {
            fetchPendingOrders();
        }
    };

    return (
        <div className="mb-8">
            <button
                onClick={togglePendingOrdersView}
                className="flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg mb-4 mx-auto"
            >
                {showPendingOrders ? (
                    <span className="flex items-center">
                        <XMarkIcon className="w-5 h-5 mr-2" />
                        Hide Pending Orders
                    </span>
                ) : (
                    <span className="flex items-center">
                        <ClockIcon className="w-5 h-5 mr-2" />
                        Show Pending Orders {!branch ? "(Select Branch)" : ""}
                    </span>
                )}
            </button>

            {showPendingOrders && (
                <div className="bg-white p-4 rounded-lg shadow-md max-h-96 overflow-y-auto">
                    <h2 className="text-lg font-semibold mb-4">Pending Special Work Orders</h2>

                    {isLoading ? (
                        <p className="text-center text-gray-500 my-4">Loading...</p>
                    ) : pendingOrders.length === 0 ? (
                        <p className="text-center text-gray-500 my-4">No pending orders found</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Order ID
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Customer
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Total Amount
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {pendingOrders.map((order) => (
                                        <tr key={order.work_order_id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {order.work_order_id}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {order.mr_number
                                                    ? order.patient_details?.name || "N/A"
                                                    : order.patient_details?.name || "N/A"}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {formatDate(order.created_at)}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                ₹{order.total_amount?.toFixed(2) || "0.00"}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => markOrderComplete(order.work_order_id)}
                                                        disabled={isMarkingComplete}
                                                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md flex items-center"
                                                    >
                                                        <CheckCircleIcon className="w-4 h-4 mr-1" />
                                                        Complete
                                                    </button>
                                                    <button
                                                        onClick={() => navigate(`/special-work-order/${order.work_order_id}`)}
                                                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PendingSpecialOrders;
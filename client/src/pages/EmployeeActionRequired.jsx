// client/src/pages/EmployeeActionRequired.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from '../context/AuthContext';
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useNavigate } from 'react-router-dom';
import supabase from '../supabaseClient';
import dayjs from 'dayjs'; // Ensure dayjs is imported

const EmployeeActionRequired = ({ isCollapsed }) => {
  const { user, name, branch } = useAuth(); // Added 'branch' if needed
  const [salesRequests, setSalesRequests] = useState([]);
  const [workRequests, setWorkRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const navigate = useNavigate();

  // Function to handle auto-approval for eligible work orders
  const handleAutoApprove = async (request, approvedRequests) => {
    if (request.order_type !== 'work_order') return; // Only process work_order types

    try {
      // Fetch the related work_order's created_at
      const { data: workOrder, error: workOrderError } = await supabase
        .from('work_orders')
        .select('created_at')
        .eq('work_order_id', request.order_id)
        .single();

      if (workOrderError) {
        console.error(`Error fetching work order for Request ID: ${request.request_id}:`, workOrderError);
        return;
      }

      const workOrderCreatedAt = dayjs(workOrder.created_at);
      const now = dayjs();
      const diffHours = now.diff(workOrderCreatedAt, 'hour');

      console.log(`Request ID: ${request.request_id}, Work Order Created At: ${workOrderCreatedAt.format()}, Now: ${now.format()}, Difference (hours): ${diffHours}`);

      // Ensure the work order was created in the past and within 12 hours
      if (diffHours >= 0 && diffHours <= 12) {
        // Auto-approve the request by updating status and setting verifier's name
        const { error: updateError } = await supabase
          .from('modification_requests')
          .update({ status: 'approved', employee_name: 'Auto-approved' }) // Set verifier's name
          .eq('request_id', request.request_id);

        if (!updateError) {
          approvedRequests.push(request.request_id);
        } else {
          console.error(`Error auto-approving Request ID: ${request.request_id}:`, updateError);
        }
      } else {
        console.log(`Request ID: ${request.request_id} not eligible for auto-approval.`);
      }
    } catch (err) {
      console.error(`Unexpected error in auto-approving Request ID: ${request.request_id}:`, err);
    }
  };

  const fetchEmployeeActionRequests = async () => {
    setLoading(true);
    setNotification({ type: '', message: '' });

    try {
      // Fetch pending modification requests for the employee
      const { data: pendingData, error: pendingError } = await supabase
        .from('modification_requests')
        .select('*')
        .eq('employee_id', user.id)
        .eq('status', 'pending');

      if (pendingError) {
        console.error("Error fetching pending action requests:", pendingError);
        setNotification({ type: 'error', message: 'Failed to fetch pending action requests. Please try again.' });
      } else {
        // Segregate based on order_type
        const sales = pendingData.filter(request => request.order_type === 'sales_order');
        const work = pendingData.filter(request => request.order_type === 'work_order');

        // Initialize state with current pending requests
        setSalesRequests(sales);
        setWorkRequests(work);

        // Handle auto-approval for eligible work orders
        const approvedRequests = [];
        const autoApprovePromises = work.map(request => handleAutoApprove(request, approvedRequests));
        await Promise.all(autoApprovePromises);

        if (approvedRequests.length > 0) {
          setNotification({
            type: 'success',
            message: `Auto-approved requests: ${approvedRequests.join(', ')}`,
          });
        }

        // After auto-approvals, fetch the updated list of approved and rejected requests
        const { data: updatedData, error: updatedError } = await supabase
          .from('modification_requests')
          .select('*')
          .eq('employee_id', user.id)
          .in('status', ['approved', 'rejected']);

        if (updatedError) {
          console.error("Error fetching updated action requests:", updatedError);
          setNotification({ type: 'error', message: 'Failed to fetch updated action requests.' });
        } else {
          // Segregate based on order_type
          const updatedSales = updatedData.filter(request => request.order_type === 'sales_order');
          const updatedWork = updatedData.filter(request => request.order_type === 'work_order');

          setSalesRequests(updatedSales);
          setWorkRequests(updatedWork);
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching action requests:", err);
      setNotification({ type: 'error', message: 'An unexpected error occurred.' });
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchEmployeeActionRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Acknowledge Rejection
  const acknowledgeRejection = async (requestId, orderType) => { // Pass orderType
    setActionLoading(requestId);
    const { error } = await supabase
      .from('modification_requests')
      .update({ status: 'rejection' }) // Ensure 'acknowledged' column exists in your table
      .eq('request_id', requestId);

    if (!error) {
      setNotification({ type: 'success', message: 'Rejection acknowledged successfully.' });
      
      // Remove from local state based on orderType
      if (orderType === 'sales_order') {
        setSalesRequests(prev => prev.filter(request => request.request_id !== requestId));
      } else if (orderType === 'work_order') {
        setWorkRequests(prev => prev.filter(request => request.request_id !== requestId));
      }
    } else {
      console.error("Error acknowledging rejection:", error);
      setNotification({ type: 'error', message: 'Failed to acknowledge rejection.' });
    }
    setActionLoading(null);
  };

  const handleModifyOrder = (orderId) => {
    navigate(`/modify-order/${orderId}`);
  };

  // Auto-hide notifications after 5 seconds
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ type: '', message: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div
      className={`flex justify-center transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-14'} mt-4 pt-16 px-4 sm:px-6`}
    >
      <div className="w-full max-w-6xl bg-white rounded-lg">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Employee - Action Required</h1>

        {/* Notification */}
        {notification.message && (
          <div className={`flex items-center mb-6 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {notification.type === 'success' ? (
              <CheckIcon className="w-6 h-6 mr-2" />
            ) : (
              <XMarkIcon className="w-6 h-6 mr-2" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Action Requests List */}
        <div className="space-y-6">
          {loading ? (
            <p className="text-center text-gray-500">Loading action requests...</p>
          ) : (salesRequests.length === 0 && workRequests.length === 0) ? (
            <p className="text-center text-gray-500">No action required at the moment.</p>
          ) : (
            <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0">
              {/* Sales Orders Requests */}
              {salesRequests.length > 0 && (
                <div className="flex-1 p-6 rounded-lg border border-green-500 bg-white transition">
                  <h3 className="text-xl font-medium mb-2 text-gray-800">Sales Orders</h3>
                  {salesRequests.map(request => (
                    <div key={request.request_id} className="flex justify-between items-start mb-4 p-4 rounded-lg bg-green-50 hover:shadow-lg">
                      <div>
                        <p className="font-medium text-gray-800">{request.request_id}</p>
                        <p className="text-sm text-gray-600">Order ID: {request.order_id}</p>
                        <p className="text-sm text-gray-600">Modification Type: {request.modification_type}</p>
                        <p className="text-sm text-gray-600">
                          Status: 
                          <span className={`ml-1 font-semibold ${request.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                            {request.status}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Verified By: {request.employee_name}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {request.status === 'approved' ? (
                          <button
                            onClick={() => handleModifyOrder(request.order_id)}
                            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                          >
                            Modify Order
                          </button>
                        ) : (
                          <button
                            onClick={() => acknowledgeRejection(request.request_id, request.order_type)} // Pass order_type
                            className={`flex items-center px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition ${
                              actionLoading === request.request_id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            disabled={actionLoading === request.request_id}
                          >
                            {/* <XMarkIcon className="w-5 h-5 mr-1" /> */}
                            Acknowledge Rejection
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Work Orders Requests */}
              {workRequests.length > 0 && (
                <div className="flex-1 p-6 rounded-lg border border-green-500 bg-white transition">
                  <h3 className="text-xl font-medium mb-2 text-gray-800">Work Orders</h3>
                  {workRequests.map(request => (
                    <div key={request.request_id} className="flex justify-between items-start mb-4 p-4 rounded-lg bg-green-50 hover:shadow-lg">
                      <div>
                        <p className="font-medium text-gray-800">{request.request_id}</p>
                        <p className="text-sm text-gray-600">Order ID: {request.order_id}</p>
                        <p className="text-sm text-gray-600">Modification Type: {request.modification_type}</p>
                        <p className="text-sm text-gray-600">
                          Status: 
                          <span className={`ml-1 font-semibold ${request.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                            {request.status}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Verified By: {request.employee_name}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {request.status === 'approved' ? (
                          <button
                            onClick={() => handleModifyOrder(request.order_id)}
                            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                          >
                            Modify Order
                          </button>
                        ) : (
                          <button
                            onClick={() => acknowledgeRejection(request.request_id, request.order_type)} // Pass order_type
                            className={`flex items-center px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition ${
                              actionLoading === request.request_id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            disabled={actionLoading === request.request_id}
                          >
                            {/* <XMarkIcon className="w-5 h-5 mr-1" /> */}
                            Acknowledge Rejection
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeActionRequired;

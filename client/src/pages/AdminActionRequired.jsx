// client/src/pages/AdminActionRequired.jsx
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { CheckIcon, XMarkIcon, InformationCircleIcon } from "@heroicons/react/24/outline"; // Enhanced Icons
import dayjs from 'dayjs'; // Import dayjs for date manipulation

const AdminActionRequired = ({ isCollapsed }) => {
  const { role } = useAuth();
  const [salesRequests, setSalesRequests] = useState([]);
  const [workRequests, setWorkRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // To track action on specific request
  const [notification, setNotification] = useState({ type: '', message: '' });

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
        // Auto-approve the request
        const { error: updateError } = await supabase
          .from('modification_requests')
          .update({ status: 'approved' })
          .eq('request_id', request.request_id);

        if (!updateError) {
          approvedRequests.push(request.request_id);
        } else {
          console.error(`Error auto-approving Request ID: ${request.request_id}:`, updateError);
          // Optionally, you can push to a separate array for failed auto-approvals
        }
      } else {
        console.log(`Request ID: ${request.request_id} not eligible for auto-approval.`);
      }
    } catch (err) {
      console.error(`Unexpected error in auto-approving Request ID: ${request.request_id}:`, err);
    }
  };
  
  

  const fetchRequests = async () => {
    setLoading(true);
    setNotification({ type: '', message: '' });

    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('status', 'pending');

    if (error) {
      console.error("Error fetching requests:", error);
      setNotification({ type: 'error', message: 'Failed to fetch requests. Please try again.' });
    } else {
      // Segregate based on order_type
      const sales = data.filter(request => request.order_type === 'sales_order');
      const work = data.filter(request => request.order_type === 'work_order');

      setSalesRequests(sales);
      setWorkRequests(work);

      // Handle auto-approval for eligible work orders
      work.forEach(request => {
        handleAutoApprove(request);
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const handleApproveRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to approve this request?')) return;

    setActionLoading(requestId);
    const { error } = await supabase
      .from('modification_requests')
      .update({ status: 'approved' })
      .eq('request_id', requestId);

    if (!error) {
      setNotification({ type: 'success', message: 'Request approved successfully.' });
      fetchRequests(); // Refresh list
    } else {
      console.error("Error approving request:", error);
      setNotification({ type: 'error', message: 'Failed to approve request.' });
    }
    setActionLoading(null);
  };

  const handleRejectRequest = async (requestId) => {
    const reason = prompt("Please provide a reason for rejecting this request:");
    if (!reason) {
      alert("Rejection reason is required.");
      return;
    }

    if (!window.confirm('Are you sure you want to reject this request?')) return;

    setActionLoading(requestId);
    const { error } = await supabase
      .from('modification_requests')
      .update({ status: 'rejected', rejection_reason: reason }) // Ensure 'rejection_reason' column exists in your table
      .eq('request_id', requestId);

    if (!error) {
      setNotification({ type: 'success', message: 'Request rejected successfully.' });
      fetchRequests(); // Refresh list
    } else {
      console.error("Error rejecting request:", error);
      setNotification({ type: 'error', message: 'Failed to reject request.' });
    }
    setActionLoading(null);
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
    <div className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"} justify-center mt-20 p-20 rounded-xl mx-auto max-w-6xl`}>
      <div className="w-full">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Admin - Action Required</h1>

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

        {/* Requests List */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">Pending Modification Requests</h2>
          
          {loading ? (
            <p className="text-center text-gray-500">Loading requests...</p>
          ) : (salesRequests.length === 0 && workRequests.length === 0) ? (
            <p className="text-center text-gray-500">No pending requests at the moment.</p>
          ) : (
            <>
              {/* Sales Orders Requests */}
              {salesRequests.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-medium mb-2 text-gray-800">Sales Orders</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                      <thead>
                        <tr>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Request ID</th>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Order ID</th>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Employee</th>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Modification Type</th>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Reason</th>
                          <th className="py-3 px-6 bg-gray-100 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesRequests.map(request => (
                          <tr key={request.request_id} className="border-b hover:bg-gray-50">
                            <td className="py-4 px-6 text-sm text-gray-700">{request.request_id}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{request.order_id}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{request.employee_name}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{request.modification_type}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{request.modification_reason}</td>
                            <td className="py-4 px-6 text-sm text-center">
                              <div className="flex justify-center space-x-2">
                                <button
                                  onClick={() => handleApproveRequest(request.request_id)}
                                  className={`flex items-center px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition ${
                                    actionLoading === request.request_id ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  disabled={actionLoading === request.request_id}
                                >
                                  <CheckIcon className="w-5 h-5 mr-1" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(request.request_id)}
                                  className={`flex items-center px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition ${
                                    actionLoading === request.request_id ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  disabled={actionLoading === request.request_id}
                                >
                                  <XMarkIcon className="w-5 h-5 mr-1" />
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Work Orders Requests */}
              {workRequests.length > 0 && (
                <div>
                  <h3 className="text-xl font-medium mb-2 text-gray-800">Work Orders</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                      <thead>
                        <tr>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Request ID</th>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Order ID</th>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Employee</th>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Modification Type</th>
                          <th className="py-3 px-6 bg-gray-100 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Reason</th>
                          <th className="py-3 px-6 bg-gray-100 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workRequests.map(request => (
                          <tr key={request.request_id} className="border-b hover:bg-gray-50">
                            <td className="py-4 px-6 text-sm text-gray-700">{request.request_id}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{request.order_id}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{request.employee_name}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{request.modification_type}</td>
                            <td className="py-4 px-6 text-sm text-gray-700">{request.modification_reason}</td>
                            <td className="py-4 px-6 text-sm text-center">
                              <div className="flex justify-center space-x-2">
                                <button
                                  onClick={() => handleApproveRequest(request.request_id)}
                                  className={`flex items-center px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition ${
                                    actionLoading === request.request_id ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  disabled={actionLoading === request.request_id}
                                >
                                  <CheckIcon className="w-5 h-5 mr-1" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(request.request_id)}
                                  className={`flex items-center px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition ${
                                    actionLoading === request.request_id ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  disabled={actionLoading === request.request_id}
                                >
                                  <XMarkIcon className="w-5 h-5 mr-1" />
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminActionRequired;

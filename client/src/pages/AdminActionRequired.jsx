// client/src/pages/AdminActionRequired.jsx
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { CheckIcon, XMarkIcon, InformationCircleIcon } from "@heroicons/react/24/outline"; // Enhanced Icons

const AdminActionRequired = ({ isCollapsed }) => {
  const { role } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // To track action on specific request
  const [notification, setNotification] = useState({ type: '', message: '' });

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
      setRequests(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchRequests();
    }
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
    if (!window.confirm('Are you sure you want to reject this request?')) return;

    setActionLoading(requestId);
    const { error } = await supabase
      .from('modification_requests')
      .update({ status: 'rejected' })
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
    <div className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
        } justify-center mt-20 p-20 rounded-xl mx-auto max-w-6xl`}>
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
          ) : requests.length === 0 ? (
            <p className="text-center text-gray-500">No pending requests at the moment.</p>
          ) : (
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
                  {requests.map(request => (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminActionRequired;

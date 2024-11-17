// client/src/pages/EmployeeActionRequired.jsx
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PencilIcon, XMarkIcon, CheckIcon, InformationCircleIcon } from "@heroicons/react/24/outline"; // Enhanced Icons
import { useNavigate } from 'react-router-dom';

const EmployeeActionRequired = ({ isCollapsed }) => {
  const { user } = useAuth();
  const [actionRequests, setActionRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // To track action on specific request
  const [notification, setNotification] = useState({ type: '', message: '' });
  const navigate = useNavigate();

  const fetchEmployeeActionRequests = async () => {
    setLoading(true);
    setNotification({ type: '', message: '' });

    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('employee_id', user.id)
      .in('status', ['approved', 'rejected']);

    if (error) {
      console.error("Error fetching action requests:", error);
      setNotification({ type: 'error', message: 'Failed to fetch action requests. Please try again.' });
    } else {
      setActionRequests(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchEmployeeActionRequests();
    }
  }, [user]);

  const acknowledgeRejection = async (requestId) => {
    if (!window.confirm('Are you sure you want to acknowledge this rejection?')) return;

    setActionLoading(requestId);
    const { error } = await supabase
      .from('modification_requests')
      .update({ status: 'acknowledged' })
      .eq('request_id', requestId);

    if (!error) {
      setNotification({ type: 'success', message: 'Rejection acknowledged successfully.' });
      fetchEmployeeActionRequests(); // Refresh list
    } else {
      console.error("Error acknowledging rejection:", error);
      setNotification({ type: 'error', message: 'Failed to acknowledge rejection.' });
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
    <div className={`flex justify-center items-center transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-14'} my-8 pt-16 min-h-screen px-4 sm:px-6 lg:px-8 max-w-4xl`}>
      <div className="w-full">
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
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">Your Modification Requests</h2>
          
          {loading ? (
            <p className="text-center text-gray-500">Loading action requests...</p>
          ) : actionRequests.length === 0 ? (
            <p className="text-center text-gray-500">No action required at the moment.</p>
          ) : (
            <ul className="space-y-4">
              {actionRequests.map(request => (
                <li key={request.request_id} className="border p-6 rounded-lg shadow-sm bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-medium text-gray-800">{request.request_id}</h3>
                      <p className="text-sm text-gray-600">Order ID: {request.order_id}</p>
                      <p className="text-sm text-gray-600">Modification Type: {request.modification_type}</p>
                      <p className="text-sm text-gray-600">Reason: {request.modification_reason}</p>
                      <p className="text-sm text-gray-600">Status: <span className={`font-semibold ${request.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>{request.status}</span></p>
                    </div>
                    <div className="flex space-x-2">
                      {request.status === 'approved' ? (
                        <button
                          onClick={() => navigate(`/modify-order/${request.order_id}`)}
                          className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        >
                          <PencilIcon className="w-5 h-5 mr-1" />
                          Modify Order
                        </button>
                      ) : (
                        <button
                          onClick={() => acknowledgeRejection(request.request_id)}
                          className={`flex items-center px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition ${
                            actionLoading === request.request_id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={actionLoading === request.request_id}
                        >
                          <XMarkIcon className="w-5 h-5 mr-1" />
                          Acknowledge Rejection
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeActionRequired;

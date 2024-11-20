// client/src/pages/EmployeeActionRequired.jsx
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PencilIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useNavigate } from 'react-router-dom';
import { useModificationContext } from "../context/ModificationContext";

const EmployeeActionRequired = ({ isCollapsed }) => {
  const { user } = useAuth();
  const { actionRequests, setActionRequests } = useModificationContext();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
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
    const fetchActionRequests = async () => {
      const { data, error } = await supabase
        .from("modification_requests")
        .select("*")
        .eq("employee_id", user.id)
        .in("status", ["approved", "rejected"]);

      if (!error) setActionRequests(data);
    };

    fetchActionRequests();
  }, [setActionRequests]);

  const acknowledgeRejection = async (requestId) => {
    if (!window.confirm('Are you sure you want to acknowledge this rejection?')) return;

    setActionLoading(requestId);
    const { error } = await supabase
      .from('modification_requests')
      .update({ status: 'acknowledged' })
      .eq('request_id', requestId);

    if (!error) {
      setNotification({ type: 'success', message: 'Rejection acknowledged successfully.' });
      setActionRequests(prevRequests =>
        prevRequests.filter(request => request.request_id !== requestId)
      );
    } else {
      console.error("Error acknowledging rejection:", error);
      setNotification({ type: 'error', message: 'Failed to acknowledge rejection.' });
    }
    setActionLoading(null);
  };

  const handleModifyOrder = (orderId) => {
    navigate(`/modify-order/${orderId}`);
  };

  const removeActionRequest = (orderId) => {
    setActionRequests((prevRequests) =>
      prevRequests.filter((request) => request.order_id !== orderId)
    );
  };

  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ type: '', message: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className={`flex justify-center transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-14'} mt-8 pt-16 px-4 sm:px-6`}>
      <div className="w-full max-w-3xl bg-white shadow-md rounded-lg p-8">
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
          ) : actionRequests.length === 0 ? (
            <p className="text-center text-gray-500">No action required at the moment.</p>
          ) : (
            <ul className="space-y-4">
              {actionRequests.map(request => (
                <li key={request.request_id} className="border p-6 rounded-lg shadow-sm bg-gray-50 hover:bg-gray-100 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-800">{request.request_id}</h3>
                      <p className="text-sm text-gray-600">Order ID: {request.order_id}</p>
                      <p className="text-sm text-gray-600">Modification Type: {request.modification_type}</p>
                      <p className="text-sm text-gray-600">Reason: {request.modification_reason}</p>
                      <p className="text-sm text-gray-600">
                        Status: 
                        <span className={`ml-1 font-semibold ${request.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                          {request.status}
                        </span>
                      </p>
                    </div>
                    <div className="mt-2 flex space-x-2">
                      {request.status === 'approved' ? (
                        <button
                          onClick={() => handleModifyOrder(request.order_id)}
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

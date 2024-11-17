// client/src/pages/RaiseRequest.jsx
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PrinterIcon, TrashIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline"; // Enhanced Icons

const RaiseRequest = ({ isCollapsed }) => {
  const { user, branch, name } = useAuth();
  const [orderId, setOrderId] = useState('');
  const [modificationType, setModificationType] = useState('');
  const [modificationReason, setModificationReason] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [searchMode, setSearchMode] = useState('all'); // 'all' or 'id'

  const modificationTypes = [
    'Customer wants to change the item',
    'Customer wants to return the item',
    'Customer is facing quality issues',
    'Other'
  ];

  const fetchOrders = async () => {
    setIsLoading(true);
    setNotification({ type: '', message: '' });

    let query = supabase.from('sales_orders').select('*').eq('branch', branch);

    if (searchMode === 'id' && orderId.trim()) {
      query = query.ilike('sales_order_id', `%${orderId}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      setNotification({ type: 'error', message: 'Failed to fetch orders. Please try again.' });
    } else if (data.length === 0) {
      setNotification({ type: 'info', message: 'No sales orders found.' });
    } else {
      setOrders(data);
    }
    setIsLoading(false);
  };

  const handleSubmitRequest = async () => {
    if (!modificationType || (modificationType === 'Other' && !modificationReason)) {
      setNotification({ type: 'error', message: 'Please provide all the necessary details.' });
      return;
    }

    setIsLoading(true);
    setNotification({ type: '', message: '' });

    const requestId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
    const { error } = await supabase
      .from('modification_requests')
      .insert([{
        request_id: requestId,
        order_id: selectedOrder?.sales_order_id,
        order_type: 'sales_order',
        employee_id: user.id,
        modification_type: modificationType,
        modification_reason: modificationReason,
        employee_name:name,
        status: 'pending', // Ensure status is set to 'pending'
      }]);

    if (error) {
      console.error("Error submitting request:", error);
      setNotification({ type: 'error', message: 'Failed to submit the request.' });
    } else {
      setNotification({ type: 'success', message: 'Request submitted successfully!' });
      // Reset form fields
      setOrderId('');
      setModificationType('');
      setModificationReason('');
      setSelectedOrder(null);
      setOrders([]);
      setSearchMode('all');
    }
    setIsLoading(false);
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
    <div className={`flex justify-end  transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-20'} my-8 pt-16 min-h-screen px-4 sm:px-6 lg:px-8`}>
      <div className="w-full">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Raise Modification Request</h1>

        {/* Notification */}
        {notification.message && (
          <div className={`flex items-center mb-6 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-100 text-green-700' : notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {notification.type === 'success' && <CheckCircleIcon className="w-6 h-6 mr-2" />}
            {notification.type === 'error' && <ExclamationCircleIcon className="w-6 h-6 mr-2" />}
            {notification.type === 'info' && <InformationCircleIcon className="w-6 h-6 mr-2" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Search Mode Selection */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Search Mode</h2>
          <div className="flex space-x-6">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-5 w-5 text-green-600"
                name="searchMode"
                value="all"
                checked={searchMode === 'all'}
                onChange={() => {
                  setSearchMode('all');
                  setOrderId('');
                  setSelectedOrder(null);
                  setOrders([]);
                  setNotification({ type: '', message: '' });
                }}
              />
              <span className="ml-2 text-gray-700">Fetch All Sales Orders</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-5 w-5 text-green-600"
                name="searchMode"
                value="id"
                checked={searchMode === 'id'}
                onChange={() => {
                  setSearchMode('id');
                  setSelectedOrder(null);
                  setOrders([]);
                  setNotification({ type: '', message: '' });
                }}
              />
              <span className="ml-2 text-gray-700">Search by Sales Order ID</span>
            </label>
          </div>
        </div>

        {/* Order ID Input and Fetch Button (only if searchMode is 'id') */}
        {searchMode === 'id' && (
          <div className="bg-white shadow rounded-lg p-6 mb-6 flex flex-col sm:flex-row sm:items-end sm:space-x-4">
            <div className="flex-1">
              <label htmlFor="orderId" className="block text-sm font-medium text-gray-700 mb-2">Enter Sales Order ID</label>
              <input
                type="text"
                id="orderId"
                placeholder="Enter Sales Order ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>
            <button
              onClick={fetchOrders}
              className={`mt-4 sm:mt-0 w-full sm:w-auto inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        )}

        {/* Fetch All Orders Button (only if searchMode is 'all') */}
        {searchMode === 'all' && (
          <div className="bg-white shadow rounded-lg p-6 mb-6 flex justify-center">
            <button
              onClick={fetchOrders}
              className={`w-full sm:w-auto inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Fetching All Orders...' : 'Fetch All Sales Orders'}
            </button>
          </div>
        )}

        {/* Display Fetched Orders */}
        {orders.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Select a Sales Order:</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => (
                <li
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`cursor-pointer p-4 border rounded-lg shadow-sm hover:bg-green-50 transition duration-200 ${
                    selectedOrder?.id === order.id ? 'border-green-500 bg-green-100' : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium text-gray-800">{order.sales_order_id}</p>
                  <p className="text-sm text-gray-600 mt-2">{order.customer_name || 'Customer Name'}</p>
                  <p className="text-sm text-gray-600 mt-1">Amount: ₹{parseFloat(order.total_amount).toFixed(2)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Selected Order Details and Modification Form */}
        {selectedOrder && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-700">Order Details</h2>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-100 p-4 rounded-lg">
                <p><strong>Sales Order ID:</strong> {selectedOrder.sales_order_id}</p>
                <p><strong>Customer Name:</strong> {selectedOrder.customer_name || 'N/A'}</p>
                <p><strong>Total Amount:</strong> ₹{parseFloat(selectedOrder.total_amount).toFixed(2)}</p>
                <p><strong>Status:</strong> {selectedOrder.status || 'N/A'}</p>
                {/* Add more fields as necessary */}
              </div>
              {/* Optional: Add product list or other details */}
            </div>

            {/* Modification Type */}
            <div className="mb-4">
              <label htmlFor="modificationType" className="block text-sm font-medium text-gray-700 mb-2">Modification Type</label>
              <select
                id="modificationType"
                value={modificationType}
                onChange={(e) => setModificationType(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
              >
                <option value="">Select Modification Type</option>
                {modificationTypes.map((type, idx) => (
                  <option key={idx} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Modification Reason */}
            {modificationType === 'Other' && (
              <div className="mb-4">
                <label htmlFor="modificationReason" className="block text-sm font-medium text-gray-700 mb-2">Modification Reason</label>
                <textarea
                  id="modificationReason"
                  placeholder="Enter modification reason"
                  value={modificationReason}
                  onChange={(e) => setModificationReason(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  rows={4}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmitRequest}
              className={`w-full inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RaiseRequest;

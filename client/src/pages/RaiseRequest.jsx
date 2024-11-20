// client/src/pages/RaiseRequest.jsx
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Modal from 'react-modal';
import EmployeeVerification from "../components/EmployeeVerification";
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
  const [searchMode, setSearchMode] = useState('all');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase.from('employees').select('name');
      if (!error) setEmployees(data.map((emp) => emp.name));
    };

    fetchEmployees();
  }, []);

  const openModal = (order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
  };

  const handleSubmitRequest = async () => {
    if (!modificationType || (modificationType === 'Other' && !modificationReason)) {
      setNotification({ type: 'error', message: 'Please provide all the necessary details.' });
      return;
    }

    if (!isVerified) {
      setNotification({ type: 'error', message: 'Please verify the selected employee.' });
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
        status: 'pending',
        branch:branch // Ensure status is set to 'pending'
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
      setIsModalOpen(false);
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
    <div className={`flex justify-center transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-0'} mt-8 pt-16 min-h-screen`}>
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-center text-gray-800">Raise Modification Request</h1>

        {/* Notification */}
        {notification.message && (
          <div className={`flex items-center mb-2 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-100 text-green-700' : notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {notification.type === 'success' && <CheckCircleIcon className="w-6 h-6 mr-2" />}
            {notification.type === 'error' && <ExclamationCircleIcon className="w-6 h-6 mr-2" />}
            {notification.type === 'info' && <InformationCircleIcon className="w-6 h-6 mr-2" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Search Mode Selection */}
        <div className="bg-white rounded-lg p-6 mb-2">
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
          <div className="bg-white  rounded-lg px-6 mb-2 flex flex-col sm:flex-row sm:items-end sm:space-x-4">
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
          <div className="bg-white rounded-lg px-6 flex justify-center">
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
          <div className="bg-white  rounded-lg p-6 mb-2">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Select a Sales Order:</h2>
            <ul className="grid grid-cols-3 gap-4">
              {orders.map((order) => (
                <li
                  key={order.id}
                  onClick={() => openModal(order)}
                  className={`cursor-pointer p-4 border rounded-lg shadow-sm hover:bg-green-50 transition duration-200 ${
                    selectedOrder?.id === order.id ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium text-gray-800">{order.sales_order_id}</p>
                  <p className="text-sm text-gray-600 mt-2">Customer MR Number: {order.mr_number || 'Customer MR number'}</p>
                  <p className="text-sm text-gray-600 mt-1">Amount: ₹{parseFloat(order.total_amount).toFixed(2)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Button to open modal */}
      {selectedOrder && (
        <button
          onClick={openModal}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Proceed to Modify
        </button>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 relative"
      >
        <h2 className="text-2xl font-bold mb-4">Order & Modification Details</h2>

        {/* Order Details */}
        {selectedOrder && (
          <div className="mb-4">
            <p><strong>Order ID:</strong> {selectedOrder.sales_order_id}</p>
            <p><strong>Customer MR Number:</strong> {selectedOrder.mr_number || 'Customer MR number'}</p>
            <p><strong>Total Amount:</strong> ₹{parseFloat(selectedOrder.total_amount).toFixed(2)}</p>
          </div>
        )}

        {/* Employee Selection */}
        <div className="mb-4">
          <label htmlFor="employee" className="block mb-2 font-medium">Select Employee</label>
          <select
            id="employee"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="border rounded-md w-full px-4 py-2"
          >
            <option value="">Select Employee</option>
            {employees.map((employee) => (
              <option key={employee} value={employee}>{employee}</option>
            ))}
          </select>
        </div>

        {/* Employee Verification */}
        {selectedEmployee && (
          <EmployeeVerification
            employee={selectedEmployee}
            onVerify={(isValid) => setIsVerified(isValid)}
          />
        )}

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
          disabled={!isVerified}
          className={`w-full inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
            isVerified ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Submit Request
        </button>
      </Modal>
          
        
      </div>
    </div>
  );
};

export default RaiseRequest;

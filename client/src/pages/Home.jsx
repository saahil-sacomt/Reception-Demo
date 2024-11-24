// client/src/pages/Home.jsx
import { useState, useEffect } from 'react';
import SplashScreen from '../components/SplashScreen';
import walletImage from '../assets/pngwing.com.png';
import {
  CircleStackIcon,
  ClipboardDocumentIcon,
  CreditCardIcon,
  TicketIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArchiveBoxArrowDownIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import supabase from '../supabaseClient';

const Home = ({ isCollapsed }) => {
  // State Variables
  const [showSplash, setShowSplash] = useState(sessionStorage.getItem('showSplash') === 'true');
  const navigate = useNavigate();
  const { user, name, loading, role, branch } = useAuth();
  const [actionRequests, setActionRequests] = useState([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingWorkOrdersCount, setPendingWorkOrdersCount] = useState(0);
  const [salesTodayCount, setSalesTodayCount] = useState(0);

  // New State Variables for Modals
  const [pendingWorkOrders, setPendingWorkOrders] = useState([]);
  const [salesOrdersToday, setSalesOrdersToday] = useState([]);

  // Modal State Variables
  const [showWorkOrdersModal, setShowWorkOrdersModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState(null);

  // Fetch approved/rejected modification requests for the logged-in employee
  const fetchActionRequests = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('employee_id', user.id)
      .in('status', ['approved', 'rejected']); // Fetch both approved and rejected requests

    if (!error && data) {
      setActionRequests(data);
    } else {
      console.error("Error fetching action requests:", error.message);
    }
  };

  // Fetch approved modification requests
  const fetchApprovedRequests = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('employee_id', user.id)
      .eq('status', 'approved');

    if (!error && data) {
      setActionRequests(data);
    } else {
      console.error("Error fetching approved requests:", error.message);
    }
  };

  const handlePrivilegeCardClick = () => {
    window.location.href = '/privilege-generation';
  };

  // Fetch pending work orders
  const fetchPendingWorkOrders = async () => {
    if (!branch) return;

    const today = getTodayDate(); // Utility function to get today's date in YYYY-MM-DD format

    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('branch', branch)
      .gte('due_date', today); // Fetch work orders with due_date today or in the future

    if (!error && data) {
      setPendingWorkOrders(data);
      setPendingWorkOrdersCount(data.length);
    } else {
      console.error("Error fetching pending work orders:", error.message);
    }
  };

  // Fetch sales orders created today
  const fetchSalesOrdersToday = async () => {
    if (!branch) return;

    const today = getTodayDate(); // Utility function to get today's date in YYYY-MM-DD format

    const { data, error } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('branch', branch)
      .gte('created_at', today); // Fetch sales orders created today

    if (!error && data) {
      setSalesOrdersToday(data);
      setSalesTodayCount(data.length);
    } else {
      console.error("Error fetching sales orders today:", error.message);
    }
  };

  // Fetch pending modification requests count for admin
  const fetchPendingRequestsCount = async () => {
    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('status', 'pending');

    if (!error && data) {
      return data.length;
    }
    console.error("Error fetching pending requests count:", error.message);
    return 0;
  };

  // Fetch approved/rejected modification requests count for employee
  const fetchEmployeeActionRequestsCount = async () => {
    if (!user) return 0;

    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('employee_id', user.id)
      .in('status', ['approved', 'rejected']);

    if (!error && data) {
      setActionRequests(data);
      return data.length;
    }
    console.error("Error fetching employee action requests count:", error.message);
    return 0;
  };

  // Fetch work order details by ID
  const fetchWorkOrderDetails = async (workOrderId) => {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('work_order_id', workOrderId)
      .single();

    if (error) {
      console.error("Error fetching work order details:", error.message);
      alert("Failed to fetch work order details.");
      return null;
    }

    return data;
  };

  // Fetch sales order details by ID
  const fetchSalesOrderDetails = async (salesOrderId) => {
    const { data, error } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('sales_order_id', salesOrderId)
      .single();

    if (error) {
      console.error("Error fetching sales order details:", error.message);
      alert("Failed to fetch sales order details.");
      return null;
    }

    return data;
  };

  // Acknowledge rejection of a modification request
  const acknowledgeRejection = async (requestId) => {
    const { error } = await supabase
      .from('modification_requests')
      .update({ status: 'acknowledged' })
      .eq('request_id', requestId);

    if (!error) {
      alert('Rejection acknowledged');
      fetchActionRequests(); // Refresh list
    } else {
      console.error("Error acknowledging rejection:", error.message);
    }
  };

  // Handle Acknowledge Rejection Button Click
  const handleAcknowledgeClick = (requestId) => {
    acknowledgeRejection(requestId);
  };

  // Utility function to get the current date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // useEffect Hooks
  useEffect(() => {
    if (user) {
      fetchApprovedRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.removeItem('showSplash'); // Clear flag after splash screen
      }, 2000); // Duration matches animation
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  useEffect(() => {
    if (user) {
      fetchActionRequests();
      fetchPendingWorkOrders();
      fetchSalesOrdersToday();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, branch]);

  useEffect(() => {
    if (user && role === 'admin') {
      fetchPendingRequestsCount().then(count => setPendingRequestsCount(count));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  useEffect(() => {
    if (user && role === 'employee') {
      fetchEmployeeActionRequestsCount().then(count => setPendingRequestsCount(count));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  // Navigate to employee action-required page
  const handleEmployeeActionClick = () => {
    if (role === 'employee') {
      navigate('/employee/action-required');
    }
  };

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-14'} my-8 pt-9 min-h-screen`}>
      {showSplash ? (
        <SplashScreen />
      ) : (
        <div className="space-y-5">
          {/* Welcome and Metrics Section */}
          <div className="bg-white p-6 flex flex-col md:flex-row justify-between items-center">
            {/* Welcome Message */}
            <div className="mb-4 md:mb-0">
              <h2 className="font-normal text-[25px] text-green-500">
                {name ? `Welcome, ${name}` : 'Welcome, User'}
              </h2>
              <p className="text-sm text-gray-600">
                Send, track & manage your documents & Privilege cards.
              </p>
            </div>

            {/* Metrics Section */}
            <div className="bg-green-50 rounded-lg shadow flex overflow-hidden">
              {/* Action Required */}
              <div
                className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer"
                onClick={role === 'admin' ? () => navigate('/admin/action-required') : handleEmployeeActionClick}
              >
                <p className="text-3xl font-semibold text-green-500">{pendingRequestsCount}</p>
                <p className="text-xs text-gray-600 py-2">Action Required</p>
              </div>

              {/* Pending Work Orders */}
              <div
                className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer"
                onClick={() => setShowWorkOrdersModal(true)}
              >
                <p className="text-3xl font-semibold text-green-500">{pendingWorkOrdersCount}</p>
                <p className="text-xs text-gray-600 py-2">Pending Work Orders</p>
              </div>

              {/* Sales Today */}
              <div
                className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer"
                onClick={() => setShowSalesModal(true)}
              >
                <p className="text-3xl font-semibold text-green-500">{salesTodayCount}</p>
                <p className="text-xs text-gray-600 py-2">Sales Today</p>
              </div>

              {/* Failed */}
              <div className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer">
                <p className="text-3xl font-semibold text-green-500">0</p>
                <p className="text-xs text-gray-600 py-2">Failed</p> {/* Dummy count */}
              </div>
            </div>
          </div>

          {/* Purchase and Order Generation Sections (Horizontal Row) */}
          <div className="flex flex-col lg:flex-row items-start lg:space-x-6 mx-6">
            {/* Purchase Section */}
            {role !== 'admin' && role !== 'super_admin' && (
              <div className="flex flex-col lg:flex-row items-center bg-green-50 py-8 px-6 rounded-lg shadow w-full lg:w-1/2">
                <img
                  src={walletImage}
                  alt="Wallet Icon"
                  className="w-48 h-auto p-6 shadow-xl rounded-full bg-white"
                />
                <div className="text-left space-y-2 ml-6">
                  <h3 className="text-2xl text-green-500">Generate a New Privilege Card</h3>
                  <p className="text-sm text-gray-600 pb-4">
                    Click the button below to generate new Privilege cards.
                  </p>
                  <button
                    onClick={handlePrivilegeCardClick}
                    className="flex flex-row bg-green-500 items-center justify-center hover:bg-green-600 text-white px-5 py-2 rounded-lg transition"
                  >
                    <CreditCardIcon className="w-5 h-5 mr-1" /> Privilege Card
                  </button>
                </div>
              </div>
            )}

            {/* Work Order and Sales Order Generation Section */}
            {role !== 'admin' && role !== 'super_admin' && (
              <div className="flex flex-col lg:flex-row lg:space-x-6 mt-10 lg:mt-0 w-full lg:w-1/2">
                {/* Work Order Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full"
                  onClick={() => navigate('/work-order')}
                >
                  <WrenchScrewdriverIcon className='h-36 w-36 text-green-500' />
                  <h2 className="text-xl text-gray-800 mt-4">Work Order Generation</h2>
                </div>

                {/* Sales Order Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full mt-6 lg:mt-0"
                  onClick={() => navigate('/sales-order')}
                >
                  <TicketIcon className='h-36 w-36 text-green-500' />
                  <h2 className="text-xl text-gray-800 mt-4">Sales Order Generation</h2>
                </div>
              </div>
            )}

            


            {/* Reports and Stock Management Section */}
            {role !== 'employee' && (
              <div className="flex flex-col lg:flex-row lg:space-x-6 mt-10 lg:mt-0 w-full lg:w-1/2">
                {/* Reports Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full"
                  onClick={() => navigate('/reportgenerator')}
                >
                  <ClipboardDocumentIcon className='h-36 w-36 text-green-500 mr-2' />
                  <h2 className="text-xl text-gray-800 mt-4">Reports</h2>
                </div>

                {/* Stock Management Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full mt-6 lg:mt-0"
                  onClick={() => navigate('/stock-manage')}
                >
                  <CircleStackIcon className='h-36 w-36 text-green-500 mr-2' />
                  <h2 className="text-xl text-gray-800 mt-4">Stock Management</h2>
                </div>
              </div>
            )}

            {/* Super Admin Section */}
            {role === 'super_admin' && (
              <div className="flex flex-col lg:flex-row lg:space-x-6 mt-10 lg:mt-0 w-1/4 text-center">
                {/* Add New User Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full"
                  onClick={() => navigate('/signup')}
                >
                  <ClipboardDocumentIcon className='h-36 w-36 text-green-500 rounded-lg' />
                  <h2 className="text-xl text-gray-800 mt-4">Add New User</h2>
                </div>
              </div>
            )}

            {/* Reports and Stock Management Section */}
          {role === 'admin' && (
              <div className="flex flex-col w-1/2">
                {/* Reports Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-1/2"
                  onClick={() => navigate('/employee-stock-management')}
                >
                  <ArchiveBoxArrowDownIcon className='h-36 w-36 text-green-500 mr-2' />
                  <h2 className="text-xl text-gray-800 mt-4">Purchase Stock</h2>
                </div>
              </div>
            )}

            
          </div>

          {/* Reports and Stock Management Section */}
          {role === 'employee' && (
              <div className="flex flex-col px-6 w-1/2">
                {/* Reports Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-1/2"
                  onClick={() => navigate('/employee-stock-management')}
                >
                  <ArchiveBoxArrowDownIcon className='h-36 w-36 text-green-500 mr-2' />
                  <h2 className="text-xl text-gray-800 mt-4">Purchase Stock</h2>
                </div>
              </div>
            )}
          
        </div>
      )}

      {/* Pending Work Orders Modal */}
      {showWorkOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg w-11/12 md:w-3/4 lg:w-1/2 p-6 relative">
            {/* Close Button */}
            <button
              onClick={() => { setShowWorkOrdersModal(false); setSelectedWorkOrder(null); }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              aria-label="Close Modal"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            {/* Modal Content */}
            {!selectedWorkOrder ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Pending Work Orders</h2>
                {pendingWorkOrdersCount > 0 ? (
                  <div className="grid grid-cols-1 gap-4 max-h-60 overflow-y-auto">
                    {pendingWorkOrders.map((order) => (
                      <div key={order.work_order_id} className="bg-white shadow-md rounded-lg p-4 flex flex-col">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-green-500">{order.work_order_id}</h3>
                          <button
                            onClick={async () => {
                              const details = await fetchWorkOrderDetails(order.work_order_id);
                              if (details) setSelectedWorkOrder(details);
                            }}
                            className="text-blue-600 hover:underline"
                            aria-label={`View details for Work Order ${order.work_order_id}`}
                          >
                            View Details
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-2"><strong>Customer:</strong> {order.patient_details?.name || 'N/A'}</p>
                        <p className="text-sm text-gray-600"><strong>MR Number:</strong> {order.mr_number || 'N/A'}</p>
                      </div>
                    ))}
                  </div>

                ) : (
                  <p>No pending work orders.</p>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedWorkOrder(null)}
                  className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
                  aria-label="Back to Work Orders List"
                >
                  <ArrowLeftIcon className="h-5 w-5 mr-1" />
                  Back
                </button>
                <h2 className="text-xl font-semibold mb-4">Work Order Details</h2>
                {/* Display Work Order Details */}
                <div className="space-y-2 overflow-y-auto max-h-96">
                  <p><strong>Work Order ID:</strong> {selectedWorkOrder.work_order_id || 'N/A'}</p>
                  <p><strong>MR Number:</strong> {selectedWorkOrder.mr_number || 'N/A'}</p>
                  <p><strong>Customer Name:</strong> {selectedWorkOrder.patient_details?.name || 'N/A'}</p>
                  <p><strong>Due Date:</strong> {selectedWorkOrder.due_date || 'N/A'}</p>
                  <p><strong>Employee:</strong> {selectedWorkOrder.employee || 'N/A'}</p>
                  <p><strong>Payment Method:</strong> {selectedWorkOrder.payment_method || 'N/A'}</p>
                  <p><strong>Subtotal:</strong> ₹{selectedWorkOrder.subtotal?.toFixed(2) || '0.00'}</p>
                  <p><strong>Discount:</strong> {selectedWorkOrder.discount_percentage?.toFixed(2)}% (₹{selectedWorkOrder.discount_amount?.toFixed(2) || '0.00'})</p>
                  <p><strong>Discounted Subtotal:</strong> ₹{selectedWorkOrder.discounted_subtotal?.toFixed(2) || '0.00'}</p>
                  <p><strong>CGST (6%):</strong> ₹{selectedWorkOrder.cgst?.toFixed(2) || '0.00'}</p>
                  <p><strong>SGST (6%):</strong> ₹{selectedWorkOrder.sgst?.toFixed(2) || '0.00'}</p>
                  <p><strong>Total Amount:</strong> ₹{selectedWorkOrder.total_amount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Balance Due:</strong> ₹{(selectedWorkOrder.total_amount - parseFloat(selectedWorkOrder.advance_details || 0)).toFixed(2)}</p>

                  {/* Product Details */}
                  <div>
                    <h3 className="text-lg font-semibold mt-4">Product Details</h3>
                    {selectedWorkOrder.product_entries && selectedWorkOrder.product_entries.length > 0 ? (
                      <table className="min-w-full border-collapse border border-gray-200">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 border border-gray-200">Product Name</th>
                            <th className="px-4 py-2 border border-gray-200">Quantity</th>
                            <th className="px-4 py-2 border border-gray-200">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedWorkOrder.product_entries.map((product, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 border border-gray-200">{product.name || 'N/A'}</td>
                              <td className="px-4 py-2 border border-gray-200">{product.quantity || 'N/A'}</td>
                              <td className="px-4 py-2 border border-gray-200">₹{product.price?.toFixed(2) || '0.00'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No product details available.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sales Today Modal */}
      {showSalesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg w-11/12 md:w-3/4 lg:w-1/2 p-6 relative">
            {/* Close Button */}
            <button
              onClick={() => { setShowSalesModal(false); setSelectedSalesOrder(null); }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              aria-label="Close Modal"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            {/* Modal Content */}
            {!selectedSalesOrder ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Sales Orders Today</h2>
                {salesTodayCount > 0 ? (
                  <div className="grid grid-cols-1 gap-4 max-h-60 overflow-y-auto">
                    {salesOrdersToday.map((order) => (
                      <div key={order.sales_order_id} className="bg-white shadow-md rounded-lg p-4 flex flex-col">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-green-500">{order.sales_order_id}</h3>
                          <button
                            onClick={async () => {
                              const details = await fetchSalesOrderDetails(order.sales_order_id);
                              if (details) setSelectedSalesOrder(details);
                            }}
                            className="text-blue-600 hover:underline"
                            aria-label={`View details for Sales Order ${order.sales_order_id}`}
                          >
                            View Details
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-2"><strong>Customer Phone:</strong> {order.patient_phone || 'N/A'}</p>
                        <p className="text-sm text-gray-600"><strong>MR Number:</strong> {order.mr_number || 'N/A'}</p>
                      </div>
                    ))}
                  </div>


                ) : (
                  <p>No sales orders today.</p>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedSalesOrder(null)}
                  className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
                  aria-label="Back to Sales Orders List"
                >
                  <ArrowLeftIcon className="h-5 w-5 mr-1" />
                  Back
                </button>
                <h2 className="text-xl font-semibold mb-4">Sales Order Details</h2>
                {/* Display Sales Order Details */}
                <div className="space-y-2 overflow-y-auto max-h-96">
                  <p><strong>Sales Order ID:</strong> {selectedSalesOrder.sales_order_id || 'N/A'}</p>
                  <p><strong>MR Number:</strong> {selectedSalesOrder.mr_number || 'N/A'}</p>
                  <p><strong>Customer Phone:</strong> {selectedSalesOrder.patient_phone || 'N/A'}</p>
                  <p><strong>Branch:</strong> {selectedSalesOrder.branch || 'N/A'}</p>
                  <p><strong>Created At:</strong> {selectedSalesOrder.created_at || 'N/A'}</p>
                  <p><strong>Subtotal:</strong> ₹{selectedSalesOrder.subtotal?.toFixed(2) || '0.00'}</p>
                  <p><strong>Discount:</strong> {selectedSalesOrder.discount?.toFixed(2)}% (₹{selectedSalesOrder.discount_amount?.toFixed(2) || '0.00'})</p>
                  <p><strong>Final Amount:</strong> ₹{selectedSalesOrder.final_amount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Loyalty Points Redeemed:</strong> {selectedSalesOrder.loyalty_points_redeemed || 0}</p>
                  <p><strong>Loyalty Points Added:</strong> {selectedSalesOrder.loyalty_points_added || 0}</p>
                  <p><strong>CGST (6%):</strong> ₹{selectedSalesOrder.cgst?.toFixed(2) || '0.00'}</p>
                  <p><strong>SGST (6%):</strong> ₹{selectedSalesOrder.sgst?.toFixed(2) || '0.00'}</p>
                  <p><strong>Total Amount:</strong> ₹{selectedSalesOrder.total_amount?.toFixed(2) || '0.00'}</p>
                  <p><strong>Balance Due:</strong> ₹{(selectedSalesOrder.total_amount - parseFloat(selectedSalesOrder.advance_details || 0)).toFixed(2)}</p>

                  {/* Product Details */}
                  <div>
                    <h3 className="text-lg font-semibold mt-4">Product Details</h3>
                    {selectedSalesOrder.items && selectedSalesOrder.items.length > 0 ? (
                      <table className="min-w-full border-collapse border border-gray-200">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 border border-gray-200">Product Name</th>
                            <th className="px-4 py-2 border border-gray-200">Quantity</th>
                            <th className="px-4 py-2 border border-gray-200">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSalesOrder.items.map((product, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 border border-gray-200">{product.name || 'N/A'}</td>
                              <td className="px-4 py-2 border border-gray-200">{product.quantity || 'N/A'}</td>
                              <td className="px-4 py-2 border border-gray-200">₹{product.price?.toFixed(2) || '0.00'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>No product details available.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

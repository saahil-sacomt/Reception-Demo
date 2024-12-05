// client/src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
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
  ArchiveBoxArrowDownIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import supabase from '../supabaseClient';
import { useGlobalState } from "../context/GlobalStateContext";

const Home = ({ isCollapsed }) => {
  // Access Global State
  const { state, dispatch } = useGlobalState();
  const { modals, selectedWorkOrder, selectedSalesOrder } = state;
  const { showWorkOrdersModal, showSalesModal } = modals;

  // Other State Variables
  const [showSplash, setShowSplash] = useState(sessionStorage.getItem('showSplash') === 'true');
  const navigate = useNavigate();
  const { user, name, role, branch } = useAuth();
  const [actionRequests, setActionRequests] = useState([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingWorkOrdersCount, setPendingWorkOrdersCount] = useState(0);
  const [salesTodayCount, setSalesTodayCount] = useState(0);

  // Search State Variables
  const [workOrderSearchTerm, setWorkOrderSearchTerm] = useState('');
  const [salesOrderSearchTerm, setSalesOrderSearchTerm] = useState('');
  const [filteredWorkOrders, setFilteredWorkOrders] = useState([]);
  const [filteredSalesOrders, setFilteredSalesOrders] = useState([]);

  // Utility function to format dates as dd/mm/yyyy
  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

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

  // Function to open the Work Orders Modal
  const openWorkOrdersModal = () => {
    dispatch({
      type: "SET_MODAL_STATE",
      payload: { showWorkOrdersModal: true },
    });
  };

  // Function to close the Work Orders Modal
  const closeWorkOrdersModal = () => {
    dispatch({
      type: "SET_MODAL_STATE",
      payload: { showWorkOrdersModal: false },
    });
    dispatch({ type: "RESET_SELECTED_WORK_ORDER" }); // Reset selected work order
    setWorkOrderSearchTerm(''); // Clear search term
    setFilteredWorkOrders([]); // Clear filtered results
  };

  // Function to open the Sales Modal
  const openSalesModal = () => {
    dispatch({
      type: "SET_MODAL_STATE",
      payload: { showSalesModal: true },
    });
  };

  // Function to close the Sales Modal
  const closeSalesModal = () => {
    dispatch({
      type: "SET_MODAL_STATE",
      payload: { showSalesModal: false },
    });
    dispatch({ type: "RESET_SELECTED_SALES_ORDER" }); // Reset selected sales order
    setSalesOrderSearchTerm(''); // Clear search term
    setFilteredSalesOrders([]); // Clear filtered results
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
    navigate('/privilege-generation');
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
      dispatch({ type: "SET_PENDING_WORK_ORDERS", payload: data });
      dispatch({ type: "SET_PENDING_WORK_ORDERS_COUNT", payload: data.length });
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
      dispatch({ type: "SET_SALES_ORDERS_TODAY", payload: data });
      dispatch({ type: "SET_SALES_TODAY_COUNT", payload: data.length });
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

  // **Modified: Fetch sales order details along with customer/patient details**
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

    let customerDetails = {};

    if (data.mr_number) {
      // Fetch patient details
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('name, age, gender, address')
        .eq('mr_number', data.mr_number)
        .single();

      if (!patientError && patientData) {
        customerDetails = {
          name: patientData.name,
          age: patientData.age,
          gender: patientData.gender,
          address: patientData.address,
        };
      } else {
        console.error("Error fetching patient details:", patientError.message);
        customerDetails = {
          name: 'N/A',
          age: 'N/A',
          gender: 'N/A',
          address: 'N/A',
        };
      }
    } else if (data.customer_id) {
      // Fetch customer details
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('name, age, gender, address')
        .eq('customer_id', data.customer_id)
        .single();

      if (!customerError && customerData) {
        customerDetails = {
          name: customerData.name,
          age: customerData.age,
          gender: customerData.gender,
          address: customerData.address,
        };
      } else {
        console.error("Error fetching customer details:", customerError.message);
        customerDetails = {
          name: 'N/A',
          age: 'N/A',
          gender: 'N/A',
          address: 'N/A',
        };
      }
    } else {
      customerDetails = {
        name: 'N/A',
        age: 'N/A',
        gender: 'N/A',
        address: 'N/A',
      };
    }

    return { ...data, customerDetails };
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

  // Real-Time Subscriptions for Dynamic Count Updates (Supabase v2)
  useEffect(() => {
    // Function to set up real-time subscriptions for admin
    const setupAdminSubscriptions = () => {
      if (role !== 'admin') return;

      const modificationRequestsSubscription = supabase
        .channel('public:modification_requests')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'modification_requests' },
          payload => {
            if (payload.new.status === 'pending') {
              if (payload.eventType === 'INSERT') {
                setPendingRequestsCount(prev => prev + 1);
              } else if (payload.eventType === 'UPDATE') {
                if (payload.old.status !== 'pending') {
                  setPendingRequestsCount(prev => prev + 1);
                } else if (payload.new.status !== 'pending') {
                  setPendingRequestsCount(prev => Math.max(prev - 1, 0));
                }
              } else if (payload.eventType === 'DELETE') {
                setPendingRequestsCount(prev => Math.max(prev - 1, 0));
              }
            }
          }
        )
        .subscribe();

      return modificationRequestsSubscription;
    };

    // Function to set up real-time subscriptions for work_orders
    const setupWorkOrdersSubscriptions = () => {
      if (!branch) return;

      const workOrdersSubscription = supabase
        .channel('public:work_orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'work_orders' },
          payload => {
            const today = getTodayDate();
            const isDueTodayOrFuture = (date) => date >= today;

            if (isDueTodayOrFuture(payload.new?.due_date || payload.old?.due_date)) {
              if (payload.eventType === 'INSERT') {
                setPendingWorkOrdersCount(prev => prev + 1);
              } else if (payload.eventType === 'UPDATE') {
                const wasDue = isDueTodayOrFuture(payload.old.due_date);
                const isDue = isDueTodayOrFuture(payload.new.due_date);
                if (!wasDue && isDue) {
                  setPendingWorkOrdersCount(prev => prev + 1);
                } else if (wasDue && !isDue) {
                  setPendingWorkOrdersCount(prev => Math.max(prev - 1, 0));
                }
              } else if (payload.eventType === 'DELETE') {
                setPendingWorkOrdersCount(prev => Math.max(prev - 1, 0));
              }
            }
          }
        )
        .subscribe();

      return workOrdersSubscription;
    };

    // Function to set up real-time subscriptions for sales_orders
    const setupSalesOrdersSubscriptions = () => {
      if (!branch) return;

      const salesOrdersSubscription = supabase
        .channel('public:sales_orders')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sales_orders' },
          payload => {
            const today = getTodayDate();
            const isCreatedToday = (date) => date >= today;

            if (isCreatedToday(payload.new?.created_at || payload.old?.created_at)) {
              if (payload.eventType === 'INSERT') {
                setSalesTodayCount(prev => prev + 1);
              } else if (payload.eventType === 'UPDATE') {
                const wasCreatedToday = isCreatedToday(payload.old.created_at);
                const isCreatedNow = isCreatedToday(payload.new.created_at);
                if (!wasCreatedToday && isCreatedNow) {
                  setSalesTodayCount(prev => prev + 1);
                } else if (wasCreatedToday && !isCreatedNow) {
                  setSalesTodayCount(prev => Math.max(prev - 1, 0));
                }
              } else if (payload.eventType === 'DELETE') {
                setSalesTodayCount(prev => Math.max(prev - 1, 0));
              }
            }
          }
        )
        .subscribe();

      return salesOrdersSubscription;
    };

    // Initialize Subscriptions
    const adminSubscription = setupAdminSubscriptions();
    const workOrdersSubscription = setupWorkOrdersSubscriptions();
    const salesOrdersSubscription = setupSalesOrdersSubscriptions();

    // Cleanup Subscriptions on Unmount
    return () => {
      if (adminSubscription) {
        supabase.removeChannel(adminSubscription);
      }
      if (workOrdersSubscription) {
        supabase.removeChannel(workOrdersSubscription);
      }
      if (salesOrdersSubscription) {
        supabase.removeChannel(salesOrdersSubscription);
      }
    };
  }, [role, branch]);

  // Initial Fetch and Real-Time Updates for Admin and Employee
  useEffect(() => {
    if (user) {
      fetchApprovedRequests();
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

  // Handle Splash Screen Timeout
  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.removeItem('showSplash'); // Clear flag after splash screen
      }, 2000); // Duration matches animation
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  // Navigate to employee action-required page
  const handleEmployeeActionClick = () => {
    if (role === 'employee') {
      navigate('/employee/action-required');
    }
  };

  // Define role-based welcome messages
  const getWelcomeMessage = () => {
    const welcomeMessages = {
      admin: `Welcome Accounts Admin`,
      employee: `Welcome, Opticals Trivandrum`,
      super_admin: `Welcome Ashad Sivaraman`,
      // Add more roles and their corresponding messages here
    };

    return welcomeMessages[role] || `Welcome, ${name || 'User'}!`;
  };

  // Search Handlers
  const handleWorkOrderSearch = async () => {
    if (!branch) return;

    if (workOrderSearchTerm.trim() === '') {
      alert('Please enter a search term.');
      return;
    }

    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('branch', branch)
      .or(`work_order_id.ilike.%${workOrderSearchTerm}%,patient_details->>name.ilike.%${workOrderSearchTerm}%`);

    if (!error) {
      if (data && data.length > 0) {
        setFilteredWorkOrders(data);
      } else {
        setFilteredWorkOrders([]); // Clear previous results
        alert('No work orders found matching your search criteria.');
      }
    } else {
      console.error("Error searching work orders:", error.message);
      alert('An error occurred while searching work orders.');
    }
  };

  const handleSalesOrderSearch = async () => {
    if (!branch) return;

    if (salesOrderSearchTerm.trim() === '') {
      alert('Please enter a search term.');
      return;
    }

    const { data, error } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('branch', branch)
      .or(`sales_order_id.ilike.%${salesOrderSearchTerm}%,patient_phone.ilike.%${salesOrderSearchTerm}%`);

    if (!error) {
      if (data && data.length > 0) {
        setFilteredSalesOrders(data);
      } else {
        setFilteredSalesOrders([]); // Clear previous results
        alert('No sales orders found matching your search criteria.');
      }
    } else {
      console.error("Error searching sales orders:", error.message);
      alert('An error occurred while searching sales orders.');
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
                {getWelcomeMessage()}
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
                onClick={openWorkOrdersModal}
              >
                <p className="text-3xl font-semibold text-green-500">{state.pendingWorkOrdersCount}</p>
                <p className="text-xs text-gray-600 py-2">Pending Work Orders</p>
              </div>

              {/* Sales Today */}
              <div
                className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer"
                onClick={openSalesModal}
              >
                <p className="text-3xl font-semibold text-green-500">{state.salesTodayCount}</p>
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

            {/* Reports and Stock Management Section for Admin */}
            {role === 'admin' && (
              <div className="flex flex-col lg:flex-row lg:space-x-6 mt-10 lg:mt-0 w-full lg:w-1/2">
                {/* Purchase Stock Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-1/2"
                  onClick={() => navigate('/employee-stock-management')}
                >
                  <ArchiveBoxArrowDownIcon className='h-36 w-36 text-green-500 mr-2' />
                  <h2 className="text-xl text-gray-800 mt-4">Purchase Stock</h2>
                </div>
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-1/2 mt-6 lg:mt-0"
                  onClick={() => navigate('/notes')}
                >
                  <BanknotesIcon className='h-36 w-36 text-green-500 mr-2' />
                  <h2 className="text-xl text-gray-800 mt-4">Credit and Debit Notes</h2>
                </div>
              </div>
            )}
          </div>
          {/* Reports and Stock Management Section for Employee */}
          {role === 'employee' && (
            <div className="flex flex-col lg:flex-row lg:space-x-6 mt-10 px-6 lg:mt-0 w-full lg:w-full">
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
                onClick={() => navigate('/employee-stock-management')}
              >
                <ArchiveBoxArrowDownIcon className='h-36 w-36 text-green-500 mr-2' />
                <h2 className="text-xl text-gray-800 mt-4">Purchase Section</h2>
              </div>
              {/* Stock Management Container */}
              <div
                className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full mt-6 lg:mt-0"
                onClick={() => navigate('/notes')}
              >
                <BanknotesIcon className='h-36 w-36 text-green-500 mr-2' />
                <h2 className="text-xl text-gray-800 mt-4">Credit and Debit Notes</h2>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Work Orders Modal */}
      {showWorkOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg w-11/12 md:w-3/4 lg:w-2/3 p-6 relative overflow-y-auto h-5/6">
            {/* Close Button */}
            <button
              onClick={closeWorkOrdersModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 print:hidden"
              aria-label="Close Modal"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            {/* Modal Content */}
            {!selectedWorkOrder ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Pending Work Orders</h2>

                {/* Search Section */}
                <div className="flex items-center mb-4">
                  <input
                    type="text"
                    value={workOrderSearchTerm}
                    onChange={(e) => setWorkOrderSearchTerm(e.target.value)}
                    placeholder="Search by Work Order ID"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none"
                  />
                  <button
                    onClick={handleWorkOrderSearch}
                    className="bg-green-500 text-white px-4 py-2 rounded-r-lg hover:bg-green-600 flex items-center"
                  >
                    <MagnifyingGlassIcon className="h-5 w-5 mr-1" />
                    Search
                  </button>
                </div>

                {/* Clear Search Button */}
                {(filteredWorkOrders.length > 0 || workOrderSearchTerm !== '') && (
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => {
                        setFilteredWorkOrders([]);
                        setWorkOrderSearchTerm('');
                      }}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center"
                    >
                      Clear Search
                    </button>
                  </div>
                )}

                {/* Work Orders List */}
                {filteredWorkOrders.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                    {filteredWorkOrders.map((order) => (
                      <div key={order.work_order_id} className="bg-white rounded-lg p-4 flex flex-col">
                        <div className="flex justify-between items-center">
                          {/* **Modified: Header with Order ID on Left and Date on Right** */}
                          <div className="flex flex-col">
                            <h3 className="text-lg font-semibold text-green-500">{order.work_order_id}</h3>
                            <p className="text-sm text-gray-500">Date: {formatDate(order.created_at)}</p>
                          </div>
                          <button
                            onClick={async () => {
                              const details = await fetchWorkOrderDetails(order.work_order_id);
                              if (details) dispatch({ type: "SET_SELECTED_WORK_ORDER", payload: details });
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
                  <div>
                    {workOrderSearchTerm.trim() !== '' ? (
                      <p>No work orders found matching your search criteria.</p>
                    ) : (
                      state.pendingWorkOrdersCount > 0 ? (
                        <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                          {state.pendingWorkOrders.map((order) => (
                            <div key={order.work_order_id} className="bg-white shadow-md rounded-lg p-4 flex flex-col">
                              <div className="flex justify-between items-center">
                                {/* **Modified: Header with Order ID on Left and Date on Right** */}
                                <div className="flex flex-col">
                                  <h3 className="text-lg font-semibold text-green-500">{order.work_order_id}</h3>
                                  <p className="text-sm text-gray-500">Date: {formatDate(order.created_at)}</p>
                                </div>
                                <button
                                  onClick={async () => {
                                    const details = await fetchWorkOrderDetails(order.work_order_id);
                                    if (details) dispatch({ type: "SET_SELECTED_WORK_ORDER", payload: details });
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
                      )
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* If a work order is selected, show its details */}
                <div className="bg-white rounded-lg text-gray-800 print:p-0 print:m-0">
                  <div className="printable-area bg-white p-6 print:w-full print:p-0 print:m-0">
                    {/* Header Information */}
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex justify-between w-full">
                        <h2 className="text-xl font-semibold">Work Order</h2>
                        {/* **Modified: Date and Order ID on the Right Side** */}
                        <div className="text-right">
                          <p className="text-sm ">
                            Date: <strong>{formatDate(selectedWorkOrder.created_at)}</strong>
                          </p>
                          <p className="text-sm ">
                            Work Order No: <strong>{selectedWorkOrder.work_order_id || 'N/A'}</strong>
                          </p>
                          {selectedWorkOrder.mr_number && (
                            <p className="text-sm ">
                              MR Number: <strong>{selectedWorkOrder.mr_number}</strong>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* **Modified: Customer Details Arranged in Two Columns** */}
                    <div className="mb-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left Column */}
                        <div>
                          <p>
                            <span className="font-medium">Name:</span>{" "}
                            <strong>
                              {selectedWorkOrder.mr_number
                                ? `${selectedWorkOrder.patient_details?.name || "N/A"} |  ${selectedWorkOrder.patient_details?.age || "N/A"} |  ${selectedWorkOrder.patient_details?.gender || "N/A"}`
                                : `${selectedWorkOrder.patient_details?.name || "N/A"} |  ${selectedWorkOrder.patient_details?.age || "N/A"} |  ${selectedWorkOrder.patient_details?.gender || "N/A"}`}
                            </strong>
                          </p>
                          <p>
                            <span className="font-medium">Address:</span>{" "}
                            <strong>
                              {selectedWorkOrder.mr_number
                                ? selectedWorkOrder.patient_details?.address || "N/A"
                                : selectedWorkOrder.patient_details?.address || "N/A"}
                            </strong>
                          </p>
                          <p>
                            <span className="font-medium">Phone:</span>{" "}
                            <strong>
                              {selectedWorkOrder.mr_number
                                ? selectedWorkOrder.patient_details?.phone_number || "N/A"
                                : selectedWorkOrder.patient_details?.phone_number || "N/A"}
                            </strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Product Table */}
                    <div className=" mb-8">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-green-100">
                            <th className="px-4 py-2 border text-left">#</th>
                            <th className="px-4 py-2 border text-left">Product ID</th>
                            <th className="px-4 py-2 border text-left">Product Name</th>
                            <th className="px-4 py-2 border text-left">HSN Code</th>
                            <th className="px-4 py-2 border text-right">Price (₹)</th>
                            <th className="px-4 py-2 border text-right">Quantity</th>
                            <th className="px-4 py-2 border text-right">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedWorkOrder.product_entries.map((product, index) => {
                            const price = parseFloat(product.price) || 0;
                            const quantity = parseInt(product.quantity) || 0;
                            const total = price * quantity;
                            return (
                              <tr key={index} className="">
                                <td className="px-4 py-2 border">{index + 1}</td>
                                <td className="px-4 py-2 border">{product.product_id || "N/A"}</td>
                                <td className="px-4 py-2 border">{product.product_name || "N/A"}</td>
                                <td className="px-4 py-2 border">{product.hsn_code || "N/A"}</td>
                                <td className="px-4 py-2 border text-right">₹{price.toFixed(2)}</td>
                                <td className="px-4 py-2 border text-right">{quantity}</td>
                                <td className="px-4 py-2 border text-right">₹{total.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* **Modified: Financial Summary Arranged in Two Columns** */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                      {/* Left Column */}
                      <div>
                        <p>
                          <span className="font-medium">Amount After Discount:</span>{" "}
                          <strong>₹{selectedWorkOrder.subtotal?.toFixed(2) || '0.00'}</strong>
                        </p>
                        <p>
                          <span className="font-medium">CGST (6%):</span>{" "}
                          <strong>₹{selectedWorkOrder.cgst?.toFixed(2) || '0.00'}</strong>
                        </p>
                        <p>
                          <span className="font-medium">SGST (6%):</span>{" "}
                          <strong>₹{selectedWorkOrder.sgst?.toFixed(2) || '0.00'}</strong>
                        </p>
                        <p>
                          <span className="font-medium">Payment Method:</span>{" "}
                          <strong>
                            {selectedWorkOrder.payment_method
                              ? `${selectedWorkOrder.payment_method.charAt(0).toUpperCase()}${selectedWorkOrder.payment_method.slice(1)}`
                              : 'N/A'}
                          </strong>
                        </p>
                      </div>
                      {/* Right Column */}
                      <div className="text-right">
                        <p>
                          <span className="font-medium">Advance Paid:</span>{" "}
                          <strong>₹{parseFloat(selectedWorkOrder.advance_details || 0).toFixed(2)}</strong>
                        </p>
                        <p className="text-lg">
                          <span className="font-medium">Total Amount (Incl. GST):</span>{" "}
                          <strong>₹{selectedWorkOrder.discounted_subtotal?.toFixed(2) || '0.00'}</strong>
                        </p>
                        <p className="text-lg">
                          <span className="font-medium">Amount Due:</span>{" "}
                          <strong>
                            ₹{(selectedWorkOrder.discounted_subtotal - parseFloat(selectedWorkOrder.advance_details || 0)).toFixed(2)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mb-8">
                      <h3 className="text-xl print:text-sm font-semibold">Terms and Conditions</h3>
                      <ol className="list-decimal list-inside mt-2 text-sm text-gray-600 space-y-1 print:text-xs">
                        <li>Work order valid only for two months.</li>
                        <li>Branded Frames/Lenses – 12 Months warranty for manufacturing defects/peeling off.</li>
                      </ol>
                    </div>

                    {/* Billed By */}
                    <div className="mt-8">
                      <p>
                        <span className="font-medium">Billed by:</span>{" "}
                        <strong>{selectedWorkOrder.employee || "N/A"}</strong>
                      </p>
                    </div>

                    {/* **Modified: Action Buttons Hidden During Print** */}
                    <div className="flex justify-end space-x-4 mt-8 print:hidden">
                      <button
                        onClick={() => dispatch({ type: "RESET_SELECTED_WORK_ORDER" })}
                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 flex items-center"
                      >
                        <ArrowLeftIcon className="h-5 w-5 mr-1" />
                        Back
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center"
                      >
                        <PrinterIcon className="h-5 w-5 mr-1" />
                        Print
                      </button>
                    </div>
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
          <div className="bg-white rounded-lg w-11/12 md:w-3/4 lg:w-2/3 p-6 relative overflow-y-auto h-5/6">
            {/* Close Button */}
            <button
              onClick={closeSalesModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 print:hidden"
              aria-label="Close Modal"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>

            {/* Modal Content */}
            {!selectedSalesOrder ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Sales Orders Today</h2>

                {/* Search Section */}
                <div className="flex items-center mb-4">
                  <input
                    type="text"
                    value={salesOrderSearchTerm}
                    onChange={(e) => setSalesOrderSearchTerm(e.target.value)}
                    placeholder="Search by Sales Order ID"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none"
                  />
                  <button
                    onClick={handleSalesOrderSearch}
                    className="bg-green-500 text-white px-4 py-2 rounded-r-lg hover:bg-green-600 flex items-center"
                  >
                    <MagnifyingGlassIcon className="h-5 w-5 mr-1" />
                    Search
                  </button>
                </div>

                {/* Clear Search Button */}
                {(filteredSalesOrders.length > 0 || salesOrderSearchTerm !== '') && (
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => {
                        setFilteredSalesOrders([]);
                        setSalesOrderSearchTerm('');
                      }}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center"
                    >
                      Clear Search
                    </button>
                  </div>
                )}

                {/* Sales Orders List */}
                {filteredSalesOrders.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                    {filteredSalesOrders.map((order) => (
                      <div key={order.sales_order_id} className="bg-white shadow-md rounded-lg p-4 flex flex-col">
                        <div className="flex justify-between items-center">
                          {/* **Modified: Header with Order ID on Left and Date on Right** */}
                          <div className="flex flex-col">
                            <h3 className="text-lg font-semibold text-green-500">{order.sales_order_id}</h3>
                            <p className="text-sm text-gray-500">Date: {formatDate(order.created_at)}</p>
                          </div>
                          <button
                            onClick={async () => {
                              const details = await fetchSalesOrderDetails(order.sales_order_id);
                              if (details) dispatch({ type: "SET_SELECTED_SALES_ORDER", payload: details });
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
                  <div>
                    {salesOrderSearchTerm.trim() !== '' ? (
                      <p>No sales orders found matching your search criteria.</p>
                    ) : (
                      state.salesTodayCount > 0 ? (
                        <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                          {state.salesOrdersToday.map((order) => (
                            <div key={order.sales_order_id} className="bg-white shadow-md rounded-lg p-4 flex flex-col">
                              <div className="flex justify-between items-center">
                                {/* **Modified: Header with Order ID on Left and Date on Right** */}
                                <div className="flex flex-col">
                                  <h3 className="text-lg font-semibold text-green-500">{order.sales_order_id}</h3>
                                  <p className="text-sm text-gray-500">Date: {formatDate(order.created_at)}</p>
                                </div>
                                <button
                                  onClick={async () => {
                                    const details = await fetchSalesOrderDetails(order.sales_order_id);
                                    if (details) dispatch({ type: "SET_SELECTED_SALES_ORDER", payload: details });
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
                      )
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* If a sales order is selected, show its details */}
                <div className="bg-white rounded-lg text-gray-800 print:p-0 print:m-0">
                  <div className="printable-area bg-white p-6 print:w-full print:p-0 print:m-0">
                    {/* Header Information */}
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex justify-between w-full">
                        <h2 className="text-3xl font-bold">Tax Invoice</h2>
                        {/* **Modified: Date and Order ID on the Right Side** */}
                        <div className="text-right">
                          <p className="text-sm ">
                            Date: <strong>{formatDate(selectedSalesOrder.created_at)}</strong>
                          </p>
                          <p className="text-sm ">
                            Sales Order No: <strong>{selectedSalesOrder.sales_order_id || 'N/A'}</strong>
                          </p>
                          {selectedSalesOrder.mr_number && (
                            <p className="text-sm ">
                              MR Number: <strong>{selectedSalesOrder.mr_number}</strong>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* **Modified: Customer Details Arranged in Two Columns** */}
                    <div className="mb-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left Column */}
                        <div>
                          <p>
                            <span className="font-medium">Name:</span>{" "}
                            <strong>
                              {selectedSalesOrder.mr_number
                                ? `${selectedSalesOrder.customerDetails?.name || "N/A"} |  ${selectedSalesOrder.customerDetails?.age || "N/A"} |  ${selectedSalesOrder.customerDetails?.gender || "N/A"}`
                                : `${selectedSalesOrder.customerDetails?.name || "N/A"} |  ${selectedSalesOrder.customerDetails?.age || "N/A"} |  ${selectedSalesOrder.customerDetails?.gender || "N/A"}`}
                            </strong>
                          </p>
                          <p>
                            <span className="font-medium">Address:</span>{" "}
                            <strong>
                              {selectedSalesOrder.mr_number
                                ? selectedSalesOrder.customerDetails?.address || "N/A"
                                : selectedSalesOrder.customerDetails?.address || "N/A"}
                            </strong>
                          </p>
                          <p>
                            <span className="font-medium">Phone:</span>{" "}
                            <strong>
                              {selectedSalesOrder.mr_number
                                ? selectedSalesOrder.patient_phone || "N/A"
                                : selectedSalesOrder.patient_phone || "N/A"}
                            </strong>
                          </p>
                        </div>
                        {/* Right Column */}
                        <div>
                          
                        </div>
                      </div>
                    </div>

                    {/* Product Table */}
                    <div className="overflow-x-auto mb-8 text-sm">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="bg-green-100">
                            <th className="px-4 py-2 border text-left">#</th>
                            <th className="px-4 py-2 border text-left">Product ID</th>
                            <th className="px-4 py-2 border text-left">Product Name</th>
                            <th className="px-4 py-2 border text-left">HSN Code</th>
                            <th className="px-4 py-2 border text-right">Price (₹)</th>
                            <th className="px-4 py-2 border text-right">Quantity</th>
                            <th className="px-4 py-2 border text-right">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSalesOrder.items.map((product, index) => {
                            const price = parseFloat(product.price) || 0;
                            const quantity = parseInt(product.quantity) || 0;
                            const total = price * quantity;
                            return (
                              <tr key={index} className="">
                                <td className="px-4 py-2 border">{index + 1}</td>
                                <td className="px-4 py-2 border">{product.product_id || "N/A"}</td>
                                <td className="px-4 py-2 border">{product.name || "N/A"}</td>
                                <td className="px-4 py-2 border">{product.hsn_code || "N/A"}</td>
                                <td className="px-4 py-2 border text-right">₹{price.toFixed(2)}</td>
                                <td className="px-4 py-2 border text-right">{quantity}</td>
                                <td className="px-4 py-2 border text-right">₹{total.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* **Modified: Financial Summary Arranged in Two Columns** */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                      {/* Left Column */}
                      <div>
                        <p>
                          <span className="font-medium">Amount After Discount:</span>{" "}
                          <strong>₹{selectedSalesOrder.subtotal?.toFixed(2) || '0.00'}</strong>
                        </p>
                        <p>
                          <span className="font-medium">CGST (6%):</span>{" "}
                          <strong>₹{selectedSalesOrder.cgst?.toFixed(2) || '0.00'}</strong>
                        </p>
                        <p>
                          <span className="font-medium">SGST (6%):</span>{" "}
                          <strong>₹{selectedSalesOrder.sgst?.toFixed(2) || '0.00'}</strong>
                        </p>
                        <p>
                          <span className="font-medium">Payment Method:</span>{" "}
                          <strong>
                            {selectedSalesOrder.payment_method
                              ? `${selectedSalesOrder.payment_method.charAt(0).toUpperCase()}${selectedSalesOrder.payment_method.slice(1)}`
                              : 'N/A'}
                          </strong>
                        </p>
                      </div>
                      {/* Right Column */}
                      <div className="text-right">
                        <p>
                          <span className="font-medium">Advance Paid:</span>{" "}
                          <strong>₹{parseFloat(selectedSalesOrder.advance_details || 0).toFixed(2)}</strong>
                        </p>
                        <p className="text-lg">
                          <span className="font-medium">Total Amount (Incl. GST):</span>{" "}
                          <strong>₹{selectedSalesOrder.total_amount?.toFixed(2) || '0.00'}</strong>
                        </p>
                        <p className="text-lg">
                          <span className="font-medium">Amount Due:</span>{" "}
                          <strong>
                            ₹{(selectedSalesOrder.final_amount || 0).toFixed(2)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mb-8">
                      <h3 className="text-xl font-semibold print:text-sm">Terms and Conditions</h3>
                      <ol className="list-decimal list-inside mt-2 text-sm text-gray-600 space-y-1 print:text-xs">
                        <li>Work order valid only for two months.</li>
                        <li>Branded Frames/Lenses – 12 Months warranty for manufacturing defects/peeling off.</li>
                      </ol>
                    </div>

                    {/* Billed By */}
                    <div className="mt-8">
                      <p>
                        <span className="font-medium">Billed by:</span>{" "}
                        <strong>{selectedSalesOrder.employee || "N/A"}</strong>
                      </p>
                    </div>

                    {/* **Modified: Action Buttons Hidden During Print** */}
                    <div className="flex justify-end space-x-4 mt-8 print:hidden">
                      <button
                        onClick={() => dispatch({ type: "RESET_SELECTED_SALES_ORDER" })}
                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 flex items-center"
                      >
                        <ArrowLeftIcon className="h-5 w-5 mr-1" />
                        Back
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center"
                      >
                        <PrinterIcon className="h-5 w-5 mr-1" />
                        Print
                      </button>
                    </div>
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

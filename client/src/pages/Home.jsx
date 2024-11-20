// client/src/pages/Home.jsx
import { useState, useEffect } from 'react';
import SplashScreen from '../components/SplashScreen';
import walletImage from '../assets/pngwing.com.png';
import { CircleStackIcon, ClipboardDocumentIcon, CreditCardIcon, TicketIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import supabase from '../supabaseClient';

const Home = ({ isCollapsed }) => {
  const [showSplash, setShowSplash] = useState(sessionStorage.getItem('showSplash') === 'true');
  const navigate = useNavigate();
  const { user, name, loading, role ,branch } = useAuth();
  const [actionRequests, setActionRequests] = useState([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingWorkOrdersCount, setPendingWorkOrdersCount] = useState(0);
  const [salesTodayCount, setSalesTodayCount] = useState(0);

  // Fetch approved/rejected requests for the logged-in employee
  const fetchActionRequests = async () => {
    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('employee_id', user.id)
      .in('status', ['approved', 'rejected']); // Fetch both approved and rejected requests

    if (!error) {
      setActionRequests(data);
    }
  };

  const fetchApprovedRequests = async () => {
    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('employee_id', user.id)
      .eq('status', 'approved');

    if (!error) {
      setActionRequests(data);
    }
  };

  useEffect(() => {
    if (user) {
      fetchApprovedRequests();
    }
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

  const handlePrivilegeCardClick = () => {
    window.location.href = '/privilege-generation';
  };

  const fetchPendingWorkOrdersCount = async () => {
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('branch', branch)
      .select('id, due_date');

    if (!error && data) {
      // Filter work orders to include only those where due_date is in the future
      const futureWorkOrders = data.filter(order => order.due_date > today);
      setPendingWorkOrdersCount(futureWorkOrders.length);
    }
  };


  const fetchSalesTodayCount = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('sales_orders')
      .select('id')
      .eq('branch', branch)
      .gte('created_at', today);

    if (!error && data) {
      setSalesTodayCount(data.length);
    }
  };


  useEffect(() => {
    if (user) {
      fetchActionRequests();
      fetchPendingRequestsCount();
      fetchPendingWorkOrdersCount();
      fetchSalesTodayCount();
    }
  }, [user]);


  const fetchPendingRequestsCount = async () => {
    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('status', 'pending');

    if (!error) {
      return data.length;
    }
    return 0;
  };

  useEffect(() => {
    if (user && role === 'admin') {
      fetchPendingRequestsCount().then(count => setPendingRequestsCount(count));
    }
  }, [user, role]);



  useEffect(() => {
    if (user) {
      fetchActionRequests();
    }
  }, [user]);

  const acknowledgeRejection = async (requestId) => {
    const { error } = await supabase
      .from('modification_requests')
      .update({ status: 'acknowledged' })
      .eq('request_id', requestId);

    if (!error) {
      alert('Rejection acknowledged');
      fetchActionRequests(); // Refresh list
    }
  };

  // Fetch approved/rejected requests count for the logged-in employee
  const fetchEmployeeActionRequestsCount = async () => {
    const { data, error } = await supabase
      .from('modification_requests')
      .select('*')
      .eq('employee_id', user.id)
      .in('status', ['approved', 'rejected']);

    if (!error) {
      setActionRequests(data);
      return data.length;
    }
    return 0;
  };

  // Use Effect to fetch Employee Action Requests Count
  useEffect(() => {
    if (user && role === 'employee') {
      fetchEmployeeActionRequestsCount().then(count => setPendingRequestsCount(count));
    }
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
        <div className="space-y-10">
          <div className="space-y-10">
            {/* Welcome and Metrics Section */}
            <div className="bg-white p-6 flex flex-col md:flex-row justify-between items-center">
              {/* Welcome Message */}
              <div className="mb-4 md:mb-0">
                <h2 className="font-normal text-[25px] text-gray-800">{name ? `Welcome, ${name}` : 'Welcome, User'}</h2>
                <p className="text-sm text-gray-600">Send, track & manage your documents & Privilege cards.</p>
              </div>

              {/* Metrics Section */}
              <div className="bg-green-50 rounded-lg shadow flex overflow-hidden">
                <div className="bg-green-50 rounded-lg shadow flex overflow-hidden">
                  <div className="bg-green-50 rounded-lg  flex overflow-hidden">
                    {role === 'admin' ? (
                      <div
                        className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer"
                        onClick={() => navigate('/admin/action-required')}
                      >
                        <p className="text-3xl font-semibold text-green-500">{pendingRequestsCount}</p>
                        <p className="text-xs text-gray-600 py-2">Action Required</p>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer"
                        onClick={handleEmployeeActionClick}
                      >
                        <p className="text-3xl font-semibold text-green-500">{pendingRequestsCount}</p>
                        <p className="text-xs text-gray-600 py-2">Action Required</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer">
                    <p className="text-3xl font-semibold text-green-500">{pendingWorkOrdersCount}</p>
                    <p className="text-xs text-gray-600 py-2">Pending Work Orders</p>
                  </div>
                  <div className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer">
                    <p className="text-3xl font-semibold text-green-500">{salesTodayCount}</p>
                    <p className="text-xs text-gray-600 py-2">Sales Today</p>
                  </div>
                  <div className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer">
                    <p className="text-3xl font-semibold text-green-500">0</p>
                    <p className="text-xs text-gray-600 py-2">Failed</p> {/* Dummy count */}
                  </div>
                </div>

              </div>
            </div>

            {/* Purchase and Order Generation Sections (Horizontal Row) */}
            <div className="flex flex-col lg:flex-row items-start lg:space-x-6 mx-6">
              {/* Purchase Section */}
              {role !== 'admin' && role !== 'super_admin' &&(
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

              {/* Order Generation Section */}
              {role !== 'admin' && role !== 'super_admin' &&(
              <div className="flex flex-col lg:flex-row lg:space-x-6 mt-10 lg:mt-0 w-full lg:w-1/2">
                {/* Work Order Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full"
                  onClick={() => navigate('/work-order')}
                >
                  <WrenchScrewdriverIcon className='h-36 w-36 ml-3 text-green-500' /> 
                  <h2 className="text-xl text-gray-800 mt-4">Work Order Generation</h2>
                </div>

                {/* Sales Order Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full mt-6 lg:mt-0"
                  onClick={() => navigate('/sales-order')}
                >
                  <TicketIcon className='h-36 w-36 ml-3 text-green-500' /> 
                  <h2 className="text-xl text-gray-800 mt-4">Sales Order Generation</h2>
                </div>
              </div>
      )}

      {/* Order Generation Section */}
      {role !== 'employee'  &&(
              <div className="flex flex-col lg:flex-row lg:space-x-6 mt-10 lg:mt-0 w-full lg:w-1/2">
                {/* Work Order Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full"
                  onClick={() => navigate('/reportgenerator')}
                >
                  <ClipboardDocumentIcon className='h-36 w-36 text-green-500 mr-2' />
                  <h2 className="text-xl text-gray-800 mt-4">Reports</h2>
                </div>

                {/* Sales Order Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full mt-6 lg:mt-0"
                  onClick={() => navigate('/stock-manage')}
                >
                  <CircleStackIcon className='h-36 w-36 text-green-500 mr-2' />
                  <h2 className="text-xl text-gray-800 mt-4">Stock Management</h2>
                </div>
                
              </div>
      )}

      {role == 'super_admin'  &&(
              <div className="flex flex-col lg:flex-row lg:space-x-6 mt-10 lg:mt-0 w-1/4 text-center">
                {/* Work Order Container */}
                <div
                  className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full"
                  onClick={() => navigate('/signup')}
                >
                  <ClipboardDocumentIcon className='h-36 w-36 text-green-500 rounded-lg' />
                  <h2 className="text-xl text-gray-800 mt-4">Add New User</h2>
                </div>
                
                
              </div>
      )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

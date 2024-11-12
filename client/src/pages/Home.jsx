// client/src/pages/Home.jsx
import { useState, useEffect } from 'react';
import SplashScreen from '../components/SplashScreen';
import walletImage from '../assets/pngwing.com.png';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const Home = ({ isCollapsed }) => {
  const [showSplash, setShowSplash] = useState(sessionStorage.getItem('showSplash') === 'true');
  const navigate = useNavigate();

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
      <h2 className="font-normal text-[25px] text-gray-800">Welcome, Parvon Santhan</h2>
      <p className="text-sm text-gray-600">Send, track & manage your documents & Privilege cards.</p>
    </div>

    {/* Metrics Section */}
    <div className="bg-green-50 rounded-lg shadow flex overflow-hidden">
      {['Action Required', 'Pending Work Orders', 'Sales Today', 'Failed'].map((label, index) => (
        <div
          key={index}
          className="flex flex-col px-8 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer"
          style={{ borderRight: index !== 3 ? '2px solid #e5e7eb' : 'none' }}
        >
          <p className="text-3xl font-semibold text-gray-800">0</p>
          <p className="text-xs text-gray-600 py-2">{label}</p>
        </div>
      ))}
    </div>
  </div>

  {/* Purchase and Order Generation Sections (Horizontal Row) */}
  <div className="flex flex-col lg:flex-row items-start lg:space-x-6 mx-6">
    {/* Purchase Section */}
    <div className="flex flex-col lg:flex-row items-center bg-green-50 py-8 px-6 rounded-lg shadow w-full lg:w-1/2">
      <img
        src={walletImage}
        alt="Wallet Icon"
        className="w-48 h-auto p-6 shadow-xl rounded-full bg-white"
      />
      <div className="text-left space-y-2 ml-6">
        <h3 className="text-2xl text-gray-800">Generate a New Privilege Card</h3>
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

    {/* Order Generation Section */}
    <div className="flex flex-col lg:flex-row lg:space-x-6 mt-10 lg:mt-0 w-full lg:w-1/2">
      {/* Work Order Container */}
      <div
        className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full"
        onClick={() => navigate('/work-order')}
      >
        <img
          src="/work-order.png"
          alt="Work Order"
          className="w-40 h-40 object-contain bg-white rounded-xl shadow-xl"
        />
        <h2 className="text-xl text-gray-800 mt-4">Work Order Generation</h2>
      </div>

      {/* Sales Order Container */}
      <div
        className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 w-full mt-6 lg:mt-0"
        onClick={() => navigate('/sales-order')}
      >
        <img
          src="/sales-order.png"
          alt="Sales Order"
          className="w-40 h-40 object-contain bg-white rounded-xl shadow-xl"
        />
        <h2 className="text-xl text-gray-800 mt-4">Sales Order Generation</h2>
      </div>
    </div>
  </div>
</div>
        </div>
      )}
    </div>
  );
};

export default Home;

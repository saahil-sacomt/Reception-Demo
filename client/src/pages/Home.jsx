// client/src/pages/Home.jsx
import { useState, useEffect } from 'react';
import SplashScreen from '../components/SplashScreen';
import walletImage from '../assets/pngwing.com.png';
import { CreditCardIcon } from '@heroicons/react/24/outline';

const Home = ({ isCollapsed }) => {
  const [showSplash, setShowSplash] = useState(sessionStorage.getItem('showSplash') === 'true');

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
        <div className="space-y-2">
          {/* Combined Welcome and Metrics Section */}
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
                  className="flex flex-col px-10 py-2 transition-colors duration-300 hover:bg-gray-200 cursor-pointer"
                  style={{
                    borderRight: index !== 3 ? '2px solid #e5e7eb' : 'none',
                  }}
                >
                  <p className="text-3xl font-semibold text-gray-800">0</p>
                  <p className="text-xs text-gray-600 py-2">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase Section */}
          <div className="bg-green-50 py-10 px-5 mx-6 rounded-lg shadow flex items-center space-x-20">
            <img src={walletImage} alt="Wallet Icon" className="w-96 h-auto p-10 m-0 shadow-xl rounded-xl" />
            <div className="text-left space-y-2">
              <h3 className="text-3xl text-gray-800">Generate a New Privilege Card</h3>
              <p className="text-sm text-gray-600 pb-4">
                Click on the button below to Generate new Privilege cards.
              </p>
              <button
                onClick={handlePrivilegeCardClick}
                className="flex flex-row bg-green-500 items-center justify-center hover:bg-green-600 text-white px-6 py-2 rounded-lg transition"
              >
                <CreditCardIcon className='w-6 h-6 mr-1' /> Privilege Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

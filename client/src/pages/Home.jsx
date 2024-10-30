// client/src/pages/Home.jsx
import { useState, useEffect } from 'react';
import SplashScreen from '../components/SplashScreen';

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

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? 'ml-2' : 'ml-2'} my-8 p-4 min-h-screen`}>
      {showSplash ? (
        <SplashScreen />
      ) : (
        <div className="">
          {/* Welcome Section */}
          <div className="bg-white p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800">Welcome, User</h2>
            <p className="text-gray-600 mt-2">Send, track & manage.</p>
            <button
          className="mt-2 bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] rounded-lg p-2 text-xs text-white transition"
        >
          + Privilege Card
        </button>
          </div>

          {/* Dashboard Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {['Action Required', 'Waiting for Others', 'Expiring Soon', 'Failed'].map((label, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 flex flex-col items-center">
                <p className="text-sm text-gray-800">{label}</p>
                <p className="text-lg text-gray-800 mt-2">0</p>
              </div>
            ))}
          </div>

          
        </div>
      )}
    </div>
  );
};

export default Home;

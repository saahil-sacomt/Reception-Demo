// client/src/components/Header.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/sreenethraenglishisolated.png';
import { Cog8ToothIcon, UserIcon } from '@heroicons/react/24/outline';

const Header = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const handleCreatePrivilegeCard = () => {
    navigate('/privilege-generation');
  };

  const toggleProfileDropdown = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  return (
    <header className="w-full fixed top-0 left-0 flex items-center justify-between px-4 bg-white text-white border-b z-10 h-12">
      {/* Left Section: Logo */}
      <div className="flex items-center">
        <img src={logo} alt="Logo" className="h-8 w-auto" />
      </div>

      {/* Right Section: Buttons */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={handleCreatePrivilegeCard} 
          className="bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] rounded-lg p-2 text-xs transition"
        >
          + Privilege Card
        </button>
        <button 
          onClick={handleSettings} 
          className="text-white hover:text-[#028090] transition"
        >
          <Cog8ToothIcon className='h-5 w-5 text-gray-500' />
        </button>
        <div className="relative">
          <button 
            onClick={toggleProfileDropdown} 
            className="text-white hover:text-[#028090] transition"
          >
            <UserIcon className='w-6 h-6 rounded-full text-gray-600 border' />
          </button>

          {/* Profile Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-20 p-4 text-black">
              <p className="font-semibold">{currentUser?.name || 'User'} </p>
              <p className="text-sm text-gray-600">{currentUser?.email || 'User@gmail.com'}</p>
              <p className="text-sm text-gray-600">Employee ID: {currentUser?.employeeId}</p>
              <button 
                onClick={handleLogout} 
                className="mt-4 w-full text-white py-1 rounded-lg bg-[#5db76d] bg-opacity-80 hover:bg-[#5db76d] transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlay to close the dropdown when clicking outside */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 bg-transparent z-10"
          onClick={() => setIsProfileOpen(false)}
        ></div>
      )}
    </header>
  );
};

export default Header;

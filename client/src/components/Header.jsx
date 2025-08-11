// client/src/components/Header.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/SACOMTLogoWhite.png';
import { BriefcaseIcon, CircleStackIcon, ClipboardDocumentListIcon, Cog8ToothIcon, CreditCardIcon, FolderPlusIcon, PercentBadgeIcon, PlusIcon, PresentationChartLineIcon, UserIcon, UserPlusIcon } from '@heroicons/react/24/outline';

const Header = ({ selectedTab, setSelectedTab, isCollapsed, toggleSidebar }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false); // State for Create dropdown
  const navigate = useNavigate();
  const { logout, user, role, name } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleProfileDropdown = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const toggleCreateDropdown = () => {
    setIsCreateOpen(!isCreateOpen);
  };

  const handleCreateNavigate = (path) => {
    navigate(path);
    setIsCreateOpen(false);
  };

  const handleTabClick = (tabName) => {
    setSelectedTab(tabName);
    if (isCollapsed) toggleSidebar(); // Expand sidebar if it's collapsed

    // Default navigation based on the selected tab
    if (tabName === 'Dashboard') {
      navigate('/home'); // Default route for Dashboard tab
    } else if (tabName === 'Documents') {
      navigate('/stock-manage'); // Default route for Documents tab
    }
  };

  return (
    <header className="app-content print:hidden w-full fixed top-0 left-0 flex items-center justify-between px-4 bg-white border-b z-10 h-16">
      {/* Left Section: Logo and Tab Buttons */}
      <div className="flex items-center">
        <img
          src={logo}
          alt="Logo"
          className="h-16 w-auto p-2 cursor-pointer"
          onClick={() => navigate('/home')} // Redirect to /home on logo click
        />
        <button
          onClick={() => handleTabClick('Dashboard')}
          className={`px-4 py-2 ml-4 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg ${selectedTab === 'Dashboard' ? 'bg-blue-50 text-blue-600 ' : 'text-gray-700'}`}
        >
          Dashboard
        </button>
        {role !== 'employee' && (
          <button
            onClick={() => handleTabClick('Documents')}
            className={`px-4 py-2 ml-1 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg ${selectedTab === 'Documents' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
          >
            Documents
          </button>
        )}
      </div>

      {/* Right Section: Create Button, Profile, and Settings */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          {(role === 'admin' || role === 'super_admin') && (<button
            onClick={toggleCreateDropdown}
            className="flex flex-row bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm text-white"
          >
            <PlusIcon className="w-5 h-5 mr-2" /> Create
          </button>)}

          {/* Create Dropdown */}
          {isCreateOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-20 p-2 text-gray-700">
              {role !== 'admin' && role !== 'super_admin' && (
                <button
                  onClick={() => handleCreateNavigate('/work-order')}
                  className="flex flex-row items-center  w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                >
                  <BriefcaseIcon className='h-5 w-5 mr-2' /> Work Order
                </button>
              )}
              {role !== 'admin' && role !== 'super_admin' && (

                <button
                  onClick={() => handleCreateNavigate('/sales-order')}
                  className="flex flex-row items-center  w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                >
                  <PresentationChartLineIcon className='h-5 w-5 mr-2' /> Sales Order
                </button>

              )}
              <button
                onClick={() => handleCreateNavigate('/privilege-generation')}
                className="flex flex-row items-center  w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg"
              >
                <CreditCardIcon className='h-5 w-5 mr-2' /> Privilege Card
              </button>
              {role !== 'employee' && (
                <button
                  onClick={() => handleCreateNavigate('/reportgenerator')}
                  className="flex flex-row items-center  w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                >
                  <ClipboardDocumentListIcon className='h-5 w-5 mr-2' /> Reports
                </button>
              )}
              {role !== 'employee' && (
                <button
                  onClick={() => handleCreateNavigate('/stock-manage')}
                  className="flex flex-row items-center  w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                >
                  <CircleStackIcon className='h-5 w-5 mr-2' /> Stock Management
                </button>
              )}
              <button
                onClick={() => handleCreateNavigate('/loyaltypoints')}
                className="flex flex-row items-center  w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg"
              >
                <PercentBadgeIcon className='h-5 w-5 mr-2' /> Privilege card details
              </button>
              {role !== 'admin' && role !== 'super_admin' && (
                <button
                  onClick={() => handleCreateNavigate('/raise-request')}
                  className="flex flex-row items-center  w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                >
                  <FolderPlusIcon className='h-5 w-5 mr-2' /> Raise Request
                </button>
              )}

              {role !== 'employee' && role != 'admin' && (
                <button
                  onClick={() => handleCreateNavigate('/signup')}
                  className="flex flex-row items-center  w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                >
                  <UserPlusIcon className='h-5 w-5 mr-2' /> Add New User
                </button>
              )}
            </div>
          )}
        </div>

        {role !== 'employee' && role !== 'admin' && (

          <button onClick={() => navigate('/settings')} className="text-gray-500 hover:text-blue-500">
            <Cog8ToothIcon className="h-6 w-6" />
          </button>
        )}

        <div className="relative top-0.5">
          <button onClick={toggleProfileDropdown} className="text-gray-500 hover:text-blue-500">
            <UserIcon className="w-6 h-6" />
          </button>

          {/* Profile Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-20 p-4 text-black">
              <p className="font-semibold">{name || 'User'}</p>
              <p className="text-sm text-gray-600">{user?.email || 'user@gmail.com'}</p>
              <button onClick={handleLogout} className="mt-4 w-full bg-[#0000ff] hover:bg-blue-600 text-white py-1 rounded-lg">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlay to close dropdowns when clicking outside */}
      {(isProfileOpen || isCreateOpen) && (
        <div
          className="fixed inset-0 bg-transparent z-10"
          onClick={() => {
            setIsProfileOpen(false);
            setIsCreateOpen(false);
          }}
        ></div>
      )}
    </header>
  );
};

export default Header;

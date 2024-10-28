// client/src/components/Header.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Bars3BottomRightIcon, Bars3Icon } from '@heroicons/react/24/outline';

const Header = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleProfile = () => {
    navigate('/profile');
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <>
      <header className="w-full fixed top-0 left-0 flex items-center justify-center p-4 bg-[#05668d] text-white shadow-md z-10 h-20">
        <h1 className="text-2xl font-semibold">Sreenethra</h1>
        <button onClick={toggleSidebar} className="absolute right-4 text-white focus:outline-none">
          {isSidebarOpen ? <Bars3BottomRightIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </header>

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-36 bg-[#05668d] rounded-l-xl text-white shadow-lg transform ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } transition-transform duration-300 z-20`}
      >
        <div className="p-6 space-y-4">
          <button onClick={handleProfile} className="w-full text-center text-lg py-2 hover:bg-[#028090] hover:text-black rounded-xl">
            Profile
          </button>
          
          <button onClick={handleSettings} className="w-full text-center text-lg py-2 hover:bg-[#028090] hover:text-black rounded-xl">
            Settings
          </button>

          <button onClick={handleLogout} className="w-full text-center text-lg py-2 hover:bg-[#028090] hover:text-black rounded-xl">
            Logout
          </button>
        </div>
      </div>

      {/* Overlay to close the sidebar when clicking outside */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-10"
          onClick={toggleSidebar}
        ></div>
      )}
    </>
  );
};

export default Header;

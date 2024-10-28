// client/src/components/Sidebar.jsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, DocumentTextIcon, ArrowLeftIcon, ArrowRightIcon, SwatchIcon, CloudIcon } from '@heroicons/react/24/outline';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`h-screen fixed top-0 left-0 ${isCollapsed ? 'w-16' : 'w-48'} bg-[#028090] text-white transition-width duration-300 z-10 rounded-r-xl`}>
      <div className="flex items-center justify-between p-4">
        <h1 className={`text-lg font-bold ${isCollapsed ? 'hidden' : ''}`}></h1>
        <button onClick={toggleSidebar} className="focus:outline-none">
          {isCollapsed ? <ArrowRightIcon className="h-5 w-5" /> : <ArrowLeftIcon className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex flex-col space-y-2 mt-8">
        {/* Home Link */}
        <NavLink
          to="/home"
          className={({ isActive }) => `flex items-center px-4 py-2 rounded-xl ${isActive ? 'bg-transparent' : ''} hover:bg-[#00a896]`}
        >
          <HomeIcon className="h-5 w-5 mr-2" />
          <span className={isCollapsed ? 'hidden' : ''}>Dashboard</span>
        </NavLink>

        {/* Order Generation Link */}
        <NavLink
          to="/order-generation"
          className={({ isActive }) => `flex items-center px-4 py-2 rounded-xl ${isActive ? 'bg-transparent' : ''} hover:bg-[#00a896]`}
        >
          <DocumentTextIcon className="h-5 w-5 mr-2" />
          <span className={isCollapsed ? 'hidden' : ''}>Order Generation</span>
        </NavLink>

        {/* Appointment Link */}
        <NavLink
          to="/appointment"
          className={({ isActive }) => `flex items-center px-4 py-2 rounded-xl ${isActive ? 'bg-transparent' : ''} hover:bg-[#00a896]`}
        >
          <CloudIcon className="h-5 w-5 mr-2" />
          <span className={isCollapsed ? 'hidden' : ''}>Appointments</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default Sidebar;

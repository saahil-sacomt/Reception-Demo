// client/src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { HomeIcon, DocumentTextIcon, ArrowLeftIcon, ArrowRightIcon, SwatchIcon, CloudIcon } from '@heroicons/react/24/outline';

const Sidebar = ({ isCollapsed, toggleSidebar }) => {
  return (
    <div className={`h-screen fixed mt-12 left-0 ${isCollapsed ? 'w-16' : 'w-48'} bg-white border-r transition-width duration-300 z-10`}>
      <div className="flex items-center justify-between p-4">
        <h1 className={`text-md font-semibold ${isCollapsed ? 'hidden' : ''}`}>Dashboard</h1>
        <button onClick={toggleSidebar} className="focus:outline-none">
          {isCollapsed ? <ArrowRightIcon className="h-5 w-5" /> : <ArrowLeftIcon className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex flex-col space-y-1 text-gray-700">
        {/* Home Link */}
        <NavLink
          to="/home"
          className={({ isActive }) => `flex items-center px-4 py-2  ${isActive ? 'bg-transparent' : ''} hover:bg-[#5db76d] hover:bg-opacity-60`}
        >
          <HomeIcon className="h-4 w-4 mr-2" />
          <span className={`text-sm ${isCollapsed ? 'hidden' : ''}`}>Home</span>
        </NavLink>

        {/* Order Generation Link */}
        <NavLink
          to="/order-generation"
          className={({ isActive }) => `flex items-center px-4 py-2 ${isActive ? 'bg-transparent' : ''} hover:bg-[#5db76d] hover:bg-opacity-60`}
        >
          <DocumentTextIcon className="h-4 w-4 mr-2" />
          <span className={`text-sm ${isCollapsed ? 'hidden' : ''}`}>Order Generation</span>
        </NavLink>

        {/* Appointment Link */}
        <NavLink
          to="/appointment"
          className={({ isActive }) => `flex items-center px-4 py-2  ${isActive ? 'bg-transparent' : ''} hover:bg-[#5db76d] hover:bg-opacity-60`}
        >
          <CloudIcon className="h-4 w-4 mr-2" />
          <span className={`text-sm ${isCollapsed ? 'hidden' : ''}`}>Appointments</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default Sidebar;

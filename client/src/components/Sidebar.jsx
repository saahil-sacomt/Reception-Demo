// client/src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { HomeIcon, DocumentTextIcon, ArrowLeftIcon, ArrowRightIcon, CloudIcon, RectangleStackIcon, ReceiptRefundIcon, ReceiptPercentIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

const Sidebar = ({ isCollapsed, toggleSidebar, selectedTab }) => {
  const dashboardLinks = [
    { to: '/home', icon: HomeIcon, label: 'Home' },
    { to: '/appointment', icon: RectangleStackIcon, label: 'Appointments' },
  ];

  const documentLinks = [
    { to: '/reportgenerator', icon: ClipboardDocumentListIcon, label: 'Reports' },
    
  ];

  const linksToRender = selectedTab === 'Dashboard' ? dashboardLinks : documentLinks;

  return (
    <div className={`h-screen fixed mt-16 left-0 ${isCollapsed ? 'w-12' : 'w-60'} bg-white border-r transition-width duration-300 z-10`}>
      <div className="flex items-center justify-between p-4">
        <h1 className={`text-base font-semibold pt-3 ${isCollapsed ? 'hidden' : ''}`}>{selectedTab}</h1>
        <button onClick={toggleSidebar} className="focus:outline-none pt-3">
          {isCollapsed ? <ArrowRightIcon className="h-5 w-5" /> : <ArrowLeftIcon className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex flex-col space-y-1 text-gray-700">
        {linksToRender.map((link, index) => (
          <NavLink
            key={index}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center px-4 py-2 rounded-lg transition-colors duration-300 ${
                isActive
                  ? `${isCollapsed ? 'text-green-600' : 'bg-green-50 text-green-600 shadow transform scale-[1.05]'}` 
                  : 'hover:bg-green-50'
              }`
            }
          >
            <link.icon className="h-6 w-6 mx-3" />
            <span className={`text-sm ${isCollapsed ? 'hidden' : ''}`}>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;

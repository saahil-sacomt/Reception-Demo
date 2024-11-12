// client/src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import RequireAuth from './components/RequireAuth';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import FetchLoyaltyPoints from './pages/FetchLoyaltyPoints';
import OrderGenerationPage from './pages/OrderGenerationPage';
import WorkOrderGeneration from './pages/WorkOrderGeneration';
import SalesOrderGeneration from './pages/SalesOrderGeneration';
import PrivilegeGeneration from './pages/PrivilegeGeneration';
import SettingsPage from './pages/SettingsPage';
import ReportGenerator from './components/ReportGenerator'

const App = () => {
  const location = useLocation();
  const hideHeaderAndSidebar = location.pathname === '/login' || location.pathname === '/signup';

  // Lift `isCollapsed` and `selectedTab` state to App component
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedTab, setSelectedTab] = useState('Dashboard');

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };



  return (
    <AuthProvider>
      {/* Conditionally render the Header and Sidebar based on the path */}
      {!hideHeaderAndSidebar && (
        <Header selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
      )}
      <div className="flex">
        {!hideHeaderAndSidebar && (
          <Sidebar
            isCollapsed={isCollapsed}
            toggleSidebar={toggleSidebar}
            selectedTab={selectedTab}
          />
        )}
        <div className={`flex-grow transition-all duration-300 ${hideHeaderAndSidebar ? '' : isCollapsed ? 'ml-16' : 'ml-48'} min-h-screen`}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected Routes */}
            <Route element={<RequireAuth />}>
              <Route path="/home" element={<Home isCollapsed={isCollapsed} />} />
              <Route path="/order-generation" element={<OrderGenerationPage isCollapsed={isCollapsed} />} />
              <Route path="/work-order" element={<WorkOrderGeneration isCollapsed={isCollapsed} />} />
              <Route path="/sales-order" element={<SalesOrderGeneration isCollapsed={isCollapsed} />} />
              <Route path="/privilege-generation" element={<PrivilegeGeneration isCollapsed={isCollapsed} />} />
              <Route path="/settings" element={<SettingsPage isCollapsed={isCollapsed} />} />
              <Route path="/reportgenerator" element={<ReportGenerator isCollapsed={isCollapsed} />} />
              <Route path="/loyaltypoints" element={<FetchLoyaltyPoints isCollapsed={isCollapsed} />} />
            </Route>

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
};

export default App;

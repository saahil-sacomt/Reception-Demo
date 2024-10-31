// client/src/App.jsx
import { useState,useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import RequireAuth from './components/RequireAuth';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import OrderGenerationPage from './pages/OrderGenerationPage';
import WorkOrderGeneration from './pages/WorkOrderGeneration';
import SalesOrderGeneration from './pages/SalesOrderGeneration';
import PrivilegeGeneration from './pages/PrivilegeGeneration';

const App = () => {
  const location = useLocation();
  const hideHeaderAndSidebar = location.pathname === '/login' || location.pathname === '/signup';

  // Lift `isCollapsed` state to App component
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  useEffect(() => {
    // Define OTPLESS callback
    window.otpless = (userinfo) => {
      const emailMap = userinfo.identities.find(
        (item) => item.identityType === 'EMAIL'
      );
      const mobileMap = userinfo.identities.find(
        (item) => item.identityType === 'MOBILE'
      );

      const token = userinfo.token;
      const email = emailMap?.identityValue;
      const mobile = mobileMap?.identityValue;
      const name = emailMap?.name || mobileMap?.name;

      console.log('User Info:', userinfo);
      console.log('Token:', token, 'Email:', email, 'Mobile:', mobile, 'Name:', name);

      // Implement your custom logic for successful login
    };

    // Initialize OTPLESS SDK with the callback
    if (window.OTPless) {
      window.OTPlessSignin = new OTPless(window.otpless);
    }
  }, []);


  return (
    <AuthProvider>
      {/* Conditionally render the Header and Sidebar based on the path */}
      {!hideHeaderAndSidebar && <Header />}
      <div className="flex">
        {!hideHeaderAndSidebar && (
          <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
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

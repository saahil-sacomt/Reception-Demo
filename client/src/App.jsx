// client/src/App.jsx
import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import FetchLoyaltyPoints from "./pages/FetchLoyaltyPoints";
import OrderGenerationPage from "./pages/OrderGenerationPage";
import WorkOrderGeneration from "./pages/WorkOrderGeneration";
import SalesOrderGeneration from "./pages/SalesOrderGeneration";
import PrivilegeGeneration from "./pages/PrivilegeGeneration";
// import SettingsPage from './pages/SettingsPage';
import ReportGenerator from "./components/ReportGenerator";
import Unauthorized from "./pages/Unauthorized";
import RaiseRequest from "./pages/RaiseRequest";
import AdminActionRequired from "./pages/AdminActionRequired";
import ModifyOrder from "./pages/ModifyOrder";
import EmployeeActionRequired from "./pages/EmployeeActionRequired";
import StockManagement from "./pages/StockManagement";

const App = () => {
  const location = useLocation();
  const hideHeaderAndSidebar = location.pathname === "/login";

  // Lift `isCollapsed` and `selectedTab` state to App component
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedTab, setSelectedTab] = useState("Dashboard");

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
        <div
          className={`flex-grow transition-all duration-300 ${
            hideHeaderAndSidebar ? "" : isCollapsed ? "ml-16" : "ml-48"
          } min-h-screen`}
        >
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected Routes */}
            <Route
              element={
                <RequireAuth
                  allowedRoles={["super_admin", "admin", "employee"]}
                />
              }
            >
              <Route
                path="/home"
                element={<Home isCollapsed={isCollapsed} />}
              />

              <Route
                path="/order-generation"
                element={<OrderGenerationPage isCollapsed={isCollapsed} />}
              />
              <Route
                path="/work-order"
                element={<WorkOrderGeneration isCollapsed={isCollapsed} />}
              />
              <Route
                path="/sales-order"
                element={<SalesOrderGeneration isCollapsed={isCollapsed} />}
              />
              <Route
                path="/sales-order/:orderId"
                element={<SalesOrderGeneration isCollapsed={isCollapsed} />}
              />
              <Route
                path="/privilege-generation"
                element={<PrivilegeGeneration isCollapsed={isCollapsed} />}
              />
              <Route
                path="/raise-request"
                element={<RaiseRequest isCollapsed={isCollapsed} />}
              />
              <Route
                path="/admin/action-required"
                element={<AdminActionRequired isCollapsed={isCollapsed} />}
              />
              <Route path="/modify-order/:orderId" element={<ModifyOrder />} />
              <Route
                path="/employee/action-required"
                element={<EmployeeActionRequired isCollapsed={isCollapsed} />}
              />

              <Route
                path="/loyaltypoints"
                element={<FetchLoyaltyPoints isCollapsed={isCollapsed} />}
              />
            </Route>
            <Route
              element={<RequireAuth allowedRoles={["super_admin", "admin"]} />}
            >
              <Route
                path="/reportgenerator"
                element={<ReportGenerator isCollapsed={isCollapsed} />}
              />
              <Route
                path="/stock-manage"
                element={<StockManagement isCollapsed={isCollapsed} />}
              />
              {/* <Route path="/settings" element={<SettingsPage isCollapsed={isCollapsed} />} /> */}

              <Route element={<RequireAuth allowedRoles={["super_admin"]} />}>
                <Route
                  path="/signup"
                  element={<Signup isCollapsed={isCollapsed} />}
                />
              </Route>
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

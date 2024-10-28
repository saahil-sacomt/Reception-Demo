// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import AuthLayout from './components/AuthLayout';
import RequireAuth from './components/RequireAuth';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import OrderGenerationPage from './pages/OrderGenerationPage';
import WorkOrderGeneration from './pages/WorkOrderGeneration';
import SalesOrderGeneration from './pages/SalesOrderGeneration';

const App = () => {
  const location = useLocation();
  const hideHeader = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <AuthProvider>
      {!hideHeader && <Header />}
      <div className="flex">
        {/* Sidebar is hidden on login and signup pages */}
        {!hideHeader && <Sidebar />}
        <div className={`flex-grow ${hideHeader ? '' : 'pt-16 ml-16'} bg-gray-100 min-h-screen`}>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/home" element={<Home />} />
              <Route path="/order-generation" element={<OrderGenerationPage />} />
              <Route path="/work-order" element={<WorkOrderGeneration />} />
              <Route path="/sales-order" element={<SalesOrderGeneration />} />
            </Route>
            <Route path="/" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
};

export default App;

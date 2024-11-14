// client/src/pages/Unauthorized.jsx
import { Link } from 'react-router-dom';

const Unauthorized = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold text-red-500">Access Denied</h1>
      <p className="text-lg mt-4">You do not have permission to access this page.</p>
      <Link to="/home" className="mt-6 text-blue-600 hover:underline">Go back to Home</Link>
    </div>
  );
};

export default Unauthorized;

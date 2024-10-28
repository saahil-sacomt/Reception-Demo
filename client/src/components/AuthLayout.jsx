// client/src/components/AuthLayout.jsx
import { Outlet } from 'react-router-dom';
import backgroundImage from '../assets/joshua-newton-GMjmjBi579I-unsplash.jpg';

const AuthLayout = () => {
  return (
    <div
      className="flex flex-col md:flex-row h-screen w-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Left Section (Welcome message) */}
      <div className="flex sm:items-start items-center  sm:justify-start justify-center w-full md:w-2/3 h-1/3 md:h-full p-6 md:p-20 bg-black bg-opacity-40">
        <h1 className="text-3xl sm:text-4xl  md:text-5xl lg:text-6xl font-bold text-white text-center md:text-left leading-tight">
          Welcome to Sreenetra
        </h1>
      </div>

      {/* Right Section (Login/Signup) */}
      <div className="flex sm:items-center items-start sm:justify-center justify-start w-full md:w-1/2 h-full bg-black bg-opacity-40 p-4 sm:p-8 md:p-12 md:rounded-none">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

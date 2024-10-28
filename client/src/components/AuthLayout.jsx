// client/src/components/AuthLayout.jsx
import { Outlet } from 'react-router-dom';
import backgroundImage from '../assets/joshua-newton-GMjmjBi579I-unsplash.jpg'; // Replace with your actual image path

const AuthLayout = () => {
  return (
    <div
      className="flex h-screen w-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="flex w-2/3 my-20 pl-20">
        <h1 className="text-6xl font-bold text-white">Welcome to Sreenetra</h1>
      </div>
      <div className="flex w-1/2 items-center justify-center bg-opacity-100 p-8">
        <Outlet /> {/* Renders either Login or Signup component */}
      </div>
    </div>
  );
};

export default AuthLayout;

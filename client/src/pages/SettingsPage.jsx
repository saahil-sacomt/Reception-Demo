import { useState } from 'react';

const SettingsPage = ({ isCollapsed }) => {
  const [activeTab, setActiveTab] = useState('account');

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-20'} my-8 pt-12 min-h-screen max-w-2xl`}>
      <h1 className="text-2xl font-Semibold mb-2">Settings</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-2">
        {['Account', 'Preferences', 'Privacy', 'Billing'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase())}
            className={`p-4 ${activeTab === tab.toLowerCase() ? 'border-b-2 border-green-500' : 'text-gray-500'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      <div className="bg-white rounded-lg p-6">
        {activeTab === 'account' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
            {/* Profile Information */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" className="mt-1 p-2 block w-full border-gray-300 rounded-md" placeholder="Your Name" />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" className="mt-1 p-2 block w-full border-gray-300 rounded-md" placeholder="you@example.com" />
            </div>
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Change Password</label>
              <input type="password" className="mt-1 p-2 block w-full border-gray-300 rounded-md" placeholder="New Password" />
            </div>
          </div>
        )}
        
        {activeTab === 'preferences' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Preferences</h2>
            {/* Theme */}
            <div className="mb-4">
              <label className="flex items-center">
                <span className="text-sm font-medium text-gray-700 mr-4">Dark Mode</span>
                <input type="checkbox" className="toggle-checkbox" />
              </label>
            </div>
            {/* Notifications */}
            <div>
              <label className="block text-normal font-medium text-gray-700">Notifications</label>
              <select className="mt-1 block w-full border-gray-300 rounded-md  ">
                <option>Email Only</option>
                <option>SMS Only</option>
                <option>Email & SMS</option>
              </select>
            </div>
          </div>
        )}

        {/* Add other sections as needed */}
      </div>
    </div>
  );
};

export default SettingsPage;

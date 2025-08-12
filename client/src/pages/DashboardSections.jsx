import React from 'react';
import {
  CreditCardIcon,
  WrenchScrewdriverIcon,
  TicketIcon,
  ClipboardDocumentCheckIcon,
  UserPlusIcon,
  CircleStackIcon,
  ClipboardDocumentIcon,
  ArchiveBoxArrowDownIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';

const DashboardSections = ({ role, navigate, walletImage, handlePrivilegeCardClick }) => {
  const renderCard = (Icon, title, onClick, additionalClasses = '') => (
    <div
      className={`flex flex-col items-center bg-blue-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition-shadow duration-200 ${additionalClasses}`}
      onClick={onClick}
    >
      <Icon className='h-36 w-36 text-blue-500' />
      <h2 className="mt-4 text-xl font-medium text-gray-800">{title}</h2>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-6 z-10">
      {/* Privilege Card Section */}
      {!['admin', 'super_admin'].includes(role) && (
        <div className="flex flex-row items-center bg-blue-50 rounded-lg shadow p-8">
          <img
            src={walletImage}
            alt="Wallet Icon"
            className="w-48 h-auto p-6 bg-white rounded-full shadow-xl"
          />
          <div className="ml-6 space-y-2 text-left">
            <h3 className="text-2xl font-semibold text-blue-500">Generate a New Privilege Card</h3>
            <p className="text-sm text-gray-600 pb-4">Click the button below to generate new Privilege cards.</p>
            <button
              onClick={handlePrivilegeCardClick}
              className="flex items-center justify-center px-5 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <CreditCardIcon className="w-5 h-5 mr-1" /> Privilege Card
            </button>
          </div>
        </div>
      )}

      {/* Role-Specific Sections */}
      {role !== 'admin' && role !== 'super_admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {role === 'opd' && renderCard(WrenchScrewdriverIcon, 'Work Order Generation', () => navigate('/work-order'))}
          {role === 'reception' && (
            <>
              {renderCard(TicketIcon, 'Sales Order Generation', () => navigate('/sales-order'))}
              {renderCard(ClipboardDocumentCheckIcon, 'Consulting', () => navigate('/consulting'))}
              {renderCard(UserPlusIcon, 'Patient Registration', () => navigate('/patient-registration'))}
            </>
          )}
        </div>
      )}

      {/* Stock Management for Non-Employees */}
      {role !== 'employee' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {renderCard(CircleStackIcon, 'Stock Management', () => navigate('/stock-manage'))}
        </div>
      )}

      {/* Reports Section */}
      {renderCard(ClipboardDocumentIcon, 'Reports', () => navigate('/reportgenerator'))}

      {/* Super Admin Section */}
      {role === 'super_admin' && (
        renderCard(ClipboardDocumentIcon, 'Add New User', () => navigate('/signup'), 'w-full text-center')
      )}

      {/* Stock and Financial Sections */}
      {role !== 'counselling' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {renderCard(ArchiveBoxArrowDownIcon, 'Purchase Stock', () => navigate('/employee-stock-management'))}
          {!['opd', 'counselling'].includes(role) &&
            renderCard(BanknotesIcon, 'Credit and Debit Notes', () => navigate('/notes'))}
        </div>
      )}

      {/* Counselling Specific Sections */}
      {role === 'counselling' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {renderCard(ArchiveBoxArrowDownIcon, 'Add Service', () => navigate('/add-service'))}
          {renderCard(BanknotesIcon, 'Credit and Debit Notes', () => navigate('/notes'))}
        </div>
      )}

      {/* Employee Specific Sections */}
      {role === 'employee' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10 px-6 w-full">
          {renderCard(ClipboardDocumentIcon, 'Reports', () => navigate('/reportgenerator'))}
          {renderCard(ArchiveBoxArrowDownIcon, 'Purchase Section', () => navigate('/employee-stock-management'))}
          {renderCard(BanknotesIcon, 'Credit and Debit Notes', () => navigate('/notes'))}
        </div>
      )}
    </div>
  );
};

export default DashboardSections;
import React from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useAuth } from '../hooks/useAuth';
import walletImage from '../assets/wallet.png'; // Adjust path if needed

export default function Home() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const handlePrivilegeCardClick = () => {
    navigate('/privilege-card');
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mx-6 z-10 auto-rows-fr">
      {/* Privilege Card */}
      {role !== 'admin' && role !== 'super_admin' && (
        <div className="flex flex-col items-center bg-green-50 py-8 px-6 rounded-lg shadow h-full">
          <img
            src={walletImage}
            alt="Wallet Icon"
            className="w-48 h-auto p-6 shadow-xl rounded-full bg-white"
          />
          <div className="text-left space-y-2 ml-6">
            <h3 className="text-2xl text-green-500">Generate a New Privilege Card</h3>
            <p className="text-sm text-gray-600 pb-4">
              Click the button below to generate new Privilege cards.
            </p>
            <button
              onClick={handlePrivilegeCardClick}
              className="flex flex-row bg-green-500 items-center justify-center hover:bg-green-600 text-white px-5 py-2 rounded-lg transition"
            >
              <CreditCardIcon className="w-5 h-5 mr-1" /> Privilege Card
            </button>
          </div>
        </div>
      )}

      {/* Work Order Generation - OPD / Counselling */}
      {(role === 'opd' || role === 'counselling') && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
          onClick={() => navigate('/work-order')}
        >
          <WrenchScrewdriverIcon className='h-36 w-36 text-green-500' />
          <h2 className="text-xl text-gray-800 mt-4">Work Order Generation</h2>
        </div>
      )}

      {/* Sales Order Generation - Reception */}
      {role === 'reception' && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
          onClick={() => navigate('/sales-order')}
        >
          <TicketIcon className='h-36 w-36 text-green-500' />
          <h2 className="text-xl text-gray-800 mt-4">Sales Order Generation</h2>
        </div>
      )}

      {/* Consulting - Reception */}
      {role === 'reception' && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
          onClick={() => navigate('/consulting')}
        >
          <ClipboardDocumentCheckIcon className='h-36 w-36 text-green-500' />
          <h2 className="text-xl text-gray-800 mt-4">Consulting</h2>
        </div>
      )}

      {/* Patient Registration - Reception */}
      {role === 'reception' && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
          onClick={() => navigate('/patient-registration')}
        >
          <UserPlusIcon className='h-36 w-36 text-green-500' />
          <h2 className="text-xl text-gray-800 mt-4">Patient Registration</h2>
        </div>
      )}

      {/* Stock Management - visible for all except employee */}
      {role !== 'employee' && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
          onClick={() => navigate('/stock-manage')}
        >
          <CircleStackIcon className='h-36 w-36 text-green-500' />
          <h2 className="text-xl text-gray-800 mt-4">Stock Management</h2>
        </div>
      )}

      {/* Reports - visible to everyone */}
      <div
        className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
        onClick={() => navigate('/reportgenerator')}
      >
        <ClipboardDocumentIcon className='h-36 w-36 text-green-500' />
        <h2 className="text-xl text-gray-800 mt-4">Reports</h2>
      </div>

      {/* Super Admin - Add New User */}
      {role === 'super_admin' && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full text-center"
          onClick={() => navigate('/signup')}
        >
          <ClipboardDocumentIcon className='h-36 w-36 text-green-500 rounded-lg' />
          <h2 className="text-xl text-gray-800 mt-4">Add New User</h2>
        </div>
      )}

      {/* Purchase Stock - all except counselling */}
      {role !== 'counselling' && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
          onClick={() => navigate('/employee-stock-management')}
        >
          <ArchiveBoxArrowDownIcon className='h-36 w-36 text-green-500' />
          <h2 className="text-xl text-gray-800 mt-4">Purchase Stock</h2>
        </div>
      )}

      {/* Credit and Debit Notes - not OPD/counselling */}
      {role !== 'opd' && role !== 'counselling' && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
          onClick={() => navigate('/notes')}
        >
          <BanknotesIcon className='h-36 w-36 text-green-500' />
          <h2 className="text-xl text-gray-800 mt-4">Credit and Debit Notes</h2>
        </div>
      )}

      {/* Counselling - Add Service */}
      {role === 'counselling' && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
          onClick={() => navigate('/add-service')}
        >
          <ArchiveBoxArrowDownIcon className='h-36 w-36 text-green-500' />
          <h2 className="text-xl text-gray-800 mt-4">Add Service</h2>
        </div>
      )}

      {/* Counselling - Credit/Debit Notes */}
      {role === 'counselling' && (
        <div
          className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
          onClick={() => navigate('/notes')}
        >
          <BanknotesIcon className='h-36 w-36 text-green-500' />
          <h2 className="text-xl text-gray-800 mt-4">Credit and Debit Notes</h2>
        </div>
      )}

      {/* Employee-only section */}
      {role === 'employee' && (
        <>
          {/* Reports */}
          <div
            className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
            onClick={() => navigate('/reportgenerator')}
          >
            <ClipboardDocumentIcon className='h-36 w-36 text-green-500' />
            <h2 className="text-xl text-gray-800 mt-4">Reports</h2>
          </div>

          {/* Purchase Section */}
          <div
            className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
            onClick={() => navigate('/employee-stock-management')}
          >
            <ArchiveBoxArrowDownIcon className='h-36 w-36 text-green-500' />
            <h2 className="text-xl text-gray-800 mt-4">Purchase Section</h2>
          </div>

          {/* Credit and Debit Notes */}
          <div
            className="flex flex-col items-center bg-green-50 shadow-lg rounded-lg p-6 cursor-pointer hover:shadow-xl transition duration-200 h-full"
            onClick={() => navigate('/notes')}
          >
            <BanknotesIcon className='h-36 w-36 text-green-500' />
            <h2 className="text-xl text-gray-800 mt-4">Credit and Debit Notes</h2>
          </div>
        </>
      )}
    </div>
  );
}
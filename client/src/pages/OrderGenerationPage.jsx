// client/src/pages/OrderGenerationPage.jsx
import { CubeIcon, TableCellsIcon, TicketIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const OrderGenerationPage = ({ isCollapsed }) => {
  const navigate = useNavigate();

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-14'} my-10 p-10 min-h-screen flex flex-col  space-y-10`}>
      <div className="flex space-x-12 mt-8 ml-12">
        <div
          className="max-w-lg bg-white shadow-lg rounded-xl overflow-hidden cursor-pointer hover:shadow-xl transition duration-200"
          onClick={() => navigate('/work-order')}
        >
          <div className="p-4 text-center bg-green-50">
            <WrenchScrewdriverIcon className='h-48 w-48 m-2 text-green-500' />

            <h2 className="text-lg">Work Order Generation</h2>
          </div>
        </div>
        <div
          className="max-w-xs bg-white shadow-lg rounded-xl overflow-hidden cursor-pointer hover:shadow-xl transition duration-200"
          onClick={() => navigate('/sales-order')}
        >
          <div className="p-4 text-center bg-green-50">
            <TicketIcon className='h-48 w-48 m-2 text-green-500' />
            <h2 className="text-lg ">Sales Order Generation</h2>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OrderGenerationPage;

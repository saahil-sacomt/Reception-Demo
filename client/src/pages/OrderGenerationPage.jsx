// client/src/pages/OrderGenerationPage.jsx
import { useNavigate } from 'react-router-dom';

const OrderGenerationPage = ({ isCollapsed }) => {
  const navigate = useNavigate();

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-14'} my-10 p-10 min-h-screen flex flex-col space-y-10`}>
      <div className="flex space-x-10">
        <div
          className="max-w-xs bg-white shadow-lg rounded-xl overflow-hidden cursor-pointer hover:shadow-xl transition duration-200"
          onClick={() => navigate('/work-order')}
        >
          <img src="/work-order.png" alt="Work Order" className="w-full h-32 object-contain bg-[#5db76d]" />
          <div className="p-4 text-center">
            <h2 className="text-lg">Work Order Generation</h2>
          </div>
        </div>
        <div
          className="max-w-xs bg-white shadow-lg rounded-xl overflow-hidden cursor-pointer hover:shadow-xl transition duration-200"
          onClick={() => navigate('/sales-order')}
        >
          <img src="/sales-order.png" alt="Sales Order" className="w-full h-32 object-contain bg-[#5db76d]" />
          <div className="p-4 text-center">
            <h2 className="text-lg ">Sales Order Generation</h2>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default OrderGenerationPage;

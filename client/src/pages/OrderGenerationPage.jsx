// client/src/pages/OrderGenerationPage.jsx
import { useNavigate } from 'react-router-dom';

const OrderGenerationPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col pl-36 p-10 space-y-10">
      <div className="flex space-x-10">
        <div
          className="max-w-xs bg-white shadow-lg rounded-xl overflow-hidden cursor-pointer hover:shadow-2xl transition duration-200"
          onClick={() => navigate('/work-order')}
        >
          <img src="/work-order.png" alt="Work Order" className="w-full h-48 object-contain bg-[#3fc1c0]" />
          <div className="p-4 text-center">
            <h2 className="text-lg font-semibold">Work Order Generation</h2>
          </div>
        </div>
        <div
          className="max-w-xs bg-white shadow-lg rounded-xl overflow-hidden cursor-pointer hover:shadow-2xl transition duration-200"
          onClick={() => navigate('/sales-order')}
        >
          <img src="/sales-order.png" alt="Sales Order" className="w-full h-48 object-contain bg-[#3fc1c0]" />
          <div className="p-4 text-center">
            <h2 className="text-lg font-semibold">Sales Order Generation</h2>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default OrderGenerationPage;

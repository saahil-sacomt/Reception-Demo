import React, { useState, useEffect } from 'react';
import { editStock } from '../services/authService';

const EditStockModal = ({ isOpen, onClose, stockEntry, refreshStockData }) => {
  const [quantity, setQuantity] = useState(stockEntry?.quantity || 0);
  const [rate, setRate] = useState(stockEntry?.product?.rate || 0);
  const [mrp, setMrp] = useState(stockEntry?.product?.mrp || 0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (stockEntry) {
      setQuantity(stockEntry.quantity || 0);
      setRate(stockEntry.product?.rate || 0);
      setMrp(stockEntry.product?.mrp || 0);
    }
  }, [stockEntry]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const productId = stockEntry.product?.product_id; // Alphanumeric product_id
    const branchCode = stockEntry.branch_code;

    if (!productId || !branchCode) {
      setError('Missing product ID or branch code.');
      return;
    }

    setIsLoading(true);
    const response = await editStock(
      productId,
      branchCode,
      parseInt(quantity, 10),
      parseFloat(rate),
      parseFloat(mrp)
    );
    setIsLoading(false);

    if (response.success) {
      setSuccess('Stock updated successfully!');
      refreshStockData(); // Refresh stock data
      setTimeout(() => {
        setSuccess(''); // Clear success message after 2 seconds
        onClose();
      }, 2000);
    } else {
      setError(response.error || 'Failed to update stock.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Edit Stock</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {success && <div className="text-green-500 mb-4">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="quantity" className="block mb-1 font-medium">
              Quantity
            </label>
            <input
              type="number"
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              required
            />
          </div>
          <div>
            <label htmlFor="rate" className="block mb-1 font-medium">
              Rate
            </label>
            <input
              type="number"
              id="rate"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label htmlFor="mrp" className="block mb-1 font-medium">
              MRP
            </label>
            <input
              type="number"
              id="mrp"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 bg-green-500 text-white rounded ${
                isLoading ? 'opacity-50' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStockModal;

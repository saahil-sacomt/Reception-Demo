// components/EditStockModal.jsx

import React, { useState, useEffect } from 'react';
import { editStock } from '../services/authService';

const EditStockModal = ({ isOpen, onClose, stockEntry }) => {
  const [quantity, setQuantity] = useState(stockEntry.quantity);
  const [rate, setRate] = useState(stockEntry.product.rate);
  const [mrp, setMrp] = useState(stockEntry.product.mrp);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (stockEntry) {
      setQuantity(stockEntry.quantity);
      setRate(stockEntry.product.rate);
      setMrp(stockEntry.product.mrp);
    }
  }, [stockEntry]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (quantity === '' || isNaN(quantity) || quantity < 0) {
      setError('Please enter a valid quantity.');
      return;
    }

    if (rate !== '' && (isNaN(rate) || rate < 0)) {
      setError('Please enter a valid rate.');
      return;
    }

    if (mrp !== '' && (isNaN(mrp) || mrp < 0)) {
      setError('Please enter a valid MRP.');
      return;
    }

    setIsLoading(true);
    const response = await editStock(stockEntry.product.id, stockEntry.branch_code, parseInt(quantity, 10));

    if (response.success) {
      setSuccess('Stock updated successfully.');
      // Optionally, refresh stock data in parent component
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setError(response.error);
    }

    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Edit Stock</h2>

        {error && (
          <div className="flex items-center text-red-500 mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center text-green-500 mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="quantity" className="block mb-1 font-medium">Quantity</label>
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
            <label htmlFor="rate" className="block mb-1 font-medium">Rate</label>
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
            <label htmlFor="mrp" className="block mb-1 font-medium">MRP</label>
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
              className={`px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStockModal;

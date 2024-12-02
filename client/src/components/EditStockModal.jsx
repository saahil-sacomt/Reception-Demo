// client/src/components/EditStockModal.jsx

import React, { useState,useEffect } from "react";
import { ClipLoader } from "react-spinners";
import { editStock } from "../services/authService";

const EditStockModal = ({ isOpen, onClose, stockEntry, refreshStockData }) => {
  useEffect(() => {
    console.log("Received stockEntry in EditStockModal:", stockEntry);
  }, [stockEntry]);

  const [quantity, setQuantity] = useState(stockEntry.quantity);
  const [rate, setRate] = useState(stockEntry.product.rate || "");
  const [mrp, setMrp] = useState(stockEntry.product.mrp || "");
  const [hsnCode, setHsnCode] = useState(stockEntry.product.hsn_code || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const productId = stockEntry.product.id;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (quantity === "" || quantity < 0) {
      setError("Please enter a valid quantity.");
      return;
    }

    if (rate === "" || rate < 0) {
      setError("Please enter a valid rate.");
      return;
    }

    if (mrp === "" || mrp < 0) {
      setError("Please enter a valid MRP.");
      return;
    }

    if (hsnCode.trim() === "") {
      setError("HSN Code cannot be empty.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await editStock(
        stockEntry.product.id, // Integer ID
        stockEntry.branch_code,
        parseInt(quantity, 10),
        parseFloat(rate),
        parseFloat(mrp)
      );

      if (response.success) {
        setSuccess("Stock updated successfully.");
        refreshStockData();
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setError(response.error);
      }
    } catch (err) {
      console.error("Error updating stock:", err);
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg w-96">
        <h2 className="text-xl font-semibold mb-4">Edit Stock</h2>

        {error && (
          <div className="flex items-center text-red-500 mb-4 whitespace-pre-line">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center text-green-500 mb-4 whitespace-pre-line">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Quantity Input */}
          <div className="mb-4">
            <label htmlFor="quantityEdit" className="block mb-2 font-medium">
              Quantity
            </label>
            <input
              type="number"
              id="quantityEdit"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              required
            />
          </div>

          {/* Rate Input */}
          <div className="mb-4">
            <label htmlFor="rateEdit" className="block mb-2 font-medium">
              Rate
            </label>
            <input
              type="number"
              id="rateEdit"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* MRP Input */}
          <div className="mb-4">
            <label htmlFor="mrpEdit" className="block mb-2 font-medium">
              MRP
            </label>
            <input
              type="number"
              id="mrpEdit"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* HSN Code Input */}
          <div className="mb-4">
            <label htmlFor="hsnCodeEdit" className="block mb-2 font-medium">
              HSN Code
            </label>
            <input
              type="text"
              id="hsnCodeEdit"
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              className="w-full p-2 border rounded"
              
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-4 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-white rounded flex items-center justify-center ${
                isLoading
                  ? "bg-blue-500 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600"
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <ClipLoader size={20} color="#ffffff" />
                  <span className="ml-2">Updating...</span>
                </>
              ) : (
                "Update"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStockModal;

// client/src/components/InvoiceSummary.jsx
import React from 'react';
import { convertUTCToIST } from '../utils/dateUtils';

const InvoiceSummary = React.forwardRef((props, ref) => {
  const {
    salesOrderId,
    description,
    mrNumber,
    employee,
    paymentMethod,
    productEntries,
    subtotal,
    cgstAmount,
    sgstAmount,
    totalAmount,
    advanceDetails,
    discountAmount,
    finalAmount,
    loyaltyPoints,
    pointsToAdd,
    redeemPointsAmount,
    isB2B,
    gstNumber, // If applicable
  } = props;

  return (
    <div ref={ref} className="mb-6">
      {/* Invoice Header */}
      <div className="invoice-header text-center mb-6">
        <h1 className="text-2xl font-bold">Your Company Name</h1>
        <p className="text-sm text-gray-600">GST Number: 27AAACM1234R1Z5</p>
        <h2 className="text-xl font-semibold">Invoice Summary</h2>
      </div>

      {/* Invoice Details */}
      <div className="invoice-details grid grid-cols-2 gap-4 mb-6">
        <div>
          <p>
            <strong>Sales Order ID:</strong> <span className="font-normal">{salesOrderId}</span>
          </p>
          <p>
            <strong>Description:</strong> <span className="font-normal">{description}</span>
          </p>
          <p>
            <strong>MR Number:</strong> <span className="font-normal">{mrNumber}</span>
          </p>
        </div>
        <div>
          <p>
            <strong>Billed by Employee:</strong> <span className="font-normal">{employee || 'N/A'}</span>
          </p>
          <p>
            <strong>Payment Method:</strong> <span className="font-normal">{paymentMethod}</span>
          </p>
          {isB2B && (
            <p>
              <strong>GST Number:</strong> <span className="font-normal">{gstNumber}</span>
            </p>
          )}
        </div>
      </div>

      {/* Product Table */}
      <table className="w-full border border-gray-300 rounded-md mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="py-2 px-4 border-b">Product ID</th>
            <th className="py-2 px-4 border-b">Product Name</th>
            <th className="py-2 px-4 border-b">Price</th>
            <th className="py-2 px-4 border-b">Quantity</th>
            <th className="py-2 px-4 border-b">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {productEntries.map((product, index) => {
            const productSubtotal = (parseFloat(product.price) || 0) * (parseInt(product.quantity) || 0);
            return (
              <tr key={index} className="text-center">
                <td className="py-2 px-4 border-b">{product.id}</td>
                <td className="py-2 px-4 border-b">{product.name}</td>
                <td className="py-2 px-4 border-b">₹ {parseFloat(product.price).toFixed(2)}</td>
                <td className="py-2 px-4 border-b">{product.quantity}</td>
                <td className="py-2 px-4 border-b">₹ {productSubtotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Financial Summary */}
      <div className="financial-summary grid grid-cols-2 gap-4">
        <div>
          <p>
            <strong>Subtotal:</strong> ₹{subtotal.toFixed(2)}
          </p>
          <p>
            <strong>CGST (6%):</strong> ₹{cgstAmount.toFixed(2)}
          </p>
          <p>
            <strong>SGST (6%):</strong> ₹{sgstAmount.toFixed(2)}
          </p>
          <p>
            <strong>Discount (Loyalty Points):</strong> ₹{discountAmount.toFixed(2)}
          </p>
        </div>
        <div>
          <p>
            <strong>Total Amount (incl. GST):</strong> ₹{totalAmount.toFixed(2)}
          </p>
          <p>
            <strong>Advance Paid:</strong> ₹{parseFloat(advanceDetails).toFixed(2)}
          </p>
          <p>
            <strong>Balance Due:</strong> ₹{finalAmount.toFixed(2)}
          </p>
          <p>
            <strong>Loyalty Points to Add:</strong> {pointsToAdd}
          </p>
        </div>
      </div>
    </div>
  );
});

export default InvoiceSummary;

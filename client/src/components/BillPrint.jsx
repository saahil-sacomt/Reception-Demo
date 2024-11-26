import React, { forwardRef } from 'react';

const BillPrint = forwardRef((props, ref) => {
  const {
    workOrderId = '',
    dueDate = '',
    productEntries = [],
    customerDetails = {}, // Default to an empty object
    employee = '',
    isB2B = false,
    gstNumber = '',
    subtotal = 0,
    discountAmount = 0,
    discountedSubtotal = 0,
    cgst = 0,
    sgst = 0,
    totalAmount = 0,
    advance = 0,
    balanceDue = 0,
  } = props;

  const HSN_CODE = '9001'; // Define your HSN Code or pass it as a prop if dynamic

  // Ensure customerDetails is a valid object
  const hasMrNumber = customerDetails?.mr_number;

  return (
    <div ref={ref} className="bg-white text-black p-6 text-sm" style={{ width: '148mm', height: '210mm' }}>
      <header className="text-center">
        <h1 className="text-xl font-bold">Company Name</h1>
        <p className="text-sm">Address Line 1, Address Line 2, City</p>
        <p className="text-sm">Phone: 1234567890 | Email: info@company.com</p>
        <hr className="my-4" />
      </header>

      <div className="flex justify-between mb-4">
        <div>
          <p>
            <strong>Work Order ID:</strong> {workOrderId || 'N/A'}
          </p>
          <p>
            <strong>Due Date:</strong> {dueDate || 'N/A'}
          </p>
          {hasMrNumber ? (
            <>
              <p>
                <strong>Customer MR Number:</strong> {customerDetails.mr_number || 'N/A'}
              </p>
              {customerDetails && (
                <>
                  <p>
                    <strong>Name:</strong> {customerDetails.name || 'N/A'}
                  </p>
                  <p>
                    <strong>Age:</strong> {customerDetails.age || 'N/A'}
                  </p>
                  <p>
                    <strong>Phone Number:</strong> {customerDetails.phoneNumber || 'N/A'}
                  </p>
                  <p>
                    <strong>Gender:</strong> {customerDetails.gender || 'N/A'}
                  </p>
                  <p>
                    <strong>Address:</strong> {customerDetails.address || 'N/A'}
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <p>
                <strong>Customer Name:</strong> {customerDetails?.name || 'N/A'}
              </p>
              <p>
                <strong>Customer Phone Number:</strong> {customerDetails?.phoneNumber || 'N/A'}
              </p>
              <p>
                <strong>Customer Address:</strong> {customerDetails?.address || 'N/A'}
              </p>
              <p>
                <strong>Customer Age:</strong> {customerDetails?.age || 'N/A'}
              </p>
              <p>
                <strong>Customer Gender:</strong> {customerDetails?.gender || 'N/A'}
              </p>
            </>
          )}
        </div>
        <div>
          <p>
            <strong>Billed by Employee:</strong> {employee || 'N/A'}
          </p>

          {isB2B && (
            <p>
              <strong>B2B GST Number:</strong> {gstNumber || 'N/A'}
            </p>
          )}
        </div>
      </div>

      {/* Product Table */}
      <table className="w-full border mb-6 text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Product ID</th>
            <th className="border px-2 py-1">Product Name</th>
            <th className="border px-2 py-1">HSN Code</th>
            <th className="border px-2 py-1">Price</th>
            <th className="border px-2 py-1">Quantity</th>
            <th className="border px-2 py-1">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(productEntries) && productEntries.length > 0 ? (
            productEntries.map((product, index) => {
              const productSubtotal = (parseFloat(product.price) || 0) * (parseInt(product.quantity) || 0);
              return (
                <tr key={index}>
                  <td className="border px-2 py-1">{product.id || 'N/A'}</td>
                  <td className="border px-2 py-1">{product.name || 'N/A'}</td>
                  <td className="border px-2 py-1">{HSN_CODE}</td>
                  <td className="border px-2 py-1">₹{(parseFloat(product.price) || 0).toFixed(2)}</td>
                  <td className="border px-2 py-1">{product.quantity || 'N/A'}</td>
                  <td className="border px-2 py-1">₹{productSubtotal.toFixed(2)}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="6" className="border px-2 py-1 text-center">
                No products available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Financial Summary */}
      <div className="flex justify-between">
        <div>
          <p>
            <strong>Subtotal (Base Price):</strong> ₹{subtotal.toFixed(2)}
          </p>
          <p>
            <strong>Discount Amount:</strong> ₹{discountAmount.toFixed(2)}
          </p>
          <p>
            <strong>Discounted Subtotal:</strong> ₹{discountedSubtotal.toFixed(2)}
          </p>
          <p>
            <strong>CGST (6%):</strong> ₹{cgst.toFixed(2)}
          </p>
          <p>
            <strong>SGST (6%):</strong> ₹{sgst.toFixed(2)}
          </p>
        </div>

        <div>
          <p>
            <strong>Total Amount (Including GST):</strong> ₹{totalAmount.toFixed(2)}
          </p>

          <p>
            <strong>Advance Paid:</strong> ₹{advance.toFixed(2)}
          </p>
          <p>
            <strong>Balance Due:</strong> ₹{balanceDue.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
});

export default BillPrint;

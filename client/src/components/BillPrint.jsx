// client/src/components/BillPrint.jsx
import React from 'react';

const BillPrint = React.forwardRef(
  (
    {
      workOrderId,
      productEntries,
      subtotal,
      discountAmount,
      discountedSubtotal,
      cgst,
      sgst,
      totalAmount,
      advance,
      balanceDue,
      patientDetails,
      employee,
      gstNumber,
      hasMrNumber,
      customerName,
      customerPhone,
      dueDate,
      isB2B,HSN_CODE
    },
    ref
  ) => (
    <div ref={ref} className="bg-white text-black p-6 text-sm" style={{ width: '148mm', height: '210mm' }}>
      <header className="text-center">
        {/* <img src={logo} alt="Company Logo" className="mx-auto mb-4" style={{ width: '100px' }} /> */}
        <h1 className="text-xl font-bold">Company Name</h1>
        <p className="text-sm">Address Line 1, Address Line 2, City</p>
        <p className="text-sm">Phone: 1234567890 | Email: info@company.com</p>
        <hr className="my-4" />
      </header>

      <div className="flex justify-between mb-4">
        <div>
          <p>
            <strong>Work Order ID:</strong> {workOrderId}
          </p>
          <p>
            <strong>Due Date:</strong> {dueDate}
          </p>
          {hasMrNumber ? (
            <>
              <p>
                <strong>Customer MR Number:</strong> {patientDetails?.mr_number || 'N/A'}
              </p>
              {patientDetails && (
                <>
                  <p>
                    <strong>Name:</strong> {patientDetails.name || 'N/A'}
                  </p>
                  <p>
                    <strong>Age:</strong> {patientDetails.age || 'N/A'}
                  </p>
                  <p>
                    <strong>Phone Number:</strong> {patientDetails.phoneNumber || 'N/A'}
                  </p>
                  <p>
                    <strong>Gender:</strong> {patientDetails.gender || 'N/A'}
                  </p>
                  <p>
                    <strong>Address:</strong> {patientDetails.address || 'N/A'}
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <p>
                <strong>Customer Name:</strong> {customerName || 'N/A'}
              </p>
              <p>
                <strong>Customer Phone Number:</strong> {customerPhone || 'N/A'}
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
              <strong>B2B GST Number:</strong> {gstNumber}
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
          {productEntries.map((product, index) => {
            const productSubtotal = parseFloat(product.price || 0) * parseInt(product.quantity || 0);
            return (
              <tr key={index}>
                <td className="border px-2 py-1">{product.id}</td>
                <td className="border px-2 py-1">{product.name}</td>
                <td className="border px-2 py-1">{HSN_CODE}</td>
                <td className="border px-2 py-1">₹{parseFloat(product.price).toFixed(2)}</td>
                <td className="border px-2 py-1">{product.quantity}</td>
                <td className="border px-2 py-1">₹{productSubtotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Financial Summary */}
      <div className="flex justify-between">
        <div>
          <p>
            <strong>Subtotal:</strong> ₹{subtotal.toFixed(2)}
          </p>
          <p>
            <strong>Discount:</strong> ₹{discountAmount.toFixed(2)}
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
            <strong>Total Amount:</strong> ₹{totalAmount.toFixed(2)}
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
  )
);

export default BillPrint;

import PDFDocument from 'pdfkit';

export const generatePDF = (reportData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    doc.fontSize(18).text('Sales Summary Report', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Total Sales: INR ${reportData.totalSales.toFixed(2)}`);
    doc.text(`Advance Payments: INR ${reportData.advancePayments.toFixed(2)}`);
    doc.moveDown();

    doc.text('Tax Breakdown:');
    for (const [rate, amount] of Object.entries(reportData.taxDetails)) {
      doc.text(`  - ${rate}: INR ${amount.toFixed(2)}`);
    }

    doc.end();
  });
};

import supabase from '../services/supabaseClient.js';
import { generatePDF } from '../utils/pdfGenerator.js';

// Generate Daily Sales Report
export const generateDailyReport = async (req, res) => {
  try {
    const { data: salesData, error } = await supabase
      .from('work_orders')
      .select('*')
      .gte('created_at', new Date().toISOString().split('T')[0]);

    if (error) return res.status(400).json({ error: error.message });

    const summary = generateSalesSummary(salesData);
    const pdfBuffer = await generatePDF(summary);
    res.setHeader('Content-Disposition', 'attachment; filename="daily_report.pdf"');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

// Generate Monthly Sales Report
export const generateMonthlyReport = async (req, res) => {
  const { month, year } = req.query;
  try {
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    const { data: salesData, error } = await supabase
      .from('work_orders')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) return res.status(400).json({ error: error.message });

    const summary = generateSalesSummary(salesData);
    const pdfBuffer = await generatePDF(summary);
    res.setHeader('Content-Disposition', 'attachment; filename="monthly_report.pdf"');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

// Helper function to generate sales summary
function generateSalesSummary(data) {
  let totalSales = 0;
  let advancePayments = 0;
  let taxDetails = {};

  data.forEach(order => {
    totalSales += order.total_amount;
    advancePayments += parseFloat(order.advance_details) || 0;

    if (order.tax_rate) {
      const gstRate = `${order.tax_rate}%`;
      taxDetails[gstRate] = (taxDetails[gstRate] || 0) + (order.total_amount * (order.tax_rate / 100));
    }
  });

  return { totalSales, advancePayments, taxDetails };
}

// client/src/components/ReportGenerator.jsx

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { convertUTCToIST } from '../utils/dateUtils';

const ReportGenerator = ({ isCollapsed }) => {
  // State Variables
  const [reportType, setReportType] = useState('sales_orders'); // 'sales_orders', 'work_orders', 'privilegecards', 'products'
  const [reportPeriod, setReportPeriod] = useState('daily'); // 'daily', 'monthly'
  const [date, setDate] = useState(''); // For daily reports
  const [monthYear, setMonthYear] = useState(''); // For monthly reports (format: YYYY-MM)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Utility function to get the last day of a month
  const getLastDayOfMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  // Function to capitalize the first letter of a string
  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  // Function to format JSONB fields for better readability
  const formatJSONB = (jsonbData) => {
    if (!jsonbData) return 'N/A';
    try {
      const parsedData = typeof jsonbData === 'string' ? JSON.parse(jsonbData) : jsonbData;
      return Object.entries(parsedData)
        .map(([key, value]) => `${capitalizeFirstLetter(key)}: ${JSON.stringify(value)}`)
        .join('\n');
    } catch (e) {
      return 'Invalid JSON Data';
    }
  };

  // Handle Report Generation
  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let fetchedData = [];
      let reportDetails = {};

      // Validate and Determine Date Range
      let startDate, endDate;

      if (reportPeriod === 'daily') {
        if (!date) {
          setError('Please select a date for the daily report.');
          setLoading(false);
          return;
        }
        const selectedDate = new Date(date);
        if (isNaN(selectedDate.getTime())) {
          setError('Invalid date selected.');
          setLoading(false);
          return;
        }
        startDate = new Date(`${date}T00:00:00Z`);
        endDate = new Date(`${date}T23:59:59Z`);
        reportDetails = {
          type: 'Daily',
          date: convertUTCToIST(startDate.toISOString(), "dd-MM-yyyy"),
          identifier: date,
        };
      } else {
        if (!monthYear) {
          setError('Please select a month and year for the monthly report.');
          setLoading(false);
          return;
        }
        const [year, month] = monthYear.split('-').map(Number);
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
          setError('Invalid month and year selected.');
          setLoading(false);
          return;
        }
        const lastDay = getLastDayOfMonth(year, month);
        startDate = new Date(`${year}-${month}-01T00:00:00Z`);
        endDate = new Date(`${year}-${month}-${lastDay}T23:59:59Z`);
        reportDetails = {
          type: 'Monthly',
          month,
          year,
          identifier: `${month}-${year}`,
        };
      }

      // Initialize variables for data and error
      let { data, error } = { data: [], error: null };

      // Initialize variable for formattedProductIdSummary
      let formattedProductIdSummary = null;

      // Fetch data based on report type
      switch (reportType) {
        case 'sales_orders': {
          ({ data, error } = await supabase
            .from('sales_orders')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString()));
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'work_orders': {
          ({ data, error } = await supabase
            .from('work_orders')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString()));
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'privilegecards': {
          ({ data, error } = await supabase
            .from('privilegecards')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString()));
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'products': {
          ({ data, error } = await supabase
            .from('products')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString()));
          if (error) throw error;
          fetchedData = data;

          // Summarize by Product ID
          const productIdSummary = data.reduce((acc, curr) => {
            const productId = curr.product_id || 'N/A';
            if (!acc[productId]) {
              acc[productId] = {
                product_name: curr.product_name || 'N/A',
                total_quantity: 0,
                total_revenue: 0,
                total_price: 0,
                count: 0,
              };
            }
            acc[productId].total_quantity += curr.quantity || 0;
            acc[productId].total_revenue += (curr.price || 0) * (curr.quantity || 0);
            acc[productId].total_price += curr.price || 0;
            acc[productId].count += 1;
            return acc;
          }, {});

          formattedProductIdSummary = Object.entries(productIdSummary)
            .map(([productId, details]) => ({
              'Product ID': productId,
              'Product Name': details.product_name,
              'Total Quantity Sold': details.total_quantity,
              'Total Revenue': details.total_revenue.toFixed(2),
              'Average Price': details.count ? (details.total_price / details.count).toFixed(2) : '0.00',
            }))
            .sort((a, b) => b['Total Revenue ()'] - a['Total Revenue ()']); // Optional: Sort by revenue
          break;
        }
        default:
          setError('Invalid report type selected.');
          setLoading(false);
          return;
      }

      if (fetchedData.length === 0) {
        setError('No records found for the selected period.');
        setLoading(false);
        return;
      }

      // Generate PDF
      generatePDF(fetchedData, reportDetails, reportType, formattedProductIdSummary);

      setSuccess('Report generated successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to generate PDF
  const generatePDF = (data, reportDetails, reportType, formattedProductIdSummary) => {
    const doc = new jsPDF();
    const isDaily = reportDetails.type === 'Daily';

    // Header
    doc.setFontSize(18);
    doc.text('Sreenethra Eye Care', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('GSTIN: 32AAUCS7002H1ZV', 105, 30, { align: 'center' });
    doc.text(`Report Type: ${reportDetails.type}`, 14, 40);
    doc.text(
      isDaily
        ? `Date: ${reportDetails.date}`
        : `Month: ${reportDetails.month}/${reportDetails.year}`,
      14,
      47
    );

    // Determine table columns based on report type
    let tableColumn = [];
    switch (reportType) {
      case 'sales_orders':
        tableColumn = [
          'Sales Order ID',
          'MR Number',
          'Is B2B',
          'Subtotal',
          'CGST',
          'SGST',
          'Total Amount',
          'Employee',
          'Payment Method',
          'Loyalty Points Redeemed',
          'Created At',
          'Updated At',
        ];
        break;
      case 'work_orders':
        tableColumn = [
          'Work Order ID',
          'Description',
          'Advance Details',
          'Due Date',
          'MR Number',
          'Employee',
          'Payment Method',
          'Total Amount',
          'CGST',
          'SGST',
          'Is B2B',
          'HSN Code',
          'Created At',
          'Updated At',
        ];
        break;
      case 'privilegecards':
        tableColumn = [
          'PC Number',
          'Customer Name',
          'Phone Number',
          'Top-Up Amount',
          'Loyalty Points',
          'Card Tier',
          'Created At',
        ];
        break;
      case 'products':
        tableColumn = [
          'ID',
          'Work Order ID',
          'Product Name',
          'Product ID',
          'Price',
          'Quantity',
          'HSN Code',
          'Created At',
          'Updated At',
        ];
        break;
      default:
        tableColumn = [];
    }

    // Prepare table rows
    const tableRows = data.map((record) => {
      switch (reportType) {
        case 'sales_orders':
          return [
            record.sales_order_id || 'N/A',
            record.mr_number || 'N/A',
            record.is_b2b ? 'Yes' : 'No',
            record.subtotal ? Number(record.subtotal).toFixed(2) : '0.00',
            record.cgst ? Number(record.cgst).toFixed(2) : '0.00',
            record.sgst ? Number(record.sgst).toFixed(2) : '0.00',
            record.total_amount ? Number(record.total_amount).toFixed(2) : '0.00',
            record.employee || 'N/A',
            record.payment_method || 'N/A',
            record.loyalty_points_redeemed !== undefined
              ? record.loyalty_points_redeemed
              : "0",
            record.created_at
              ? convertUTCToIST(record.created_at, "dd-MM-yyyy hh:mm a")
              : 'N/A',
            record.updated_at
              ? convertUTCToIST(record.updated_at, "dd-MM-yyyy hh:mm a")
              : 'N/A',
          ];
        case 'work_orders':
          return [
            record.work_order_id || 'N/A',
            record.description || 'N/A',
            record.advance_details
              ? Number(record.advance_details).toFixed(2)
              : '0.00',
            record.due_date ? record.due_date : 'N/A',
            record.mr_number || 'N/A',
            record.employee || 'N/A',
            record.payment_method || 'N/A',
            record.total_amount
              ? Number(record.total_amount).toFixed(2)
              : '0.00',
            record.cgst ? Number(record.cgst).toFixed(2) : '0.00',
            record.sgst ? Number(record.sgst).toFixed(2) : '0.00',
            record.is_b2b ? 'Yes' : 'No',
            record.hsn_code || 'N/A',
            record.created_at
              ? convertUTCToIST(record.created_at, "dd-MM-yyyy hh:mm a")
              : 'N/A',
            record.updated_at
              ? convertUTCToIST(record.updated_at, "dd-MM-yyyy hh:mm a")
              : 'N/A',
          ];
        case 'privilegecards':
          return [
            record.pc_number || 'N/A',
            record.customer_name || 'N/A',
            record.phone_number || 'N/A',
            record.top_up_amount
              ? Number(record.top_up_amount).toFixed(2)
              : '0.00',
            record.loyalty_points !== undefined
              ? record.loyalty_points
              : 'N/A',
            record.card_tier || 'N/A',
            record.created_at
              ? convertUTCToIST(record.created_at, "dd-MM-yyyy hh:mm a")
              : 'N/A',
          ];
        case 'products':
          return [
            record.id || 'N/A',
            record.work_order_id || 'N/A',
            record.product_name || 'N/A',
            record.product_id || 'N/A',
            record.price ? Number(record.price).toFixed(2) : '0.00',
            record.quantity !== undefined ? record.quantity : '0',
            record.hsn_code || 'N/A',
            record.created_at
              ? convertUTCToIST(record.created_at, "dd-MM-yyyy hh:mm a")
              : 'N/A',
            record.updated_at
              ? convertUTCToIST(record.updated_at, "dd-MM-yyyy hh:mm a")
              : 'N/A',
          ];
        default:
          return [];
      }
    });

    // Generate the main table
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 55,
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [0, 200, 0], halign: 'center' }, // Customize header color
      alternateRowStyles: { fillColor: [240, 240, 240] }, // Alternate row colors
      margin: { top: 50 },
      theme: 'striped',
      showHead: 'everyPage',
      pageBreak: 'auto',
    });

    // Calculate and Add Summary
    const summaryStartY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text('Summary', 14, summaryStartY);
    doc.setFontSize(10);

    let summaryTable = [];

    switch (reportType) {
      case 'sales_orders': {
        const totalSalesOrders = data.length;
        const totalAdvancePayments = data.reduce((acc, curr) => acc + (curr.advance_details || 0), 0); // Ensure 'advance_details' exists
        const totalSubtotal = data.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
        const totalCGST = data.reduce((acc, curr) => acc + (curr.cgst || 0), 0);
        const totalSGST = data.reduce((acc, curr) => acc + (curr.sgst || 0), 0);
        const totalAmount = data.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        const totalLoyaltyPoints = data.reduce(
          (acc, curr) => acc + (curr.loyalty_points_redeemed || 0),
          0
        );
        const totalB2B = data.reduce((acc, curr) => acc + (curr.is_b2b ? 1 : 0), 0);

        summaryTable = [
          ['Total Sales Orders', totalSalesOrders],
          ['Total Advance Payments ', totalAdvancePayments.toFixed(2)],
          ['Total Subtotal', totalSubtotal.toFixed(2)],
          ['Total CGST', totalCGST.toFixed(2)],
          ['Total SGST', totalSGST.toFixed(2)],
          ['Total Amount', totalAmount.toFixed(2)],
          ['Total Loyalty Points Redeemed', totalLoyaltyPoints],
          ['Total B2B Orders', totalB2B],
        ];
        break;
      }
      case 'work_orders': {
        const totalWorkOrders = data.length;
        const totalAdvance = data.reduce((acc, curr) => acc + (curr.advance_details || 0), 0);
        const totalWorkAmount = data.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        const totalworkSubtotal = data.reduce((acc, curr) => acc + (curr.subtotal || 0), 0); // Assuming 'subtotal' exists
        const totalworkCGST = data.reduce((acc, curr) => acc + (curr.cgst || 0), 0);
        const totalworkSGST = data.reduce((acc, curr) => acc + (curr.sgst || 0), 0);
        const totalWorkB2B = data.reduce((acc, curr) => acc + (curr.is_b2b ? 1 : 0), 0);

        // Summarize JSONB fields (if any)
        const productEntriesSummary = data.reduce((acc, curr) => {
          if (curr.product_entries) {
            let entries;
            try {
              entries = typeof curr.product_entries === 'string' ? JSON.parse(curr.product_entries) : curr.product_entries;
            } catch (e) {
              console.error('Invalid JSON in product_entries:', curr.product_entries);
              return acc;
            }
            Object.entries(entries).forEach(([key, value]) => {
              acc[key] = (acc[key] || 0) + parseInt(value.quantity || 0, 10);
            });
          }
          return acc;
        }, {});

        const patientDetailsSummary = data.reduce((acc, curr) => {
          if (curr.patient_details) {
            let details;
            try {
              details = typeof curr.patient_details === 'string' ? JSON.parse(curr.patient_details) : curr.patient_details;
            } catch (e) {
              console.error('Invalid JSON in patient_details:', curr.patient_details);
              return acc;
            }
            // Example: Counting patients by condition
            const condition = details.condition || 'Unknown';
            acc[condition] = (acc[condition] || 0) + 1;
          }
          return acc;
        }, {});

        const formattedProductEntriesSummary = Object.entries(productEntriesSummary)
          .map(([key, value]) => `${capitalizeFirstLetter(key)}: ${value}`)
          .join(', ');

        const formattedPatientDetailsSummary = Object.entries(patientDetailsSummary)
          .map(([key, value]) => `${capitalizeFirstLetter(key)}: ${value}`)
          .join(', ');

        summaryTable = [
          ['Total Work Orders', totalWorkOrders],
          ['Total Advance Details', totalAdvance.toFixed(2)],
          ['Total Subtotal', totalworkSubtotal.toFixed(2)],
          ['Total CGST', totalworkCGST.toFixed(2)],
          ['Total SGST', totalworkSGST.toFixed(2)],
          ['Total Amount', totalWorkAmount.toFixed(2)],
          ['Total B2B Orders', totalWorkB2B],
          ['Product Entries Summary', formattedProductEntriesSummary || 'N/A'],
          ['Patient Details Summary', formattedPatientDetailsSummary || 'N/A'],
        ];
        break;
      }
      case 'privilegecards': {
        const totalPrivilegeCards = data.length;
        const totalTopUp = data.reduce((acc, curr) => acc + (curr.top_up_amount || 0), 0);
        const totalLoyaltyPointsPrivilege = data.reduce(
          (acc, curr) => acc + (curr.loyalty_points || 0),
          0
        );
        const cardTierDistribution = data.reduce((acc, curr) => {
          acc[curr.card_tier] = (acc[curr.card_tier] || 0) + 1;
          return acc;
        }, {});

        const distributionText = Object.entries(cardTierDistribution)
          .map(([tier, count]) => `${capitalizeFirstLetter(tier)}: ${count}`)
          .join(', ');

        summaryTable = [
          ['Total Privilege Cards', totalPrivilegeCards],
          ['Total Top-Up Amount', totalTopUp.toFixed(2)],
          ['Total Loyalty Points', totalLoyaltyPointsPrivilege],
          ['Card Tier Distribution', distributionText],
        ];
        break;
      }
      case 'products': {
        const totalProducts = data.length;
        const totalQuantity = data.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        const totalRevenue = data.reduce((acc, curr) => acc + ((curr.price || 0) * (curr.quantity || 0)), 0);
        const averagePrice = totalQuantity ? (totalRevenue / totalQuantity) : 0;

        // Summarize HSN Code distribution
        const hsnCodeDistribution = data.reduce((acc, curr) => {
          const hsn = curr.hsn_code || 'Unknown';
          acc[hsn] = (acc[hsn] || 0) + 1;
          return acc;
        }, {});

        const formattedHsnCodeDistribution = Object.entries(hsnCodeDistribution)
          .map(([hsn, count]) => `${hsn}: ${count}`)
          .join(', ');

        summaryTable = [
          ['Total Products', totalProducts],
          ['Total Quantity', totalQuantity],
          ['Total Revenue', totalRevenue.toFixed(2)],
          ['Average Price per Product', averagePrice.toFixed(2)],
          ['HSN Code Distribution', formattedHsnCodeDistribution || 'N/A'],
        ];
        break;
      }
      default:
        summaryTable = [['No summary available.', '']];
    }

    // Generate the summary table
    doc.autoTable({
      startY: summaryStartY + 5,
      head: [['Metric', 'Value']],
      body: summaryTable,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 200, 0], halign: 'center' },
      margin: { left: 14, right: 14 },
      theme: 'striped',
      columnStyles: {
        0: { halign: 'left', cellWidth: 80 },
        1: { halign: 'right', cellWidth: 30 },
      },
    });

    // If report type is 'products', add detailed summary by Product ID
    if (reportType === 'products' && formattedProductIdSummary) {
      const detailedSummaryStartY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text('Detailed Summary by Product ID', 14, detailedSummaryStartY);
      doc.setFontSize(10);

      // Generate the detailed summary table
      doc.autoTable({
        startY: detailedSummaryStartY + 5,
        head: [['Product ID', 'Product Name', 'Total Quantity Sold', 'Total Revenue ()', 'Average Price ()']],
        body: formattedProductIdSummary.map((item) => [
          item['Product ID'],
          item['Product Name'],
          item['Total Quantity Sold'],
          item['Total Revenue'],
          item['Average Price'],
        ]),
        styles: { fontSize: 8, cellPadding: 1 },
        headStyles: { fillColor: [0, 200, 0], halign: 'center' },
        margin: { left: 14, right: 14 },
        theme: 'grid',
        columnStyles: {
          0: { halign: 'left', cellWidth: 30 },
          1: { halign: 'left', cellWidth: 50 },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'right', cellWidth: 40 },
          4: { halign: 'right', cellWidth: 40 },
        },
      });
    }

    // Save the PDF
    doc.save(`${reportDetails.type}-${reportType}-report-${reportDetails.identifier}.pdf`);
  };

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"
        } justify-center mt-20 p-10 rounded-xl mx-auto max-w-2xl bg-green-50 shadow-inner`}>
      <h2 className="text-2xl font-semibold text-center mb-6">Generate Reports</h2>

      <div className="mb-6 flex flex-col md:flex-row md:space-x-4">
        {/* Report Type Selection */}
        <div className="flex-1">
          <label className="block mb-2 font-medium">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="sales_orders">Sales Orders</option>
            <option value="work_orders">Work Orders</option>
            <option value="privilegecards">Privilege Cards</option>
            <option value="products">Products</option>
          </select>
        </div>

        {/* Report Period Selection */}
        <div className="flex-1">
          <label className="block mb-2 font-medium">Report Period</label>
          <select
            value={reportPeriod}
            onChange={(e) => {
              setReportPeriod(e.target.value);
              // Reset date inputs when report period changes
              setDate('');
              setMonthYear('');
            }}
            className="w-full p-2 border rounded"
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      {/* Date Selection */}
      {reportPeriod === 'daily' ? (
        <div className="mb-6">
          <label className="block mb-2 font-medium">Select Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
      ) : (
        <div className="mb-6">
          <label className="block mb-2 font-medium">Select Month and Year</label>
          <input
            type="month"
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
      )}

      {/* Error and Success Messages */}
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {success && <p className="text-green-500 mb-4">{success}</p>}

      {/* Generate Report Button */}
      <button
        onClick={handleGenerateReport}
        className={`w-full p-2 text-white rounded ${
          loading
            ? 'bg-blue-500 cursor-not-allowed'
            : 'bg-green-500 hover:bg-blue-600'
        }`}
        disabled={loading}
      >
        {loading ? 'Generating Report...' : 'Generate Report'}
      </button>
    </div>
  );
};

export default ReportGenerator;

// client/src/components/ReportGenerator.jsx

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { convertUTCToIST } from '../utils/dateUtils';
import logo from '../assets/sreenethraenglishisolated.png';

// Helper function to get dynamic column styles based on report type
const getColumnStyles = (reportType, availableWidth) => {
  switch (reportType) {
    case 'sales_orders':
      return {
        0: { halign: 'left', cellWidth: 20 },  // Sales Order ID
        1: { halign: 'left', cellWidth: 20 },  // MR Number
        2: { halign: 'center', cellWidth: 10 }, // Is B2B
        3: { halign: 'right', cellWidth: 15 }, // Sale Value
        4: { halign: 'right', cellWidth: 10 }, // CGST
        5: { halign: 'right', cellWidth: 10 }, // SGST
        6: { halign: 'right', cellWidth: 15 }, // Total Amount
        7: { halign: 'left', cellWidth: 20 },  // Employee (wrap)
        8: { halign: 'left', cellWidth: 25 },  // Payment Method (wrap)
        9: { halign: 'right', cellWidth: 15 }, // Loyalty Points Redeemed
        10: { halign: 'right', cellWidth: 15 }, // Loyalty Points Added
        11: { halign: 'center', cellWidth: 20 }, // Created At
        12: { halign: 'center', cellWidth: 20 }, // Updated At
      };
    case 'work_orders':
      return {
        0: { halign: 'left', cellWidth: 30 }, // Work Order ID
        1: { halign: 'right', cellWidth: 15 }, // Advance Details
        2: { halign: 'center', cellWidth: 20 }, // Due Date
        3: { halign: 'left', cellWidth: 15 }, // MR Number
        4: { halign: 'left', cellWidth: 20 }, // Employee (wrap)
        5: { halign: 'left', cellWidth: 25 }, // Payment Method (wrap)
        6: { halign: 'right', cellWidth: 15 }, // Total Amount
        7: { halign: 'right', cellWidth: 10 }, // CGST
        8: { halign: 'right', cellWidth: 10 }, // SGST
        9: { halign: 'center', cellWidth: 10 }, // Is B2B
        10: { halign: 'left', cellWidth: 25 }, // HSN Code
        11: { halign: 'center', cellWidth: 20 }, // Created At
        12: { halign: 'center', cellWidth: 20 }, // Updated At
      };
    case 'privilegecards':
      return {
        0: { halign: 'left', cellWidth: 20 }, // PC Number
        1: { halign: 'left', cellWidth: 25 }, // Customer Name
        2: { halign: 'left', cellWidth: 20 }, // Phone Number
        3: { halign: 'right', cellWidth: 15 }, // Top-Up Amount
        4: { halign: 'right', cellWidth: 15 }, // Loyalty Points
        5: { halign: 'left', cellWidth: 15 }, // Card Tier
        6: { halign: 'center', cellWidth: 20 }, // Created At
      };
    case 'products':
      return {
        0: { halign: 'left', cellWidth: 10 }, // ID
        1: { halign: 'left', cellWidth: 15 }, // Work Order ID
        2: { halign: 'left', cellWidth: 40 }, // Product Name (wrap)
        3: { halign: 'left', cellWidth: 20 }, // Product ID
        4: { halign: 'right', cellWidth: 15 }, // Price
        5: { halign: 'right', cellWidth: 10 }, // Quantity
        6: { halign: 'left', cellWidth: 15 }, // HSN Code
        7: { halign: 'center', cellWidth: 20 }, // Created At
        8: { halign: 'center', cellWidth: 20 }, // Updated At
      };
    default:
      return {};
  }
};

// Helper functions for header and footer
const addHeader = (doc, logoDataUrl, reportDetails) => {
  if (logoDataUrl) {
    const imgProps = doc.getImageProperties(logoDataUrl);
    const pdfWidth = doc.internal.pageSize.getWidth();
    const imgWidth = 50; // Adjust the width as needed
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width; // Maintain aspect ratio
    const xPos = (pdfWidth - imgWidth) / 2; // Center horizontally
    const yPos = 10; // Position from top
    doc.addImage(logoDataUrl, 'PNG', xPos, yPos, imgWidth, imgHeight);
  }

  doc.setFontSize(10);
  doc.text('GSTIN: 32AAUCS7002H1ZV', doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Report Type: ${reportDetails.type}`, 14, 45);
  
  if (reportDetails.type === 'Daily') {
    doc.text(`Date: ${reportDetails.date}`, 14, 52);
  } else if (reportDetails.type === 'Monthly') {
    doc.text(`Month: ${reportDetails.month}/${reportDetails.year}`, 14, 52);
  } else if (reportDetails.type === 'Date Range') {
    doc.text(`From Date: ${reportDetails.fromDate}`, 14, 52);
    doc.text(`To Date: ${reportDetails.toDate}`, 14, 59);
  }
};

const addFooter = (doc) => {
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }
};

const ReportGenerator = ({ isCollapsed }) => {
  // State Variables
  const [reportType, setReportType] = useState('sales_orders'); // 'sales_orders', 'work_orders', 'privilegecards', 'products'
  const [reportPeriod, setReportPeriod] = useState('daily'); // 'daily', 'monthly', 'range'
  const [date, setDate] = useState(''); // For daily reports
  const [monthYear, setMonthYear] = useState(''); // For monthly reports (format: YYYY-MM)
  const [fromDate, setFromDate] = useState(''); // Start date for range reports
  const [toDate, setToDate] = useState(''); // End date for range reports
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [logoDataUrl, setLogoDataUrl] = useState('');
  const pageWidth = 297; // A4 Landscape width in mm
  const leftMargin = 10;
  const rightMargin = 10;
  const availableWidth = pageWidth - leftMargin - rightMargin; // 277mm

  // References for inputs and buttons
  const reportTypeRef = useRef();
  const reportPeriodRef = useRef();
  const dateRef = useRef();
  const monthYearRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();
  const generateButtonRef = useRef();

  useEffect(() => {
    const convertImageToDataUrl = (image) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = image;
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
        };
        img.onerror = (err) => {
          reject(err);
        };
      });
    };

    convertImageToDataUrl(logo)
      .then((dataUrl) => setLogoDataUrl(dataUrl))
      .catch((err) => console.error('Failed to load logo image:', err));
  }, []);

  // Utility functions
  const getLastDayOfMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

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
      } else if (reportPeriod === 'monthly') {
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
      } else if (reportPeriod === 'range') {
        if (!fromDate || !toDate) {
          setError('Please select both start and end dates for the report.');
          setLoading(false);
          return;
        }
        const start = new Date(fromDate);
        const end = new Date(toDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          setError('Invalid dates selected.');
          setLoading(false);
          return;
        }
        if (start > end) {
          setError('Start date cannot be after end date.');
          setLoading(false);
          return;
        }
        startDate = new Date(`${fromDate}T00:00:00Z`);
        endDate = new Date(`${toDate}T23:59:59Z`);
        reportDetails = {
          type: 'Date Range',
          fromDate: convertUTCToIST(startDate.toISOString(), "dd-MM-yyyy"),
          toDate: convertUTCToIST(endDate.toISOString(), "dd-MM-yyyy"),
          identifier: `${fromDate}_to_${toDate}`,
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
            .sort((a, b) => b['Total Revenue'] - a['Total Revenue']); // Optional: Sort by revenue
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
    const doc = new jsPDF('landscape'); // Landscape orientation
    doc.setFont('Helvetica', '');

    // Add Header
    addHeader(doc, logoDataUrl, reportDetails);

    // Determine table columns based on report type
    let tableColumn = [];
    switch (reportType) {
      case 'sales_orders':
        tableColumn = [
          'Sales Order ID',
          'MR Number',
          'Is B2B',
          'Sale Value',
          'CGST',
          'SGST',
          'Total Amount',
          'Employee',
          'Payment Method',
          'Loyalty Points Redeemed',
          'Loyalty Points Added',
          'Created At',
          'Updated At',
        ];
        break;
      case 'work_orders':
        tableColumn = [
          'Work Order ID',
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
            record.loyalty_points_added !== undefined
              ? record.loyalty_points_added
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
      startY: 70, // Adjusted to utilize more vertical space
      styles: { fontSize: 10, cellPadding: 1 }, // Increased fontSize and cellPadding
      headStyles: { fillColor: [41, 128, 185], halign: 'center', textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: leftMargin, right: rightMargin },
      theme: 'striped',
      showHead: 'everyPage',
      pageBreak: 'auto',
      columnStyles: getColumnStyles(reportType, availableWidth),
    });

    // Calculate and Add Summary
    let summaryStartY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text('Summary', 14, summaryStartY);
    doc.setFontSize(10); // Increased font size for summary

    let summaryTable = [];

    switch (reportType) {
      case 'sales_orders': {
        const totalSalesOrders = data.length;
        const totalAdvancePayments = data.reduce((acc, curr) => acc + (curr.advance_details || 0), 0);
        const totalSaleValue = data.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
        const totalCGST = data.reduce((acc, curr) => acc + (curr.cgst || 0), 0);
        const totalSGST = data.reduce((acc, curr) => acc + (curr.sgst || 0), 0);
        const totalAmount = data.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        const totalLoyaltyPointsAdded = data.reduce((acc, curr) => acc + (curr.loyalty_points_added || 0), 0);
        const totalLoyaltyPoints = data.reduce(
          (acc, curr) => acc + (curr.loyalty_points_redeemed || 0),
          0
        );
        const totalB2B = data.reduce((acc, curr) => acc + (curr.is_b2b ? 1 : 0), 0);

        summaryTable = [
          ['Total Sales Orders', totalSalesOrders],
          ['Total Advance Payments', totalAdvancePayments.toFixed(2)],
          ['Total Sale Value', totalSaleValue.toFixed(2)],
          ['Total CGST', totalCGST.toFixed(2)],
          ['Total SGST', totalSGST.toFixed(2)],
          ['Total Amount', totalAmount.toFixed(2)],
          ['Total Loyalty Points Added', totalLoyaltyPointsAdded],
          ['Total Loyalty Points Redeemed', totalLoyaltyPoints],
          ['Total B2B Orders', totalB2B],
        ];
        break;
      }
      case 'work_orders': {
        const totalWorkOrders = data.length;
        const totalAdvance = data.reduce((acc, curr) => acc + (curr.advance_details || 0), 0);
        const totalWorkAmount = data.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        const totalSaleValue = data.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
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
          ['Total Sale Value', totalSaleValue.toFixed(2)],
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
      styles: { fontSize: 10, cellPadding: 1.5, overflow: 'linebreak' }, // Increased fontSize and cellPadding
      headStyles: { fillColor: [41, 128, 185], halign: 'center', textColor: 255 },
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
      doc.setFontSize(10); // Increased font size for detailed summary

      // Generate the detailed summary table
      doc.autoTable({
        startY: detailedSummaryStartY + 5,
        head: [['Product ID', 'Product Name', 'Total Quantity Sold', 'Total Revenue', 'Average Price']],
        body: formattedProductIdSummary.map((item) => [
          item['Product ID'],
          item['Product Name'],
          item['Total Quantity Sold'],
          item['Total Revenue'],
          item['Average Price'],
        ]),
        styles: { fontSize: 10, cellPadding: 1.5, overflow: 'linebreak' }, // Increased fontSize and cellPadding
        headStyles: { fillColor: [41, 128, 185], halign: 'center', textColor: 255 },
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

    // Add Footer with page numbers
    addFooter(doc);

    // Save the PDF
    let fileName = `${reportDetails.type}-${reportType}-report-${reportDetails.identifier}.pdf`;
    doc.save(fileName);
  };

  // Function to get dynamic column styles based on report type
  const getColumnStyles = (reportType, availableWidth) => {
    switch (reportType) {
      case 'sales_orders':
        return {
          0: { halign: 'left', cellWidth: 20 },  // Sales Order ID
          1: { halign: 'left', cellWidth: 20 },  // MR Number
          2: { halign: 'center', cellWidth: 10 }, // Is B2B
          3: { halign: 'right', cellWidth: 15 }, // Sale Value
          4: { halign: 'right', cellWidth: 10 }, // CGST
          5: { halign: 'right', cellWidth: 10 }, // SGST
          6: { halign: 'right', cellWidth: 15 }, // Total Amount
          7: { halign: 'left', cellWidth: 20 },  // Employee (increased to wrap)
          8: { halign: 'left', cellWidth: 25 },  // Payment Method (increased to wrap)
          9: { halign: 'right', cellWidth: 15 }, // Loyalty Points Redeemed
          10: { halign: 'right', cellWidth: 15 }, // Loyalty Points Added
          11: { halign: 'center', cellWidth: 20 }, // Created At
          12: { halign: 'center', cellWidth: 20 }, // Updated At
        };
      case 'work_orders':
        return {
          0: { halign: 'left', cellWidth: 30 }, // Work Order ID
          1: { halign: 'right', cellWidth: 15 }, // Advance Details
          2: { halign: 'center', cellWidth: 20 }, // Due Date
          3: { halign: 'left', cellWidth: 15 }, // MR Number
          4: { halign: 'left', cellWidth: 20 }, // Employee (increased to wrap)
          5: { halign: 'left', cellWidth: 25 }, // Payment Method (increased to wrap)
          6: { halign: 'right', cellWidth: 15 }, // Total Amount
          7: { halign: 'right', cellWidth: 10 }, // CGST
          8: { halign: 'right', cellWidth: 10 }, // SGST
          9: { halign: 'center', cellWidth: 10 }, // Is B2B
          10: { halign: 'left', cellWidth: 25 }, // HSN Code
          11: { halign: 'center', cellWidth: 20 }, // Created At
          12: { halign: 'center', cellWidth: 20 }, // Updated At
        };
      case 'privilegecards':
        return {
          0: { halign: 'left', cellWidth: 20 }, // PC Number
          1: { halign: 'left', cellWidth: 25 }, // Customer Name
          2: { halign: 'left', cellWidth: 20 }, // Phone Number
          3: { halign: 'right', cellWidth: 15 }, // Top-Up Amount
          4: { halign: 'right', cellWidth: 15 }, // Loyalty Points
          5: { halign: 'left', cellWidth: 15 }, // Card Tier
          6: { halign: 'center', cellWidth: 20 }, // Created At
        };
      case 'products':
        return {
          0: { halign: 'left', cellWidth: 10 }, // ID
          1: { halign: 'left', cellWidth: 15 }, // Work Order ID
          2: { halign: 'left', cellWidth: 40 }, // Product Name (increased to wrap)
          3: { halign: 'left', cellWidth: 20 }, // Product ID
          4: { halign: 'right', cellWidth: 15 }, // Price
          5: { halign: 'right', cellWidth: 10 }, // Quantity
          6: { halign: 'left', cellWidth: 15 }, // HSN Code
          7: { halign: 'center', cellWidth: 20 }, // Created At
          8: { halign: 'center', cellWidth: 20 }, // Updated At
        };
      default:
        return {};
    }
  };

  const handleKeyDown = (event, nextRef) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      }
    }
  };

  return (
    <div
      className={`transition-all duration-300 ${
        isCollapsed ? "mx-20" : "mx-20 px-20"
      } justify-center mt-20 py-10 rounded-xl mx-auto max-w-2xl bg-green-50 shadow-inner`}
    >
      <h2 className="text-2xl font-semibold text-center mb-6">Generate Reports</h2>

      <div className="mb-6 flex flex-col md:flex-row md:space-x-4">
        {/* Report Type Selection */}
        <div className="flex-1">
          <label htmlFor="reportType" className="block mb-2 font-medium">Report Type</label>
          <select
            id="reportType"
            ref={reportTypeRef}
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, reportPeriodRef)}
            className="w-full p-2 border rounded"
            aria-label="Select Report Type"
          >
            <option value="sales_orders">Sales Orders</option>
            <option value="work_orders">Work Orders</option>
            <option value="privilegecards">Privilege Cards</option>
            <option value="products">Products</option>
          </select>
        </div>

        {/* Report Period Selection */}
        <div className="flex-1">
          <label htmlFor="reportPeriod" className="block mb-2 font-medium">Report Period</label>
          <select
            id="reportPeriod"
            value={reportPeriod}
            ref={reportPeriodRef}
            onChange={(e) => {
              setReportPeriod(e.target.value);
              // Reset date inputs when report period changes
              setDate('');
              setMonthYear('');
              setFromDate('');
              setToDate('');
            }}
            onKeyDown={(e) => handleKeyDown(e, reportPeriod === 'daily' ? dateRef : reportPeriod === 'monthly' ? monthYearRef : fromDateRef)}
            className="w-full p-2 border rounded"
            aria-label="Select Report Period"
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="range">Date Range</option>
          </select>
        </div>
      </div>

      {/* Date Selection */}
      {reportPeriod === 'daily' ? (
        <div className="mb-6">
          <label htmlFor="selectDate" className="block mb-2 font-medium">Select Date</label>
          <input
            type="date"
            id="selectDate"
            ref={dateRef}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, generateButtonRef)}
            className="w-full p-2 border rounded"
            required
            aria-required="true"
          />
        </div>
      ) : reportPeriod === 'monthly' ? (
        <div className="mb-6">
          <label htmlFor="selectMonthYear" className="block mb-2 font-medium">Select Month and Year</label>
          <input
            type="month"
            id="selectMonthYear"
            ref={monthYearRef}
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, generateButtonRef)}
            className="w-full p-2 border rounded"
            required
            aria-required="true"
          />
        </div>
      ) : reportPeriod === 'range' ? (
        <div className="mb-6 flex flex-col md:flex-row md:space-x-4">
          {/* From Date */}
          <div className="flex-1">
            <label htmlFor="fromDate" className="block mb-2 font-medium">From Date</label>
            <input
              type="date"
              id="fromDate"
              value={fromDate}
              ref={fromDateRef}
              onChange={(e) => setFromDate(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, toDateRef)}
              className="w-full p-2 border rounded"
              required
              aria-required="true"
            />
          </div>
          {/* To Date */}
          <div className="flex-1">
            <label htmlFor="toDate" className="block mb-2 font-medium">To Date</label>
            <input
              type="date"
              id="toDate"
              value={toDate}
              ref={toDateRef}
              onChange={(e) => setToDate(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, generateButtonRef)}
              className="w-full p-2 border rounded"
              required
              aria-required="true"
            />
          </div>
        </div>
      ) : null}

      {/* Error and Success Messages */}
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

      {/* Generate Report Button */}
      <button
        ref={generateButtonRef}
        onClick={handleGenerateReport}
        className={`w-full p-2 text-white rounded flex items-center justify-center ${
          loading
            ? 'bg-blue-500 cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-600'
        }`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleGenerateReport();
        }}
        disabled={loading}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5 mr-3 border-t-2 border-b-2 border-white rounded-full" viewBox="0 0 24 24"></svg>
            Generating Report...
          </>
        ) : (
          'Generate Report'
        )}
      </button>
    </div>
  );
};



export default ReportGenerator;

// client/src/components/ReportGenerator.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import supabase from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { convertUTCToIST } from '../utils/dateUtils';
import logo from '../assets/sreenethraenglishisolated.png';
import { useAuth } from '../context/AuthContext';
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

// Utility function to capitalize the first letter
const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Define column styles outside the component for better reusability
const getColumnStyles = (reportType) => {
  switch (reportType) {
    case 'sales_orders':
      return {
        0: { halign: 'center', cellWidth: 24 }, // Sales Order ID
        1: { halign: 'center', cellWidth: 19 }, // MR Number
        2: { halign: 'center', cellWidth: 14 }, // Is B2B
        3: { halign: 'center', cellWidth: 19 }, // Sale Value
        4: { halign: 'center', cellWidth: 14 }, // CGST
        5: { halign: 'center', cellWidth: 14 }, // SGST
        6: { halign: 'center', cellWidth: 19 }, // Total Amount
        7: { halign: 'center', cellWidth: 19 }, // Advance Paid
        8: { halign: 'center', cellWidth: 20 }, // Balance Due
        9: { halign: 'center', cellWidth: 19 }, // Employee
        10: { halign: 'center', cellWidth: 19 }, // Payment Method
        11: { halign: 'center', cellWidth: 22 }, // Loyalty Points Redeemed
        12: { halign: 'center', cellWidth: 22 }, // Loyalty Points Added
        13: { halign: 'center', cellWidth: 20 }, // Created At
        14: { halign: 'center', cellWidth: 20 }, // Updated At
      };
    case 'work_orders':
      return {
        0: { halign: 'center', cellWidth: 25 }, // Work Order ID
        1: { halign: 'center', cellWidth: 20 }, // Advance Details
        2: { halign: 'center', cellWidth: 20 }, // Due Date
        3: { halign: 'center', cellWidth: 20 }, // MR Number
        4: { halign: 'center', cellWidth: 20 }, // Employee
        5: { halign: 'center', cellWidth: 20 }, // Payment Method
        6: { halign: 'center', cellWidth: 20 }, // Total Amount
        7: { halign: 'center', cellWidth: 15 }, // CGST
        8: { halign: 'center', cellWidth: 15 }, // SGST
        9: { halign: 'center', cellWidth: 15 }, // Is B2B
        10: { halign: 'center', cellWidth: 20 }, // HSN Code
        11: { halign: 'center', cellWidth: 25 }, // Created At
        12: { halign: 'center', cellWidth: 25 }, // Updated At
        13: { halign: 'center', cellWidth: 20 }, // Branch
      };
    case 'privilegecards':
      return {
        0: { halign: 'center', cellWidth: 25 }, // PC Number
        1: { halign: 'center', cellWidth: 30 }, // Customer Name
        2: { halign: 'center', cellWidth: 20 }, // Phone Number
        3: { halign: 'center', cellWidth: 20 }, // Top-Up Amount
        4: { halign: 'center', cellWidth: 20 }, // Loyalty Points
        5: { halign: 'center', cellWidth: 20 }, // Card Tier
        6: { halign: 'center', cellWidth: 25 }, // Created At
        7: { halign: 'center', cellWidth: 20 }, // Branch
        8: { halign: 'center', cellWidth: 20 }, // Employee
      };
    case 'product_sales':
      return {
        0: { halign: 'center', cellWidth: 20 }, // Product ID
        1: { halign: 'center', cellWidth: 30 }, // Product Name
        2: { halign: 'center', cellWidth: 15 }, // MRP
        3: { halign: 'center', cellWidth: 15 }, // Rate
        4: { halign: 'center', cellWidth: 20 }, // HSN Code
        5: { halign: 'center', cellWidth: 20 }, // Total Quantity Sold
        6: { halign: 'center', cellWidth: 20 }, // Total Revenue
        7: { halign: 'center', cellWidth: 25 }, // Stock Created At
        8: { halign: 'center', cellWidth: 25 }, // Stock Updated At
        9: { halign: 'center', cellWidth: 20 }, // Current Stock Count (New Column)
      };
    case 'modification_reports':
      return {
        0: { halign: 'center', cellWidth: 20 }, // Request ID
        1: { halign: 'center', cellWidth: 25 }, // Order ID
        2: { halign: 'center', cellWidth: 20 }, // Order Type
        3: { halign: 'center', cellWidth: 25 }, // Employee Name
        4: { halign: 'center', cellWidth: 25 }, // Modification Type
        5: { halign: 'center', cellWidth: 30 }, // Modification Reason
        6: { halign: 'center', cellWidth: 20 }, // Status
        7: { halign: 'center', cellWidth: 30 }, // Rejection Reason (Fixed)
        8: { halign: 'center', cellWidth: 25 }, // Created At
        9: { halign: 'center', cellWidth: 25 }, // Updated At
      };
      case 'consolidated':
        return {
          0: { halign: 'center', cellWidth: 25 }, // Sales Order ID
          1: { halign: 'center', cellWidth: 25 }, // Work Order ID
          2: { halign: 'center', cellWidth: 25 }, // MR Number
          3: { halign: 'center', cellWidth: 25 }, // Total Amount
          4: { halign: 'center', cellWidth: 25 }, // Total GST
          5: { halign: 'center', cellWidth: 25 }, // Advance Collected
          6: { halign: 'center', cellWidth: 25 }, // Balance Collected
          7: { halign: 'center', cellWidth: 25 }, // Amount Left to Collect
          8: { halign: 'center', cellWidth: 25 }, // Branch
          9: { halign: 'center', cellWidth: 25 }, // Created At
          10: { halign: 'center', cellWidth: 25 }, // Updated At
        };
    case 'stock_report':
      return {
        0: { halign: 'center', cellWidth: 30 }, // Product ID
        1: { halign: 'center', cellWidth: 35 }, // Product Name
        2: { halign: 'center', cellWidth: 30 }, // MRP
        3: { halign: 'center', cellWidth: 30 }, // Rate
        4: { halign: 'center', cellWidth: 30 }, // HSN Code
        5: { halign: 'center', cellWidth: 30 }, // Total Sold
        6: { halign: 'center', cellWidth: 30 }, // Current Stock
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
    const imgWidth = 30; // Adjust the width as needed
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width; // Maintain aspect ratio
    const xPos = (pdfWidth - imgWidth) / 2; // Center horizontally
    const yPos = 10; // Position from top
    doc.addImage(logoDataUrl, 'PNG', xPos, yPos, imgWidth, imgHeight);
  }

  doc.setFontSize(10);
  doc.text('GSTIN: 32AAUCS7002H1ZB', doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });

  // Add Report Title
  doc.setFontSize(14);
  const reportTitle = `${capitalizeFirstLetter(reportDetails.type)} Report - ${capitalizeFirstLetter(
    reportDetails.reportTypeLabel
  )}`;
  doc.text(reportTitle, doc.internal.pageSize.getWidth() / 2, 45, { align: 'center' });

  // Add Report Period
  doc.setFontSize(10);
  let periodText = '';
  if (reportDetails.type === 'Daily') {
    periodText = `Date: ${reportDetails.date}`; // Use the raw date directly
  } else if (reportDetails.type === 'Monthly') {
    periodText = `Month: ${reportDetails.month}/${reportDetails.year}`;
  } else if (reportDetails.type === 'Date Range') {
    periodText = `From: ${reportDetails.fromDate} To: ${reportDetails.toDate}`;
  } else if (reportDetails.type === 'Consolidated') {
    periodText = `Period: ${reportDetails.fromDate} to ${reportDetails.toDate}`;
  }

  doc.text(periodText, doc.internal.pageSize.getWidth() / 2, 50, { align: 'center' });

  // Add Branch Information
  doc.setFontSize(10);
  const branchesText = `Branches: ${reportDetails.isCombined ? 'All Branches' : (reportDetails.branches && reportDetails.branches.length > 0 ? reportDetails.branches.join(', ') : 'N/A')}`;
  doc.text(branchesText, doc.internal.pageSize.getWidth() / 2, 55, { align: 'center' });
};

const addFooter = (doc) => {
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 5,
      { align: 'center' }
    );
  }
};

const ReportGenerator = ({ isCollapsed }) => {
  // State Variables
  const { branch: userBranch, name: employeeName, role } = useAuth(); // Fetch branch, employee name, and role from AuthContext
  const [reportType, setReportType] = useState(role === 'employee' ? 'consolidated' : 'sales_orders'); // Default based on role
  const [reportPeriod, setReportPeriod] = useState('daily'); // 'daily', 'monthly', 'range'
  const [date, setDate] = useState(''); // For daily reports
  const [monthYear, setMonthYear] = useState(''); // For monthly reports (format: YYYY-MM)
  const [fromDate, setFromDate] = useState(''); // Start date for range reports
  const [toDate, setToDate] = useState(''); // End date for range reports

  // Initialize selectedBranches based on role
  const [selectedBranches, setSelectedBranches] = useState(role === 'employee' ? [userBranch] : [userBranch]); // For employees, it's fixed to [userBranch]; admins can modify later

  const [allBranches, setAllBranches] = useState([]); // Fetch all branches from the database
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isCombined, setIsCombined] = useState(false); // For combined reports

  const [logoDataUrl, setLogoDataUrl] = useState('');

  // References for inputs and buttons
  const reportTypeRef = useRef();
  const reportPeriodRef = useRef();
  const dateRef = useRef();
  const monthYearRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();
  const branchSelectionRef = useRef();
  const generateButtonRef = useRef();

  // Determine if the user is an employee
  const isEmployee = role === 'employee';

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

  // Fetch all branches from the database (only if not employee)
  const fetchAllBranches = useCallback(async () => {
    const { data, error } = await supabase
      .from('branches') // Ensure you have a 'branches' table
      .select('branch_code, branch_name');

    if (error) {
      console.error("Error fetching branches:", error);
      return [];
    }

    return data.map(branch => ({ code: branch.branch_code, name: branch.branch_name }));
  }, []);

  useEffect(() => {
    const getBranches = async () => {
      if (!isEmployee) {
        const branches = await fetchAllBranches();
        setAllBranches(branches);
      }
    };
    getBranches();
  }, [fetchAllBranches, isEmployee]);

  // Utility function to get the last day of a month
  const getLastDayOfMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  // Handle Report Generation
  const handleGenerateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let fetchedData = [];
      let reportDetails = {};

      // Validate and Determine Date Range
      let startDate, endDate;
      let reportTypeLabel = '';
      let branchesToReport = isCombined ? [] : selectedBranches;

      // For employees, ensure branchesToReport is always [userBranch]
      if (isEmployee) {
        branchesToReport = [userBranch];
        setIsCombined(false); // Ensure isCombined is false for employees
      }

      if (reportPeriod === 'daily') {
        if (!date) {
          setError('Please select a date for the daily report.');
          setLoading(false);
          return;
        }
        const selectedDate = new Date(date); // Parse the date input
        if (isNaN(selectedDate.getTime())) {
          setError('Invalid date selected.');
          setLoading(false);
          return;
        }
        startDate = new Date(`${date}T00:00:00+05:30`); // IST timezone
        endDate = new Date(`${date}T23:59:59+05:30`);
        reportDetails = {
          type: 'Daily',
          date: date, // Pass the raw date string here
          identifier: date,
          reportTypeLabel: getReportTypeLabel(reportType),
          branches: branchesToReport,
          isCombined,
        };
      }
      else if (reportPeriod === 'monthly') {
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
        startDate = new Date(`${year}-${month}-01T00:00:00+05:30`);
        endDate = new Date(`${year}-${month}-${lastDay}T23:59:59+05:30`);
        reportDetails = {
          type: 'Monthly',
          month,
          year,
          identifier: `${month}-${year}`,
          reportTypeLabel: getReportTypeLabel(reportType),
          branches: branchesToReport,
          isCombined,
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
        startDate = new Date(`${fromDate}T00:00:00+05:30`);
        endDate = new Date(`${toDate}T23:59:59+05:30`);
        reportDetails = {
          type: 'Date Range',
          fromDate: convertUTCToIST(startDate.toISOString(), 'dd-MM-yyyy'),
          toDate: convertUTCToIST(endDate.toISOString(), 'dd-MM-yyyy'),
          identifier: `${fromDate}_to_${toDate}`,
          reportTypeLabel: getReportTypeLabel(reportType),
          branches: branchesToReport,
          isCombined,
        };
      }

      // Initialize variables for data and error
      let { data, error } = { data: [], error: null };

      // Initialize variable for formattedProductIdSummary
      let formattedProductIdSummary = null;

      // Fetch data based on report type
      switch (reportType) {
        case 'sales_orders': {
          const query = supabase
            .from('sales_orders')
            .select('*') // Ensure 'final_amount' is included
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (!isCombined) {
            query.in('branch', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'work_orders': {
          const query = supabase
            .from('work_orders')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (!isCombined) {
            query.in('branch', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'privilegecards': {
          const query = supabase
            .from('privilegecards')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (!isCombined) {
            query.in('branch', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'product_sales': {
          // Fetch stock entries with selected branches and include product details
          const query = supabase
            .from('stock')
            .select(`
              *,
              product:products(product_name, product_id, mrp, rate, hsn_code)
            `)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (!isCombined) {
            query.in('branch_code', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;

          if (fetchedData.length === 0) {
            setError('No stock records found for the selected period and branch.');
            setLoading(false);
            return;
          }

          // Combine stock and product data based on product_id
          const combinedData = fetchedData.map((stockItem) => {
            const product = stockItem.product || {};
            return {
              product_id: product.product_id || 'N/A',
              product_name: product.product_name || 'N/A',
              mrp: product.mrp || 'N/A',
              rate: product.rate || 'N/A',
              hsn_code: product.hsn_code || 'N/A',
              quantity: stockItem.quantity || 0,
              total_value: stockItem.total_value || 0,
              stock_created_at: convertUTCToIST(stockItem.created_at, 'dd-MM-yyyy hh:mm a'),
              stock_updated_at: convertUTCToIST(stockItem.updated_at, 'dd-MM-yyyy hh:mm a'),
              // Add any additional stock fields if necessary
            };
          });

          // Remove duplicates and summarize data by product_id
          const productSummary = combinedData.reduce((acc, curr) => {
            const pid = curr.product_id;
            if (!acc[pid]) {
              acc[pid] = {
                ...curr,
                total_quantity_sold: 0,
                total_revenue: 0,
                current_stock_count: 0,
              };
            }
            acc[pid].total_quantity_sold += curr.quantity;
            acc[pid].total_revenue += curr.total_value;
            acc[pid].current_stock_count += curr.quantity; // Assuming quantity represents current stock
            return acc;
          }, {});

          formattedProductIdSummary = Object.values(productSummary).map((item) => ({
            'Product ID': item.product_id,
            'Product Name': item.product_name,
            'MRP': item.mrp,
            'Rate': Number(item.rate).toFixed(2),
            'HSN Code': item.hsn_code,
            'Total Quantity Sold': item.total_quantity_sold,
            'Total Revenue': (item.mrp * item.total_quantity_sold).toFixed(2),
            'Stock Created At': item.stock_created_at,
            'Stock Updated At': item.stock_updated_at,
            'Current Stock Count': item.current_stock_count, // New Field
          }));
          break;
        }
        case 'modification_reports': {
          const query = supabase
            .from('modification_requests')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (!isCombined) {
            query.in('branch', branchesToReport); // Now works since 'branch' exists
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'consolidated': {
          // Fetch sales_orders
          const salesQuery = supabase
            .from('sales_orders')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (!isCombined) {
            salesQuery.in('branch', branchesToReport);
          }

          const { data: salesData, error: salesError } = await salesQuery;
          if (salesError) throw salesError;

          // Fetch work_orders
          const workQuery = supabase
            .from('work_orders')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (!isCombined) {
            workQuery.in('branch', branchesToReport);
          }

          const { data: workData, error: workError } = await workQuery;
          if (workError) throw workError;

          // Create a mapping of work orders by work_order_id
          const workOrdersMap = {};
          workData.forEach(work => {
            workOrdersMap[work.work_order_id] = work;
          });

          // Consolidate data based on work_order_id
          const consolidatedData = salesData.map(sale => {
            const relatedWork = workOrdersMap[sale.work_order_id] || {};

            // Calculate Total GST
            const totalGST = (sale.cgst || 0) + (sale.sgst || 0) + (relatedWork.cgst || 0) + (relatedWork.sgst || 0);

            // Total Amount is from Work Order Total Amount
            const totalAmount = relatedWork.total_amount || 0;

            // Advance Collected from Work Order
            const advanceCollected = relatedWork.advance_details || 0;

            // Balance Collected from Sales Order (Final Amount)
            const balanceCollected = sale.final_amount || 0;

            // Amount Left to Collect
            const amountLeftToCollect = totalAmount - (advanceCollected + balanceCollected);

            return {
              sales_order_id: sale.sales_order_id || 'N/A',
              work_order_id: sale.work_order_id || 'N/A',
              mr_number: sale.mr_number || relatedWork.mr_number || 'N/A',
              total_amount: totalAmount,
              total_gst: totalGST,
              advance_collected: advanceCollected,
              balance_collected: balanceCollected,
              amount_left_to_collect: amountLeftToCollect,
              branch: sale.branch || relatedWork.branch || 'N/A',
              created_at: sale.created_at ? convertUTCToIST(sale.created_at, 'dd-MM-yyyy hh:mm a') : (relatedWork.created_at ? convertUTCToIST(relatedWork.created_at, 'dd-MM-yyyy hh:mm a') : 'N/A'),
              updated_at: sale.updated_at ? convertUTCToIST(sale.updated_at, 'dd-MM-yyyy hh:mm a') : (relatedWork.updated_at ? convertUTCToIST(relatedWork.updated_at, 'dd-MM-yyyy hh:mm a') : 'N/A'),
            };
          });

          // For work orders without corresponding sales orders
          const additionalWorkOrders = workData.filter(work => !salesData.some(sale => sale.work_order_id === work.work_order_id));
          additionalWorkOrders.forEach(work => {
            const totalGST = (work.cgst || 0) + (work.sgst || 0);
            const totalAmount = work.total_amount || 0;
            const advanceCollected = work.advance_details || 0;
            const balanceCollected = 0; // Since no sales order
            const amountLeftToCollect = totalAmount - (advanceCollected + balanceCollected);

            consolidatedData.push({
              sales_order_id: 'N/A',
              work_order_id: work.work_order_id || 'N/A',
              mr_number: work.mr_number || 'N/A',
              total_amount: totalAmount,
              total_gst: totalGST,
              advance_collected: advanceCollected,
              balance_collected: balanceCollected,
              amount_left_to_collect: amountLeftToCollect,
              branch: work.branch || 'N/A',
              created_at: work.created_at ? convertUTCToIST(work.created_at, 'dd-MM-yyyy hh:mm a') : 'N/A',
              updated_at: work.updated_at ? convertUTCToIST(work.updated_at, 'dd-MM-yyyy hh:mm a') : 'N/A',
            });
          });

          fetchedData = consolidatedData;
          break;
        }
        case 'stock_report': {
          // Fetch products
          const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('*');

          if (productsError) throw productsError;

          // Fetch current stock
          const stockQuery = supabase
            .from('stock')
            .select('*');

          if (!isCombined) {
            stockQuery.in('branch_code', branchesToReport);
          }

          const { data: stockData, error: stockError } = await stockQuery;

          if (stockError) throw stockError;

          // Fetch sales data
          const salesQuery = supabase
            .from('sales_orders')
            .select('items')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

          if (!isCombined) {
            salesQuery.in('branch', branchesToReport);
          }

          const { data: salesData, error: salesError } = await salesQuery;

          if (salesError) throw salesError;

          // Aggregate sales data to get total quantity sold per product
          const productSales = {};

          salesData.forEach(sale => {
            const items = sale.items || [];
            items.forEach(product => {
              const pid = product.id; // Assuming 'id' refers to 'product_id'
              const quantity = parseInt(product.quantity) || 0;
              if (!productSales[pid]) {
                productSales[pid] = 0;
              }
              productSales[pid] += quantity;
            });
          });

          // Create a combined data structure
          const combinedData = productsData.map(product => {
            const pid = product.product_id;
            const stockItems = stockData.filter(stock => stock.product_id === product.id);
            let currentStock = 0;
            if (stockItems && stockItems.length > 0) {
              // Sum the stock quantities across branches
              currentStock = stockItems.reduce((acc, stock) => acc + (stock.quantity || 0), 0);
            }
            const totalSold = productSales[pid] || 0;
            return {
              product_id: pid,
              product_name: product.product_name,
              mrp: product.mrp,
              rate: product.rate,
              hsn_code: product.hsn_code,
              total_sold: totalSold,
              current_stock: currentStock,
            };
          });

          // Sort by product name
          combinedData.sort((a, b) => a.product_name.localeCompare(b.product_name));

          fetchedData = combinedData;
          break;
        }
        default:
          setError('Invalid report type selected.');
          setLoading(false);
          return;
      }

      if (fetchedData.length === 0) {
        setError('No records found for the selected period and branch.');
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
  }, [reportType, reportPeriod, date, monthYear, fromDate, toDate, selectedBranches, isCombined, isEmployee, userBranch]);

  // Helper function to get report type label
  const getReportTypeLabel = (reportType) => {
    switch (reportType) {
      case 'sales_orders':
        return 'Sales Orders';
      case 'work_orders':
        return 'Work Orders';
      case 'privilegecards':
        return 'Privilege Cards';
      case 'product_sales':
        return 'Product Sales';
      case 'modification_reports':
        return 'Modification Reports';
      case 'consolidated':
        return 'Consolidated';
      case 'stock_report':
        return 'Stock Report';
      default:
        return '';
    }
  };

  // Function to generate PDF
  const generatePDF = (data, reportDetails, reportType, formattedProductIdSummary) => {
    const doc = new jsPDF({
      orientation: 'landscape', // Landscape orientation
      unit: 'mm',
      format: 'a4', // Changed to A4 for more space
    });
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
          'Advance Paid',
          'Balance Due',
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
          'Branch',
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
          'Branch',
          'Employee',
        ];
        break;
      case 'product_sales':
        tableColumn = [
          'Product ID',
          'Product Name',
          'MRP',
          'Rate',
          'HSN Code',
          'Total Quantity Sold',
          'Total Revenue',
          'Stock Created At',
          'Stock Updated At',
          'Current Stock Count', // New Column
        ];
        break;
      case 'modification_reports':
        tableColumn = [
          'Request ID',
          'Order ID',
          'Order Type',
          'Employee Name',
          'Modification Type',
          'Modification Reason',
          'Status',
          'Rejection Reason', // Fixed Column
          'Created At',
          'Updated At',
        ];
        break;
        case 'consolidated':
          tableColumn = [
            'Sales Order ID',
            'Work Order ID',
            'MR Number',
            'Total Amount',
            'Total GST',
            'Advance Collected',
            'Balance Collected',
            'Amount Left to Collect',
            'Branch',
            'Created At',
            'Updated At',
          ];
          break;
      case 'stock_report':
        tableColumn = [
          'Product ID',
          'Product Name',
          'MRP',
          'Rate',
          'HSN Code',
          'Total Sold',
          'Current Stock',
        ];
        break;

      default:
        tableColumn = [];
    }

    // Prepare table rows
    let tableRows = [];
    switch (reportType) {
      case 'sales_orders':
        tableRows = data.map((record) => [
          record.sales_order_id || 'N/A',
          record.mr_number || 'N/A',
          record.is_b2b ? 'Yes' : 'No',
          record.subtotal ? Number(record.subtotal).toFixed(2) : '0.00',
          record.cgst ? Number(record.cgst).toFixed(2) : '0.00',
          record.sgst ? Number(record.sgst).toFixed(2) : '0.00',
          record.total_amount ? Number(record.total_amount).toFixed(2) : '0.00',
          record.advance_details ? Number(record.advance_details).toFixed(2) : '0.00',
          record.final_amount !== undefined
            ? Number(record.final_amount).toFixed(2)
            : '0.00', // Balance Due
          record.employee || 'N/A',
          record.payment_method || 'N/A',
          record.loyalty_points_redeemed !== undefined
            ? record.loyalty_points_redeemed
            : '0',
          record.loyalty_points_added !== undefined
            ? record.loyalty_points_added
            : '0',
          record.created_at
            ? convertUTCToIST(record.created_at, 'dd-MM-yyyy hh:mm a')
            : 'N/A',
          record.updated_at
            ? convertUTCToIST(record.updated_at, 'dd-MM-yyyy hh:mm a')
            : 'N/A',
        ]);
        break;
      case 'work_orders':
        tableRows = data.map((record) => [
          record.work_order_id || 'N/A',
          record.advance_details
            ? Number(record.advance_details).toFixed(2)
            : '0.00',
          record.due_date ? convertUTCToIST(record.due_date, 'dd-MM-yyyy') : 'N/A',
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
            ? convertUTCToIST(record.created_at, 'dd-MM-yyyy hh:mm a')
            : 'N/A',
          record.updated_at
            ? convertUTCToIST(record.updated_at, 'dd-MM-yyyy hh:mm a')
            : 'N/A',
          record.branch || 'N/A', // Branch
        ]);
        break;
      case 'privilegecards':
        tableRows = data.map((record) => [
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
            ? convertUTCToIST(record.created_at, 'dd-MM-yyyy hh:mm a')
            : 'N/A',
          record.branch || 'N/A', // Branch
          record.employee_name || 'N/A', // Employee
        ]);
        break;
      case 'product_sales':
        tableRows = formattedProductIdSummary.map((item) => [
          item['Product ID'],
          item['Product Name'],
          item['MRP'],
          item['Rate'],
          item['HSN Code'],
          item['Total Quantity Sold'],
          item['Total Revenue'],
          item['Stock Created At'],
          item['Stock Updated At'],
          item['Current Stock Count'], // New Field
        ]);
        break;
      case 'modification_reports':
        tableRows = data.map((record) => [
          record.request_id || 'N/A',
          record.order_id || 'N/A',
          record.order_type || 'N/A',
          record.employee_name || 'N/A',
          record.modification_type || 'N/A',
          record.modification_reason || 'N/A',
          capitalizeFirstLetter(record.status) || 'N/A',
          record.rejection_reason || 'N/A', // Fixed Column
          record.created_at
            ? convertUTCToIST(record.created_at, 'dd-MM-yyyy hh:mm a')
            : 'N/A',
          record.updated_at
            ? convertUTCToIST(record.updated_at, 'dd-MM-yyyy hh:mm a')
            : 'N/A',
        ]);
        break;
        case 'consolidated':
          tableRows = data.map((record) => [
            record.sales_order_id || 'N/A',
            record.work_order_id || 'N/A',
            record.mr_number || 'N/A',
            record.total_amount ? Number(record.total_amount).toFixed(2) : '0.00',
            record.total_gst ? Number(record.total_gst).toFixed(2) : '0.00',
            record.advance_collected ? Number(record.advance_collected).toFixed(2) : '0.00',
            record.balance_collected ? Number(record.balance_collected).toFixed(2) : '0.00',
            record.amount_left_to_collect ? Number(record.amount_left_to_collect).toFixed(2) : '0.00',
            record.branch || 'N/A',
            record.created_at || 'N/A',
            record.updated_at || 'N/A',
          ]);
          break;
      case 'stock_report':
        tableRows = data.map((item) => [
          item.product_id || 'N/A',
          item.product_name || 'N/A',
          item.mrp ? Number(item.mrp).toFixed(2) : '0.00',
          item.rate ? Number(item.rate).toFixed(2) : '0.00',
          item.hsn_code || 'N/A',
          item.total_sold || 0,
          item.current_stock || 0,
        ]);
        break;
      default:
        tableRows = [];
    }

    // Generate the main table
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 65, // Adjusted to utilize more vertical space
      styles: {
        fontSize: 7,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak',
        cellWidth: 'wrap',
      }, // Smaller font, linebreak for overflow
      headStyles: {
        fillColor: [0, 160, 0], // Green header
        halign: 'center',
        textColor: 255,
        fontSize: 9,
        overflow: 'linebreak',
        cellWidth: 'wrap',
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 10, right: 10 },
      theme: 'striped',
      showHead: 'everyPage',
      pageBreak: 'auto',
      columnStyles: getColumnStyles(reportType),
    });

    // Calculate and Add Summary
    let summaryStartY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text('Summary', 10, summaryStartY);
    doc.setFontSize(7); // Adjusted font size for summary

    let summaryTable = [];

    // Example summary data based on report type
    switch (reportType) {
      case 'sales_orders': {
        const totalSales = data.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        const totalBalanceDue = data.reduce((acc, curr) => acc + (curr.final_amount || 0), 0);
        const totalCGST = data.reduce((acc, curr) => acc + (curr.cgst || 0), 0);
        const totalSGST = data.reduce((acc, curr) => acc + (curr.sgst || 0), 0);
        summaryTable = [
          ['Total Amount Overall (without Advances)', totalSales.toFixed(2)],
          ['Total Sales Amount (Balance Collected)', totalBalanceDue.toFixed(2)], // Updated to use Balance Due
          ['Total CGST', totalCGST.toFixed(2)],
          ['Total SGST', totalSGST.toFixed(2)],
        ];
        break;
      }
      case 'work_orders': {
        const totalWorkAmount = data.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        const totalAdvance = data.reduce((acc, curr) => acc + (curr.advance_details || 0), 0);
        summaryTable = [
          ['Total Work Orders', data.length],
          ['Total Advances from Work Orders', totalAdvance.toFixed(2)], // Clarified label
          ['Total Work Amount', totalWorkAmount.toFixed(2)],
        ];
        break;
      }
      case 'privilegecards': {
        const totalCards = data.length;
        const totalLoyaltyPoints = data.reduce((acc, curr) => acc + (curr.loyalty_points || 0), 0);
        summaryTable = [
          ['Total Privilege Cards', totalCards],
          ['Total Loyalty Points', totalLoyaltyPoints],
        ];
        break;
      }
      case 'product_sales': {
        const totalQuantity = formattedProductIdSummary.reduce((acc, curr) => acc + Number(curr['Total Quantity Sold']), 0);
        const totalRevenue = formattedProductIdSummary.reduce((acc, curr) => acc + Number(curr['Total Revenue']), 0);
        const totalCurrentStock = formattedProductIdSummary.reduce((acc, curr) => acc + Number(curr['Current Stock Count']), 0);
        summaryTable = [
          ['Total Quantity Sold', totalQuantity],
          ['Total Revenue', totalRevenue.toFixed(2)],
          ['Total Current Stock Count', totalCurrentStock],
        ];
        break;
      }
      case 'modification_reports': {
        const totalModifications = data.length;
        const approvedModifications = data.filter(record => record.status === 'approved').length;
        const pendingModifications = data.filter(record => record.status === 'pending').length;
        const rejectedModifications = data.filter(record => record.status === 'rejected').length;
        summaryTable = [
          ['Total Modification Requests', totalModifications],
          ['Approved', approvedModifications],
          ['Pending', pendingModifications],
          ['Rejected', rejectedModifications],
        ];
        break;
      }
      case 'consolidated': {
        const totalAmount = data.reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
        const totalGST = data.reduce((acc, curr) => acc + (parseFloat(curr.total_gst) || 0), 0);
        const totalAdvanceCollected = data.reduce((acc, curr) => acc + (parseFloat(curr.advance_collected) || 0), 0);
        const totalBalanceCollected = data.reduce((acc, curr) => acc + (parseFloat(curr.balance_collected) || 0), 0);
        const totalAmountLeftToCollect = data.reduce((acc, curr) => acc + (parseFloat(curr.amount_left_to_collect) || 0), 0);

        summaryTable = [
          ['Total Amount', totalAmount.toFixed(2)],
          ['Total GST Collected', totalGST.toFixed(2)],
          ['Total Advance Collected', totalAdvanceCollected.toFixed(2)],
          ['Total Balance Collected', totalBalanceCollected.toFixed(2)],
          ['Total Amount Left to Collect', totalAmountLeftToCollect.toFixed(2)],
        ];
        break;
      }
      case 'stock_report': {
        const totalProducts = data.length;
        const totalQuantitySold = data.reduce((acc, curr) => acc + (curr.total_sold || 0), 0);
        const totalCurrentStock = data.reduce((acc, curr) => acc + (curr.current_stock || 0), 0);
        summaryTable = [
          ['Total Products', totalProducts],
          ['Total Quantity Sold', totalQuantitySold],
          ['Total Current Stock', totalCurrentStock],
        ];
        break;
      }
      default:
        summaryTable = [];
    }

    // Generate the summary table
    doc.autoTable({
      startY: summaryStartY + 5,
      head: [['Metric', 'Value']],
      body: summaryTable,
      styles: {
        fontSize: 7,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        overflow: 'linebreak',
        cellWidth: 'wrap',
      },
      headStyles: { fillColor: [41, 128, 185], halign: 'center', textColor: 255 },
      margin: { left: 10, right: 10 },
      theme: 'striped',
      columnStyles: {
        0: { halign: 'left', cellWidth: 80 }, // Increased width for metric names
        1: { halign: 'center', cellWidth: 40 },
      },
    });

    // Add Footer with page numbers
    addFooter(doc);

    // Save the PDF
    let fileName = `${reportDetails.type}-${reportType}-report-${reportDetails.identifier}.pdf`;
    doc.save(fileName);
  };

  // Handle keyboard navigation
  const handleKeyDown = (event, nextRef) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      } else {
        handleGenerateReport();
      }
    }
  };

  // Toggle selection for report scope (only for non-employees)
  const toggleReportScope = (scope) => {
    if (isEmployee) return; // Do nothing if employee
    if (scope === 'combined') {
      setIsCombined(true);
    } else {
      setIsCombined(false);
    }
  };

  // Toggle branch selection (only for non-employees)
  const toggleBranch = (branchCode) => {
    if (isEmployee) return; // Do nothing if employee
    if (selectedBranches.includes(branchCode)) {
      setSelectedBranches(selectedBranches.filter(code => code !== branchCode));
    } else {
      setSelectedBranches([...selectedBranches, branchCode]);
    }
  };

  // Define report types based on role
  const reportTypes = isEmployee ? [
    { value: 'consolidated', label: 'Consolidated' },
    { value: 'stock_report', label: 'Stock Report' },
  ] : [
    { value: 'sales_orders', label: 'Sales Orders' },
    { value: 'work_orders', label: 'Work Orders' },
    { value: 'privilegecards', label: 'Privilege Cards' },
    { value: 'product_sales', label: 'Product Sales' },
    { value: 'modification_reports', label: 'Modification Reports' },
    { value: 'consolidated', label: 'Consolidated' },
    { value: 'stock_report', label: 'Stock Report' },
  ];

  // Ensure reportType is valid for the current role
  useEffect(() => {
    if (!reportTypes.some(type => type.value === reportType)) {
      setReportType(reportTypes[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <div
      className={`flex justify-center transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-14'} my-20 px-4`}
    >
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Generate {capitalizeFirstLetter(reportType)} Report</h1>

        {/* Notification */}
        {error && (
          <div className="flex items-center mb-6 p-4 rounded-lg bg-red-100 text-red-700">
            <ExclamationCircleIcon className="w-6 h-6 mr-2" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center mb-6 p-4 rounded-lg bg-green-100 text-green-700">
            <CheckCircleIcon className="w-6 h-6 mr-2" />
            <span>{success}</span>
          </div>
        )}

        {/* Report Type and Period Selection */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Report Type Selection */}
            <div>
              <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 mb-1">
                Report Type
              </label>
              <select
                id="reportType"
                ref={reportTypeRef}
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                onKeyDown={(e) =>
                  handleKeyDown(e, reportPeriodRef)
                }
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                aria-label="Select Report Type"
              >
                {reportTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Report Period Selection */}
            <div>
              <label htmlFor="reportPeriod" className="block text-sm font-medium text-gray-700 mb-1">
                Report Period
              </label>
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
                onKeyDown={(e) =>
                  handleKeyDown(
                    e,
                    reportPeriod === 'daily'
                      ? dateRef
                      : reportPeriod === 'monthly'
                      ? monthYearRef
                      : fromDateRef
                  )
                }
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                aria-label="Select Report Period"
              >
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="range">Date Range</option>
              </select>
            </div>
          </div>

          {/* Report Scope Selection (Hidden for Employees) */}
          {!isEmployee && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Scope
              </label>
              <div className="flex space-x-4">
                {/* Branch-wise Button */}
                <button
                  type="button"
                  onClick={() => toggleReportScope('branch')}
                  onKeyDown={(e) => handleKeyDown(e, isCombined ? generateButtonRef : branchSelectionRef)}
                  className={`px-4 py-2 rounded-md border ${
                    !isCombined
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-700 border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                  aria-label="Select Branch-wise Report Scope"
                >
                  Branch-wise
                </button>
                {/* Combined Button */}
                <button
                  type="button"
                  onClick={() => toggleReportScope('combined')}
                  onKeyDown={(e) => handleKeyDown(e, generateButtonRef)}
                  className={`px-4 py-2 rounded-md border ${
                    isCombined
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-700 border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                  aria-label="Select Combined Report Scope"
                >
                  Combined (All Branches)
                </button>
              </div>
            </div>
          )}

          {/* Branch Selection (Visible only for non-employees and branch-wise reports) */}
          {!isEmployee && !isCombined && (
            <div className="mt-6">
              <label htmlFor="branchSelection" className="block text-sm font-medium text-gray-700 mb-2">
                Select Branches
              </label>
              <div className="flex flex-wrap gap-2">
                {allBranches.map((branch) => (
                  <button
                    key={branch.code}
                    type="button"
                    onClick={() => toggleBranch(branch.code)}
                    onKeyDown={(e) => handleKeyDown(e, e.target.nextSibling || generateButtonRef)}
                    className={`px-4 py-2 rounded-md border ${
                      selectedBranches.includes(branch.code)
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-gray-700 border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                    aria-label={`Toggle branch ${branch.name}`}
                  >
                    {branch.name}
                  </button>
                ))}
              </div>
              {!isEmployee && selectedBranches.length === 0 && (
                <p className="text-sm text-red-500 mt-1">Please select at least one branch.</p>
              )}
            </div>
          )}

          {/* Date Selection */}
          {reportPeriod === 'daily' ? (
            <div className="mt-6">
              <label htmlFor="selectDate" className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
              <input
                type="date"
                id="selectDate"
                ref={dateRef}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, isEmployee ? generateButtonRef : isCombined ? generateButtonRef : (reportPeriod === 'daily' ? generateButtonRef : branchSelectionRef))}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
                aria-required="true"
              />
            </div>
          ) : reportPeriod === 'monthly' ? (
            <div className="mt-6">
              <label htmlFor="selectMonthYear" className="block text-sm font-medium text-gray-700 mb-1">Select Month and Year</label>
              <input
                type="month"
                id="selectMonthYear"
                ref={monthYearRef}
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, isEmployee ? generateButtonRef : isCombined ? generateButtonRef : branchSelectionRef)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
                aria-required="true"
              />
            </div>
          ) : reportPeriod === 'range' ? (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* From Date */}
              <div>
                <label htmlFor="fromDate" className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  id="fromDate"
                  value={fromDate}
                  ref={fromDateRef}
                  onChange={(e) => setFromDate(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, toDateRef)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  required
                  aria-required="true"
                />
              </div>
              {/* To Date */}
              <div>
                <label htmlFor="toDate" className=" block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  id="toDate"
                  value={toDate}
                  ref={toDateRef}
                  onChange={(e) => setToDate(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, generateButtonRef)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  required
                  aria-required="true"
                />
              </div>
            </div>
          ) : null}

          {/* Generate Report Button */}
          <div className="mt-8 flex justify-center">
            <button
              ref={generateButtonRef}
              onClick={handleGenerateReport}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerateReport();
                }
              }}
              className={`w-full sm:w-1/2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md flex items-center justify-center transition ${
                loading || (!isCombined && !isEmployee && selectedBranches.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={loading || (!isCombined && !isEmployee && selectedBranches.length === 0)}
              aria-label="Generate Report"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-3 border-t-2 border-b-2 border-white rounded-full"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4"></path>
                  </svg>
                  Generating Report...
                </>
              ) : (
                'Generate Report'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;

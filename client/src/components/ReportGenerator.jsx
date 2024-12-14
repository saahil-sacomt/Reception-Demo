// client/src/components/ReportGenerator.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import supabase from '../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDateDDMMYYYY } from '../utils/dateUtils'; // Ensure formatDateDDMMYYYY is properly exported
import logo from '../assets/sreenethraenglishisolated.png';
import { useAuth } from '../context/AuthContext';
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { CSVLink } from 'react-csv';

// Utility function to capitalize the first letter
const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Define column styles outside the component for better reusability
const getColumnStyles = (reportType, isEmployee = false) => {
  // (No changes to this function, keep it as is.)
  switch (reportType) {
    case 'sales_orders':
      if (isEmployee) {
        return {
          0: { halign: 'center', cellWidth: 24 },
          1: { halign: 'center', cellWidth: 19 },
          2: { halign: 'center', cellWidth: 14 },
          3: { halign: 'center', cellWidth: 19 },
          4: { halign: 'center', cellWidth: 14 },
          5: { halign: 'center', cellWidth: 14 },
          6: { halign: 'center', cellWidth: 19 },
          7: { halign: 'center', cellWidth: 19 },
          8: { halign: 'center', cellWidth: 20 },
          9: { halign: 'center', cellWidth: 19 },
          10: { halign: 'center', cellWidth: 19 },
          11: { halign: 'center', cellWidth: 22 },
          12: { halign: 'center', cellWidth: 22 },
        };
      } else {
        return {
          0: { halign: 'center', cellWidth: 24 },
          1: { halign: 'center', cellWidth: 19 },
          2: { halign: 'center', cellWidth: 14 },
          3: { halign: 'center', cellWidth: 19 },
          4: { halign: 'center', cellWidth: 14 },
          5: { halign: 'center', cellWidth: 14 },
          6: { halign: 'center', cellWidth: 19 },
          7: { halign: 'center', cellWidth: 19 },
          8: { halign: 'center', cellWidth: 20 },
          9: { halign: 'center', cellWidth: 19 },
          10: { halign: 'center', cellWidth: 19 },
          11: { halign: 'center', cellWidth: 22 },
          12: { halign: 'center', cellWidth: 22 },
          13: { halign: 'center', cellWidth: 20 },
          14: { halign: 'center', cellWidth: 20 },
        };
      }

    case 'work_orders':
      if (isEmployee) {
        return {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 15 },
          8: { halign: 'center', cellWidth: 15 },
          9: { halign: 'center', cellWidth: 15 },
          10: { halign: 'center', cellWidth: 20 },
          11: { halign: 'center', cellWidth: 20 },
        };
      } else {
        return {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 15 },
          8: { halign: 'center', cellWidth: 15 },
          9: { halign: 'center', cellWidth: 15 },
          10: { halign: 'center', cellWidth: 20 },
          11: { halign: 'center', cellWidth: 25 },
          12: { halign: 'center', cellWidth: 25 },
          13: { halign: 'center', cellWidth: 20 },
        };
      }

    case 'privilegecards':
      if (isEmployee) {
        return {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 20 },
        };
      } else {
        return {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 25 },
          7: { halign: 'center', cellWidth: 20 },
          8: { halign: 'center', cellWidth: 20 },
        };
      }

    case 'product_sales':
      if (isEmployee) {
        return {
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 40 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 20 },
        };
      } else {
        return {
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 40 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 25 },
          8: { halign: 'center', cellWidth: 25 },
          9: { halign: 'center', cellWidth: 20 },
        };
      }

    case 'modification_reports':
      if (isEmployee) {
        return {
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 25 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 25 },
          4: { halign: 'center', cellWidth: 35 },
          5: { halign: 'center', cellWidth: 35 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 35 },
        };
      } else {
        return {
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 25 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 25 },
          4: { halign: 'center', cellWidth: 35 },
          5: { halign: 'center', cellWidth: 35 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 35 },
          8: { halign: 'center', cellWidth: 25 },
          9: { halign: 'center', cellWidth: 25 },
        };
      }

    case 'consolidated':
      if (isEmployee) {
        return {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 25 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 20 },
          8: { halign: 'center', cellWidth: 20 },
          9: { halign: 'center', cellWidth: 30 },
          10: { halign: 'center', cellWidth: 15 },
        };
      } else {
        return {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 25 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 20 },
          8: { halign: 'center', cellWidth: 20 },
          9: { halign: 'center', cellWidth: 30 },
          10: { halign: 'center', cellWidth: 15 },
          11: { halign: 'center', cellWidth: 25 },
          12: { halign: 'center', cellWidth: 25 },
        };
      }

    case 'stock_report':
      return {
        0: { halign: 'center', cellWidth: 30 },
        1: { halign: 'center', cellWidth: 35 },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 30 },
        5: { halign: 'center', cellWidth: 30 },
        6: { halign: 'center', cellWidth: 30 },
      };

    case 'purchase_report':
      if (isEmployee) {
        return {
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'center', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 25 },
          5: { halign: 'center', cellWidth: 35 },
          6: { halign: 'center', cellWidth: 25 },
          7: { halign: 'center', cellWidth: 20 },
          8: { halign: 'center', cellWidth: 25 },
          9: { halign: 'center', cellWidth: 25 },
          10: { halign: 'center', cellWidth: 25 },
        };
      } else {
        return {
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'center', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 15 },
          5: { halign: 'center', cellWidth: 25 },
          6: { halign: 'center', cellWidth: 35 },
          7: { halign: 'center', cellWidth: 25 },
          8: { halign: 'center', cellWidth: 20 },
          9: { halign: 'center', cellWidth: 25 },
          10: { halign: 'center', cellWidth: 25 },
          11: { halign: 'center', cellWidth: 20 },
        };
      }

    case 'stock_assignments':
      if (isEmployee) {
        return {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 35 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 25 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 20 },
          8: { halign: 'center', cellWidth: 25 },
        };
      } else {
        return {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 35 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 25 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 20 },
          8: { halign: 'center', cellWidth: 25 },
        };
      }

    case 'credit_debit_notes':
      if (isEmployee) {
        return {
          0: { halign: 'center', cellWidth: 15 },
          1: { halign: 'center', cellWidth: 15 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 30 },
          4: { halign: 'center', cellWidth: 15 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 25 },
          7: { halign: 'center', cellWidth: 25 },
          8: { halign: 'center', cellWidth: 20 },
          9: { halign: 'center', cellWidth: 35 },
          10: { halign: 'center', cellWidth: 20 },
        };
      } else {
        return {
          0: { halign: 'center', cellWidth: 15 },
          1: { halign: 'center', cellWidth: 15 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 30 },
          4: { halign: 'center', cellWidth: 15 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 25 },
          7: { halign: 'center', cellWidth: 25 },
          8: { halign: 'center', cellWidth: 20 },
          9: { halign: 'center', cellWidth: 35 },
          10: { halign: 'center', cellWidth: 20 },
          11: { halign: 'center', cellWidth: 25 },
          12: { halign: 'center', cellWidth: 25 },
        };
      }

    default:
      return {};
  }
};

const addHeader = (doc, logoDataUrl, reportDetails) => {
  if (logoDataUrl) {
    const imgProps = doc.getImageProperties(logoDataUrl);
    const pdfWidth = doc.internal.pageSize.getWidth();
    const imgWidth = 30;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    const xPos = (pdfWidth - imgWidth) / 2;
    const yPos = 10;
    doc.addImage(logoDataUrl, 'PNG', xPos, yPos, imgWidth, imgHeight);
  }

  doc.setFontSize(10);
  doc.text('GSTIN: 32AAUCS7002H1ZB', doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });

  doc.setFontSize(14);
  const reportTitle = `${capitalizeFirstLetter(reportDetails.type)} Report - ${capitalizeFirstLetter(
    reportDetails.reportTypeLabel
  )}`;
  doc.text(reportTitle, doc.internal.pageSize.getWidth() / 2, 45, { align: 'center' });

  doc.setFontSize(10);
  let periodText = '';
  if (reportDetails.type === 'Daily') {
    periodText = `Date: ${reportDetails.date}`;
  } else if (reportDetails.type === 'Monthly') {
    periodText = `Month: ${reportDetails.month}/${reportDetails.year}`;
  } else if (reportDetails.type === 'Date Range') {
    periodText = `From: ${reportDetails.fromDate} To: ${reportDetails.toDate}`;
  } else if (reportDetails.type === 'Consolidated') {
    periodText = `Period: ${reportDetails.fromDate} to ${reportDetails.toDate}`;
  }

  doc.text(periodText, doc.internal.pageSize.getWidth() / 2, 50, { align: 'center' });

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
  const { branch: userBranch, name: employeeName, role } = useAuth();
  const [reportType, setReportType] = useState(role === 'employee' ? 'consolidated' : 'sales_orders');
  const [reportPeriod, setReportPeriod] = useState('daily');
  const [date, setDate] = useState('');
  const [monthYear, setMonthYear] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [selectedBranches, setSelectedBranches] = useState(role === 'employee' ? [userBranch] : [userBranch]);
  const [allBranches, setAllBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isCombined, setIsCombined] = useState(false);

  const [logoDataUrl, setLogoDataUrl] = useState('');

  const [purchaseFromOptions, setPurchaseFromOptions] = useState([]);
  const [selectedPurchaseFrom, setSelectedPurchaseFrom] = useState('All');

  const [reportData, setReportData] = useState([]);

  const reportTypeRef = useRef();
  const reportPeriodRef = useRef();
  const dateRef = useRef();
  const monthYearRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();
  const branchSelectionRef = useRef();
  const generateButtonRef = useRef();

  const [patients, setPatients] = useState([]);
  const [customers, setCustomers] = useState([]);

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

  const fetchAllBranches = useCallback(async () => {
    const { data, error } = await supabase
      .from('branches')
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

  useEffect(() => {
    const fetchPurchaseFromForPurchases = async () => {
      if (reportType === 'purchase_report') {
        let { data, error } = await supabase
          .from('purchases')
          .select('purchase_from', { distinct: true });

        if (error) {
          console.error("Error fetching purchase_from options:", error);
          return;
        }

        const distinctPurchaseFrom = Array.from(new Set(data.map(d => d.purchase_from).filter(Boolean)));
        const uniqueOptions = ['All', ...distinctPurchaseFrom];
        setPurchaseFromOptions(uniqueOptions);
      } else {
        setPurchaseFromOptions([]);
        setSelectedPurchaseFrom('All');
      }
    };
    fetchPurchaseFromForPurchases();
  }, [reportType]);

  useEffect(() => {
    const fetchPatientsAndCustomers = async () => {
      try {
        const { data: patientsData, error: patientsError } = await supabase
          .from('patients')
          .select('mr_number, name');

        if (patientsError) throw patientsError;

        setPatients(patientsData);

        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('customer_id, name');

        if (customersError) throw customersError;

        setCustomers(customersData);
      } catch (err) {
        console.error('Error fetching patients or customers:', err);
      }
    };

    if (reportType === 'consolidated') {
      fetchPatientsAndCustomers();
    }
  }, [reportType]);

  const getLastDayOfMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const handleGenerateReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setReportData([]);

    try {
      let fetchedData = [];
      let reportDetails = {};

      let startStr, endStr;

      let branchesToReport = isCombined ? [] : selectedBranches;
      if (isEmployee) {
        branchesToReport = [userBranch];
        setIsCombined(false);
      }

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

        startStr = `${date} 00:00:00`;
        endStr = `${date} 23:59:59`;

        reportDetails = {
          type: 'Daily',
          date: formatDateDDMMYYYY(date),
          identifier: date,
          reportTypeLabel: getReportTypeLabel(reportType),
          branches: branchesToReport,
          isCombined,
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

        const paddedMonth = month.toString().padStart(2, '0');
        startStr = `${year}-${paddedMonth}-01 00:00:00`;
        endStr = `${year}-${paddedMonth}-${lastDay} 23:59:59`;

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

        startStr = `${fromDate} 00:00:00`;
        endStr = `${toDate} 23:59:59`;

        reportDetails = {
          type: 'Date Range',
          fromDate: formatDateDDMMYYYY(fromDate),
          toDate: formatDateDDMMYYYY(toDate),
          identifier: `${fromDate}_to_${toDate}`,
          reportTypeLabel: getReportTypeLabel(reportType),
          branches: branchesToReport,
          isCombined,
        };
      }

      let { data, error } = { data: [], error: null };
      let formattedProductIdSummary = null;

      switch (reportType) {
        case 'sales_orders': {
          let query = supabase
            .from('sales_orders')
            .select('*')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            query = query.in('branch', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'work_orders': {
          let query = supabase
            .from('work_orders')
            .select('*')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            query = query.in('branch', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'privilegecards': {
          let query = supabase
            .from('privilegecards')
            .select('*')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            query = query.in('branch', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'product_sales': {
          const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('*');

          if (productsError) throw productsError;

          const stockQuery = supabase.from('stock').select('*');
          if (!isCombined) {
            stockQuery.in('branch_code', branchesToReport);
          }

          const { data: stockData, error: stockError } = await stockQuery;
          if (stockError) throw stockError;

          const salesQuery = supabase
            .from('sales_orders')
            .select('items')
            .gte('created_at', startStr)
            .lte('created_at', endStr);
          if (!isCombined) {
            salesQuery.in('branch', branchesToReport);
          }

          const { data: salesData, error: salesError } = await salesQuery;
          if (salesError) throw salesError;

          const workQuery = supabase
            .from('work_orders')
            .select('product_entries')
            .gte('created_at', startStr)
            .lte('created_at', endStr);
          if (!isCombined) {
            workQuery.in('branch', branchesToReport);
          }

          const { data: workData, error: workError } = await workQuery;
          if (workError) throw workError;

          const salesAggregated = {};
          salesData.forEach(sale => {
            const items = sale.items || [];
            items.forEach(item => {
              const pid = item.id;
              const quantity = parseInt(item.quantity, 10) || 0;
              if (!salesAggregated[pid]) {
                salesAggregated[pid] = 0;
              }
              salesAggregated[pid] += quantity;
            });
          });

          workData.forEach(work => {
            const products = work.product_entries || [];
            products.forEach(product => {
              const pid = product.id;
              const quantity = parseInt(product.quantity, 10) || 0;
              if (!salesAggregated[pid]) {
                salesAggregated[pid] = 0;
              }
              salesAggregated[pid] += quantity;
            });
          });

          formattedProductIdSummary = productsData.map(product => {
            const pid = product.id;
            const productStock = stockData.filter(stock => stock.product_id === pid);
            const currentStock = productStock.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
            const totalSold = salesAggregated[pid] || 0;
            const totalRevenue = (product.mrp || 0) * totalSold;

            return {
              'Product ID': product.product_id || 'N/A',
              'Product Name': product.product_name || 'N/A',
              'MRP': product.mrp ? Number(product.mrp).toFixed(2) : '0.00',
              'Rate': product.rate ? Number(product.rate).toFixed(2) : '0.00',
              'HSN Code': product.hsn_code || 'N/A',
              'Total Quantity Sold': totalSold,
              'Total Revenue': totalRevenue.toFixed(2),
              'Stock Created At': formatDateDDMMYYYY(product.created_at, false),
              'Stock Updated At': formatDateDDMMYYYY(product.updated_at, false),
              'Current Stock Count': currentStock,
            };
          });

          formattedProductIdSummary.sort((a, b) => a['Product Name'].localeCompare(b['Product Name']));
          fetchedData = formattedProductIdSummary;
          break;
        }
        case 'modification_reports': {
          let query = supabase
            .from('modification_requests')
            .select('*')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            query = query.in('branch', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'consolidated': {
          const salesQuery = supabase
            .from('sales_orders')
            .select('sales_order_id, work_order_id, mr_number, final_amount, cgst, sgst, total_amount, created_at, updated_at, branch, customer_id, discount, advance_details')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            salesQuery.in('branch', branchesToReport);
          }

          const { data: salesData, error: salesError } = await salesQuery;
          if (salesError) throw salesError;

          const workQuery = supabase
            .from('work_orders')
            .select('work_order_id, mr_number, advance_details, created_at, updated_at, branch, customer_id')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            workQuery.in('branch', branchesToReport);
          }

          const { data: workData, error: workError } = await workQuery;
          if (workError) throw workError;

          const mrNumbers = [
            ...salesData.map(sale => sale.mr_number),
            ...workData.map(work => work.mr_number)
          ].filter(mr => mr !== null && mr !== '');

          const customerIds = [
            ...salesData.map(sale => sale.customer_id),
            ...workData.map(work => work.customer_id)
          ].filter(id => id !== null && id !== '');

          const { data: patientsData, error: patientsError } = await supabase
            .from('patients')
            .select('mr_number, name')
            .in('mr_number', mrNumbers);

          if (patientsError) throw patientsError;

          const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('customer_id, name')
            .in('customer_id', customerIds);

          if (customersError) throw customersError;

          const patientMap = Object.fromEntries(patientsData.map(p => [p.mr_number, p.name]));
          const customerMap = Object.fromEntries(customersData.map(c => [c.customer_id, c.name]));

          const consolidatedSales = salesData.map(sale => {
            let customerName = customerMap[sale.customer_id] || 'N/A';
            const totalGST = (parseFloat(sale.cgst) || 0) + (parseFloat(sale.sgst) || 0);

            return {
              sales_order_id: sale.sales_order_id || 'N/A',
              work_order_id: sale.work_order_id || 'N/A',
              mr_number: sale.mr_number || 'N/A',
              total_amount: parseFloat(sale.total_amount) || 0,
              total_gst: totalGST,
              discount: parseFloat(sale.discount) || 0,
              advance_collected: 0,
              balance_collected: parseFloat(sale.final_amount) || 0,
              total_collected: parseFloat(sale.final_amount) || 0,
              patient_customer_name: patientMap[sale.mr_number] || customerName || 'N/A',
              branch: sale.branch || 'N/A',
              created_at: sale.created_at ? formatDateDDMMYYYY(sale.created_at, true) : 'N/A',
              updated_at: sale.updated_at ? formatDateDDMMYYYY(sale.updated_at, true) : 'N/A',
            };
          });

          const consolidatedWork = workData.map(work => {
            let customerName = customerMap[work.customer_id] || 'N/A';

            return {
              sales_order_id: 'N/A',
              work_order_id: work.work_order_id || 'N/A',
              mr_number: work.mr_number || 'N/A',
              total_amount: 0,
              total_gst: 0,
              discount: 0,
              advance_collected: parseFloat(work.advance_details) || 0,
              balance_collected: 0,
              total_collected: parseFloat(work.advance_details) || 0,
              patient_customer_name: patientMap[work.mr_number] || customerName || 'N/A',
              branch: work.branch || 'N/A',
              created_at: work.created_at ? formatDateDDMMYYYY(work.created_at, true) : 'N/A',
              updated_at: work.updated_at ? formatDateDDMMYYYY(work.updated_at, true) : 'N/A',
            };
          });

          const consolidatedData = [...consolidatedSales, ...consolidatedWork];
          fetchedData = consolidatedData;
          break;
        }
        case 'stock_report': {
          const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('*');

          if (productsError) throw productsError;

          const stockQuery = supabase.from('stock').select('*');
          if (!isCombined) {
            stockQuery.in('branch_code', branchesToReport);
          }

          const { data: stockData, error: stockError } = await stockQuery;
          if (stockError) throw stockError;

          const combinedData = productsData.map(product => {
            const pid = product.id;
            const productStock = stockData.filter(stock => stock.product_id === pid);
            const currentStock = productStock.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

            return {
              product_id: product.product_id || 'N/A',
              product_name: product.product_name || 'N/A',
              mrp: product.mrp ? Number(product.mrp).toFixed(2) : '0.00',
              rate: product.rate ? Number(product.rate).toFixed(2) : '0.00',
              hsn_code: product.hsn_code || 'N/A',
              total_sold: 0,
              current_stock: currentStock,
            };
          });

          const salesQuery = supabase
            .from('sales_orders')
            .select('items')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            salesQuery.in('branch', branchesToReport);
          }

          const { data: salesData, error: salesError } = await salesQuery;
          if (salesError) throw salesError;

          const workQuery = supabase
            .from('work_orders')
            .select('product_entries')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            workQuery.in('branch', branchesToReport);
          }

          const { data: workData, error: workError } = await workQuery;
          if (workError) throw workError;

          const salesAggregated = {};
          salesData.forEach(sale => {
            const items = sale.items || [];
            items.forEach(item => {
              const pid = item.id;
              const quantity = parseInt(item.quantity, 10) || 0;
              if (!salesAggregated[pid]) {
                salesAggregated[pid] = 0;
              }
              salesAggregated[pid] += quantity;
            });
          });

          workData.forEach(work => {
            const products = work.product_entries || [];
            products.forEach(product => {
              const pid = product.id;
              const quantity = parseInt(product.quantity, 10) || 0;
              if (!salesAggregated[pid]) {
                salesAggregated[pid] = 0;
              }
              salesAggregated[pid] += quantity;
            });
          });

          combinedData.forEach(product => {
            const matchingProduct = productsData.find(p => p.product_id === product.product_id);
            if (matchingProduct) {
              const pid = matchingProduct.id;
              product.total_sold = salesAggregated[pid] || 0;
            }
          });

          combinedData.sort((a, b) => a.product_name.localeCompare(b.product_name));
          fetchedData = combinedData;
          break;
        }
        case 'purchase_report': {
          let purchaseQuery = supabase
            .from('purchases')
            .select('*')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            purchaseQuery = purchaseQuery.in('branch_code', branchesToReport);
          }

          if (selectedPurchaseFrom !== 'All') {
            purchaseQuery = purchaseQuery.eq('purchase_from', selectedPurchaseFrom);
          }

          ({ data, error } = await purchaseQuery);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'stock_assignments': {
          const query = supabase
            .from('stock_assignments')
            .select(`
              *,
              products(product_name)
            `)
            .gte('assigned_at', startStr)
            .lte('assigned_at', endStr);

          if (!isCombined) {
            const branchesFilter = selectedBranches.map(branch => `"${branch}"`).join(',');
            query.or(`from_branch_code.in.(${branchesFilter}),to_branch_code.in.(${branchesFilter})`);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }
        case 'credit_debit_notes': {
          const query = supabase
            .from('notes')
            .select(`
              *,
              products (product_name)
            `)
            .gte('date', startStr)
            .lte('date', endStr);

          if (!isCombined) {
            query.in('branch_code', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
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

      generatePDF(fetchedData, reportDetails, reportType, formattedProductIdSummary);
      setSuccess('Report generated successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [reportType, reportPeriod, date, monthYear, fromDate, toDate, selectedBranches, isCombined, isEmployee, userBranch, patients, customers, selectedPurchaseFrom]);

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
      case 'purchase_report':
        return 'Purchase Report';
      case 'stock_assignments':
        return 'Stock Assignments';
      case 'credit_debit_notes':
        return 'Credit and Debit Note';
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
        tableColumn = isEmployee ? [
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
        ] : [
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
        tableColumn = isEmployee ? [
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
        ] : [
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
        tableColumn = isEmployee ? [
          'PC Number',
          'Customer Name',
          'Phone Number',
          'Top-Up Amount',
          'Loyalty Points',
          'Card Tier',
          'Branch',
          'Employee',
        ] : [
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
        tableColumn = isEmployee ? [
          'Product ID',
          'Product Name',
          'MRP',
          'Rate',
          'HSN Code',
          'Total Quantity Sold',
          'Total Revenue',
          'Current Stock Count',
        ] : [
          'Product ID',
          'Product Name',
          'MRP',
          'Rate',
          'HSN Code',
          'Total Quantity Sold',
          'Total Revenue',
          'Stock Created At',
          'Stock Updated At',
          'Current Stock Count',
        ];
        break;
      case 'modification_reports':
        tableColumn = isEmployee ? [
          'Request ID',
          'Order ID',
          'Order Type',
          'Employee Name',
          'Modification Type',
          'Modification Reason',
          'Status',
          'Rejection Reason',
        ] : [
          'Request ID',
          'Order ID',
          'Order Type',
          'Employee Name',
          'Modification Type',
          'Modification Reason',
          'Status',
          'Rejection Reason',
          'Created At',
          'Updated At',
        ];
        break;
      case 'consolidated':
        tableColumn = isEmployee ? [
          'Sales Order ID',
          'Work Order ID',
          'MR Number',
          'Total Amount',
          'Total GST',
          'Discount',
          'Advance Collected',
          'Balance Collected',
          'Total Collected',
          'Patient/Customer Name',
          'Branch',
        ] : [
          'Sales Order ID',
          'Work Order ID',
          'MR Number',
          'Total Amount',
          'Total GST',
          'Discount',
          'Advance Collected',
          'Balance Collected',
          'Total Collected',
          'Patient/Customer Name',
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
      case 'purchase_report':
        tableColumn = isEmployee ? [
          'Purchase ID',
          'Product ID',
          'Branch Code',
          'Quantity',
          'MRP',
          'Purchase From',
          'Bill Number',
          'Bill Date',
          'Created At',
          'Updated At',
          'Employee Name',
        ] : [
          'Purchase ID',
          'Product ID',
          'Branch Code',
          'Quantity',
          'Party Rate',
          'MRP',
          'Purchase From',
          'Bill Number',
          'Bill Date',
          'Created At',
          'Updated At',
          'Employee Name',
        ];
        break;
      case 'stock_assignments':
        tableColumn = [
          'Product ID',
          'Product Name',
          'From Branch',
          'To Branch',
          'Quantity',
          'Notes',
          'Rate',
          'MRP',
          'Assigned At',
        ];
        break;
      case 'credit_debit_notes':
        tableColumn = isEmployee ? [
          'Note ID',
          'Note Type',
          'Product ID',
          'Product Name',
          'Branch Code',
          'Quantity',
          'Client Name',
          'Client Address',
          'Date',
          'Reason',
          'Order ID',
        ] : [
          'Note ID',
          'Note Type',
          'Product ID',
          'Product Name',
          'Branch Code',
          'Quantity',
          'Client Name',
          'Client Address',
          'Date',
          'Reason',
          'Order ID',
          'Created At',
          'Updated At',
        ];
        break;
      default:
        tableColumn = [];
    }

    // Prepare table rows
    let tableRows = [];
    switch (reportType) {
      case 'sales_orders':
        tableRows = isEmployee ? data.map((record) => [
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
        ]) : data.map((record) => [
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
            ? formatDateDDMMYYYY(record.created_at, true)
            : 'N/A',
          record.updated_at
            ? formatDateDDMMYYYY(record.updated_at, true)
            : 'N/A',
        ]);
        break;
      case 'work_orders':
        tableRows = isEmployee ? data.map((record) => [
          record.work_order_id || 'N/A',
          record.advance_details
            ? Number(record.advance_details).toFixed(2)
            : '0.00',
          record.due_date ? formatDateDDMMYYYY(new Date(record.due_date).toISOString(), false) : 'N/A',

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
        ]) : data.map((record) => [
          record.work_order_id || 'N/A',
          record.advance_details
            ? Number(record.advance_details).toFixed(2)
            : '0.00',
          record.due_date ? formatDateDDMMYYYY(new Date(record.due_date).toISOString(), false) : 'N/A',

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
            ? formatDateDDMMYYYY(record.created_at, true)
            : 'N/A',
          record.updated_at
            ? formatDateDDMMYYYY(record.updated_at, true)
            : 'N/A',
          record.branch || 'N/A', // Branch
        ]);
        break;
      case 'privilegecards':
        tableRows = isEmployee ? data.map((record) => [
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
          record.branch || 'N/A', // Branch
          record.employee_name || 'N/A', // Employee
        ]) : data.map((record) => [
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
            ? formatDateDDMMYYYY(record.created_at, true)
            : 'N/A',
          record.branch || 'N/A', // Branch
          record.employee_name || 'N/A', // Employee
        ]);
        break;
      case 'product_sales':
        tableRows = isEmployee ? formattedProductIdSummary.map((item) => [
          item['Product ID'],
          item['Product Name'],
          item['MRP'],
          item['Rate'],
          item['HSN Code'],
          item['Total Quantity Sold'],
          item['Total Revenue'],
          item['Current Stock Count'], // New Field
        ]) : formattedProductIdSummary.map((item) => [
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
        tableRows = isEmployee ? data.map((record) => [
          record.request_id || 'N/A',
          record.order_id || 'N/A',
          record.order_type || 'N/A',
          record.employee_name || 'N/A',
          record.modification_type || 'N/A',
          record.modification_reason || 'N/A',
          capitalizeFirstLetter(record.status) || 'N/A',
          record.rejection_reason || 'N/A', // Rejection Reason
        ]) : data.map((record) => [
          record.request_id || 'N/A',
          record.order_id || 'N/A',
          record.order_type || 'N/A',
          record.employee_name || 'N/A',
          record.modification_type || 'N/A',
          record.modification_reason || 'N/A',
          capitalizeFirstLetter(record.status) || 'N/A',
          record.rejection_reason || 'N/A', // Rejection Reason
          record.created_at
            ? formatDateDDMMYYYY(record.created_at, true)
            : 'N/A',
          record.updated_at
            ? formatDateDDMMYYYY(record.updated_at, true)
            : 'N/A',
        ]);
        break;
      case 'consolidated':
        tableRows = isEmployee ? data.map((record) => [
          record.sales_order_id || 'N/A',
          record.work_order_id || 'N/A',
          record.mr_number || 'N/A',
          record.total_amount ? Number(record.total_amount).toFixed(2) : '0.00',
          record.total_gst ? Number(record.total_gst).toFixed(2) : '0.00',
          record.discount ? Number(record.discount).toFixed(2) : '0.00',
          record.advance_collected ? Number(record.advance_collected).toFixed(2) : '0.00',
          record.balance_collected ? Number(record.balance_collected).toFixed(2) : '0.00',
          record.total_collected ? Number(record.total_collected).toFixed(2) : '0.00', // Total Collected
          record.patient_customer_name || 'N/A', // Updated Column
          record.branch || 'N/A',
        ]) : data.map((record) => [
          record.sales_order_id || 'N/A',
          record.work_order_id || 'N/A',
          record.mr_number || 'N/A',
          record.total_amount ? Number(record.total_amount).toFixed(2) : '0.00',
          record.total_gst ? Number(record.total_gst).toFixed(2) : '0.00',
          record.discount ? Number(record.discount).toFixed(2) : '0.00',
          record.advance_collected ? Number(record.advance_collected).toFixed(2) : '0.00',
          record.balance_collected ? Number(record.balance_collected).toFixed(2) : '0.00',
          record.total_collected ? Number(record.total_collected).toFixed(2) : '0.00', // Total Collected
          record.patient_customer_name || 'N/A', // Updated Column
          record.branch || 'N/A',
          record.created_at || 'N/A',
          record.updated_at || 'N/A',
        ]);
        break;
      case 'stock_report':
        // No "Created At" or "Updated At" columns for stock_report, so no condition needed
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
      case 'purchase_report':
        tableRows = isEmployee ? data.map((record) => [
          record.id || 'N/A', // Purchase ID
          record.product_id || 'N/A',
          record.branch_code || 'N/A',
          record.quantity || 0,
          // Rate column omitted for employees
          record.mrp ? Number(record.mrp).toFixed(2) : '0.00',
          record.purchase_from || 'N/A',
          record.bill_number || 'N/A',
          record.bill_date ? formatDateDDMMYYYY(new Date(record.bill_date).toISOString(), false) : 'N/A',
          record.created_at ? formatDateDDMMYYYY(record.created_at, true) : 'N/A',
          record.updated_at ? formatDateDDMMYYYY(record.updated_at, true) : 'N/A',
          record.employee_name || 'N/A',
        ]) : data.map((record) => [
          record.id || 'N/A', // Purchase ID
          record.product_id || 'N/A',
          record.branch_code || 'N/A',
          record.quantity || 0,
          record.rate ? Number(record.rate).toFixed(2) : '0.00',
          record.mrp ? Number(record.mrp).toFixed(2) : '0.00',
          record.purchase_from || 'N/A',
          record.bill_number || 'N/A',
          record.bill_date ? formatDateDDMMYYYY(new Date(record.bill_date).toISOString(), false) : 'N/A',
          record.created_at ? formatDateDDMMYYYY(record.created_at, true) : 'N/A',
          record.updated_at ? formatDateDDMMYYYY(record.updated_at, true) : 'N/A',
          record.employee_name || 'N/A',
        ]);
        break;
      case 'stock_assignments':
        tableRows = data.map((record) => [
          record.product_id || 'N/A',
          record.products && record.products.product_name
            ? record.products.product_name
            : 'N/A',
          // Product Name from joined products
          record.from_branch_code || 'N/A',
          record.to_branch_code || 'N/A',
          record.quantity || 0,
          record.notes || 'N/A',
          record.rate ? Number(record.rate).toFixed(2) : '0.00',
          record.mrp ? Number(record.mrp).toFixed(2) : '0.00',
          record.assigned_at ? formatDateDDMMYYYY(record.assigned_at, true) : 'N/A',
        ]);
        break;
      case 'credit_debit_notes':
        tableRows = isEmployee ? data.map((record) => [
          record.id || 'N/A',
          capitalizeFirstLetter(record.note_type) || 'N/A',
          record.product_id || 'N/A',
          record.products && record.products.product_name
            ? record.products.product_name
            : 'N/A',
          // Assuming product_name is fetched via foreign key
          record.branch_code || 'N/A',
          record.quantity || 0,
          record.client_name || 'N/A',
          record.client_address || 'N/A',
          record.date ? formatDateDDMMYYYY(new Date(record.date).toISOString(), false) : 'N/A',

          record.reason || 'N/A',
          record.order_id || 'N/A',
        ]) : data.map((record) => [
          record.id || 'N/A',
          capitalizeFirstLetter(record.note_type) || 'N/A',
          record.product_id || 'N/A',
          record.products && record.products.product_name
            ? record.products.product_name
            : 'N/A',
          // Assuming product_name is fetched via foreign key
          record.branch_code || 'N/A',
          record.quantity || 0,
          record.client_name || 'N/A',
          record.client_address || 'N/A',
          record.date ? formatDateDDMMYYYY(new Date(record.date).toISOString(), false) : 'N/A',

          record.reason || 'N/A',
          record.order_id || 'N/A',
          record.created_at ? formatDateDDMMYYYY(record.created_at, true) : 'N/A',
          record.updated_at ? formatDateDDMMYYYY(record.updated_at, true) : 'N/A',
        ]);
        break;
      default:
        tableRows = [];
    }

    setReportData([tableColumn, ...tableRows]);

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
      columnStyles: getColumnStyles(reportType, isEmployee),
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
        const totalSales = data.reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
        const totalBalanceDue = data.reduce((acc, curr) => acc + (parseFloat(curr.final_amount) || 0), 0);
        const totalCGST = data.reduce((acc, curr) => acc + (parseFloat(curr.cgst) || 0), 0);
        const totalSGST = data.reduce((acc, curr) => acc + (parseFloat(curr.sgst) || 0), 0);
        summaryTable = [
          ['Total Amount Overall (without Advances)', totalSales.toFixed(2)],
          ['Total Sales Amount (Balance Collected)', totalBalanceDue.toFixed(2)],
          ['Total CGST', totalCGST.toFixed(2)],
          ['Total SGST', totalSGST.toFixed(2)],
        ];
        break;
      }
      case 'work_orders': {
        const totalWorkAmount = data.reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0);
        const totalAdvance = data.reduce((acc, curr) => acc + (parseFloat(curr.advance_details) || 0), 0);
        summaryTable = [
          ['Total Work Orders', data.length],
          ['Total Advances from Work Orders', totalAdvance.toFixed(2)],
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
        const approvedModifications = data.filter(record => record.status.toLowerCase() === 'approved').length;
        const pendingModifications = data.filter(record => record.status.toLowerCase() === 'pending').length;
        const rejectedModifications = data.filter(record => record.status.toLowerCase() === 'rejected').length;
        summaryTable = [
          ['Total Modification Requests', totalModifications],
          ['Approved', approvedModifications],
          ['Pending', pendingModifications],
          ['Rejected', rejectedModifications],
        ];
        break;
      }
      case 'consolidated': {
        const totalAmountSales = data
          .filter(record => record.total_amount)
          .reduce((acc, curr) => acc + parseFloat(curr.total_amount), 0);
        const totalGST = data
          .filter(record => record.total_gst)
          .reduce((acc, curr) => acc + parseFloat(curr.total_gst), 0);
        const totalDiscount = data
          .filter(record => record.discount)
          .reduce((acc, curr) => acc + parseFloat(curr.discount), 0);
        const totalAdvanceCollected = data
          .filter(record => record.advance_collected)
          .reduce((acc, curr) => acc + parseFloat(curr.advance_collected), 0);
        const totalBalanceCollected = data
          .filter(record => record.balance_collected)
          .reduce((acc, curr) => acc + parseFloat(curr.balance_collected), 0);
        const totalCollected = data
          .filter(record => record.total_collected)
          .reduce((acc, curr) => acc + parseFloat(curr.total_collected), 0);

        summaryTable = [
          ['Total Sales Amount', totalAmountSales.toFixed(2)],
          ['Total GST Collected', totalGST.toFixed(2)],
          ['Total Discount', totalDiscount.toFixed(2)],
          ['Total Advance Collected', totalAdvanceCollected.toFixed(2)],
          ['Total Balance Collected', totalBalanceCollected.toFixed(2)],
          ['Total Collected', totalCollected.toFixed(2)], // Updated summary
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
      case 'purchase_report': {
        const totalPurchases = data.length;
        const totalQuantity = data.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        const totalMRP = data.reduce((acc, curr) => acc + (parseFloat(curr.mrp) || 0), 0);
        const totalAmount = isEmployee
          ? data.reduce((acc, curr) => acc + (parseFloat(curr.mrp) * (curr.quantity || 0)), 0)
          : data.reduce((acc, curr) => acc + ((parseFloat(curr.rate) || 0) * (curr.quantity || 0)), 0);
        summaryTable = [
          ['Total Purchases', totalPurchases],
          ['Total Quantity', totalQuantity],
          ['Total MRP', totalMRP.toFixed(2)],
          ['Total Amount', totalAmount.toFixed(2)],
        ];
        break;
      }
      case 'stock_assignments': { // Added stock_assignments
        const totalAssignments = data.length;
        const totalQuantityAssigned = data.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        summaryTable = [
          ['Total Stock Assignments', totalAssignments],
          ['Total Quantity Assigned', totalQuantityAssigned],
        ];
        break;
      }
      case 'credit_debit_notes': {
        const totalNotes = data.length;
        const totalCredit = data
          .filter(note => note.note_type.toLowerCase() === 'credit')
          .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        const totalDebit = data
          .filter(note => note.note_type.toLowerCase() === 'debit')
          .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        summaryTable = [
          ['Total Notes', totalNotes],
          ['Total Credit Quantity', totalCredit],
          ['Total Debit Quantity', totalDebit],
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

  const toggleReportScope = (scope) => {
    if (isEmployee) return;
    if (scope === 'combined') {
      setIsCombined(true);
    } else {
      setIsCombined(false);
    }
  };

  const toggleBranch = (branchCode) => {
    if (isEmployee) return;
    if (selectedBranches.includes(branchCode)) {
      setSelectedBranches(selectedBranches.filter(code => code !== branchCode));
    } else {
      setSelectedBranches([...selectedBranches, branchCode]);
    }
  };

  const reportTypes = isEmployee ? [
    { value: 'consolidated', label: 'Consolidated' },
    { value: 'stock_report', label: 'Stock Report' },
    { value: 'purchase_report', label: 'Purchase Report' },
    { value: 'stock_assignments', label: 'Stock Assignments' },
  ] : [
    { value: 'sales_orders', label: 'Sales Orders' },
    { value: 'work_orders', label: 'Work Orders' },
    { value: 'privilegecards', label: 'Privilege Cards' },
    { value: 'product_sales', label: 'Product Sales' },
    { value: 'modification_reports', label: 'Modification Reports' },
    { value: 'consolidated', label: 'Consolidated' },
    { value: 'stock_report', label: 'Stock Report' },
    { value: 'purchase_report', label: 'Purchase Report' },
    { value: 'stock_assignments', label: 'Stock Assignments' },
    { value: 'credit_debit_notes', label: 'Credit and Debit Note' },
  ];

  useEffect(() => {
    if (!reportTypes.some(type => type.value === reportType)) {
      setReportType(reportTypes[0].value);
    }
  }, [role, reportTypes, reportType]);

  return (
    <div
      className={`flex justify-center transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-14'} my-20 px-4`}
    >
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Generate {capitalizeFirstLetter(reportType)} Report</h1>

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

        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 mb-1">
                Report Type
              </label>
              <select
                id="reportType"
                ref={reportTypeRef}
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, reportPeriodRef)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                aria-label="Select Report Type"
              >
                {reportTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

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

          {!isEmployee && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Scope
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => toggleReportScope('branch')}
                  onKeyDown={(e) => handleKeyDown(e, isCombined ? generateButtonRef : branchSelectionRef)}
                  className={`px-4 py-2 rounded-md border ${!isCombined
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-700 border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                  aria-label="Select Branch-wise Report Scope"
                >
                  Branch-wise
                </button>
                <button
                  type="button"
                  onClick={() => toggleReportScope('combined')}
                  onKeyDown={(e) => handleKeyDown(e, generateButtonRef)}
                  className={`px-4 py-2 rounded-md border ${isCombined
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
                    className={`px-4 py-2 rounded-md border ${selectedBranches.includes(branch.code)
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

          {reportType === 'purchase_report' && (
            <div className="mt-6">
              <label htmlFor="purchaseFromFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Purchase From (Optional)
              </label>
              <select
                id="purchaseFromFilter"
                value={selectedPurchaseFrom}
                onChange={(e) => setSelectedPurchaseFrom(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                {purchaseFromOptions.map((option, idx) => (
                  <option key={idx} value={option}>{option}</option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Select a specific source or choose "All" to include all purchase sources.
              </p>
            </div>
          )}

          {reportPeriod === 'daily' && (
            <div className="mt-6">
              <label htmlFor="selectDate" className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
              <input
                type="date"
                id="selectDate"
                ref={dateRef}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, isEmployee ? generateButtonRef : isCombined ? generateButtonRef : branchSelectionRef)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                required
                aria-required="true"
              />
            </div>
          )}

          {reportPeriod === 'monthly' && (
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
          )}

          {reportPeriod === 'range' && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
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
          )}

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
              className={`w-full sm:w-1/2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md flex items-center justify-center transition ${loading || (!isCombined && !isEmployee && selectedBranches.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
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
            {/* CSV Download Link: Only show if we have data */}
            {reportData.length > 0 && (
              <CSVLink
                data={reportData}
                filename={`${reportType}-report.csv`}
                className="w-full sm:w-auto mx-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md flex items-center justify-center transition"
                aria-label="Download CSV"
              >
                Download CSV
              </CSVLink>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;











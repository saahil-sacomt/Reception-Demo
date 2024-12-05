// src/utils/dateUtils.js
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Converts a UTC date string to IST with a specified format.
 * @param {string | Date} utcDate - The UTC date string or Date object.
 * @param {string} format - The desired date format.
 * @returns {string} - The formatted IST date string.
 */


/**
 * Converts an IST date string to UTC ISO string.
 * @param {string | Date} istDate - The IST date string or Date object.
 * @returns {string} - The UTC ISO date string.
 */
export const convertISTToUTC = (istDate) => {
  return toZonedTime(new Date(istDate), "Asia/Kolkata").toISOString();
};

/**
 * Gets the current UTC date and time in ISO format.
 * @returns {string} - Current UTC date and time in ISO string.
 */
export const getCurrentUTCDateTime = () => {
  return new Date().toISOString();
};

/**
 * Formats a Date object or date string to IST with a specified format.
 * @param {string | Date} date - The date string or Date object.
 * @param {string} format - The desired format.
 * @returns {string} - Formatted date string in IST.
 */
export const formatDateToIST = (date, format = "dd-MM-yyyy hh:mm a") => {
  return formatInTimeZone(new Date(date), "Asia/Kolkata", format);
};

// Function to format date as dd/mm/yyyy or dd/mm/yyyy hh:mm a
export const formatDateDDMMYYYY = (dateString, withTime = false) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
  const year = date.getFullYear();

  if (withTime) {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const formattedHours = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${formattedHours}:${minutes} ${ampm}`;
  }

  return `${day}/${month}/${year}`;
};

// Optional: If you have other date-related utilities, export them as needed
export const convertUTCToIST = (utcDateString, format) => {
  if (!utcDateString) return 'N/A';
  const date = new Date(utcDateString);
  if (isNaN(date.getTime())) return 'N/A';
  
  // Implement timezone conversion logic here if needed
  // Then format the date
  // Example using formatDateDDMMYYYY
  if (format === 'dd/MM/yyyy hh:mm a') {
    return formatDateDDMMYYYY(date.toISOString(), true);
  }
  if (format === 'dd/MM/yyyy') {
    return formatDateDDMMYYYY(date.toISOString(), false);
  }
  return formatDateDDMMYYYY(date.toISOString(), false); // default
};






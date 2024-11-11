// src/utils/dateUtils.js
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Converts a UTC date string to IST with a specified format.
 * @param {string | Date} utcDate - The UTC date string or Date object.
 * @param {string} format - The desired date format.
 * @returns {string} - The formatted IST date string.
 */
export const convertUTCToIST = (utcDate, format = "dd-MM-yyyy hh:mm a") => {
  return formatInTimeZone(new Date(utcDate), "Asia/Kolkata", format);
};

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

// client/src/components/Notification.jsx

import React from "react";

const Notification = ({ type, message }) => {
  if (!message) return null;

  const baseStyles = "flex items-center mb-4 p-4 rounded";
  const typeStyles =
    type === "error"
      ? "bg-red-100 text-red-700"
      : type === "success"
      ? "bg-green-100 text-green-700"
      : "bg-gray-100 text-gray-700";

  return (
    <div className={`${baseStyles} ${typeStyles}`}>
      <svg
        className="w-5 h-5 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {type === "error" ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        )}
      </svg>
      <span>{message}</span>
    </div>
  );
};

export default Notification;

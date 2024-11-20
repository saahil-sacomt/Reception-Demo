// src/context/ModificationContext.js
import React, { createContext, useContext, useState } from "react";

const ModificationContext = createContext();

export const useModificationContext = () => useContext(ModificationContext);

export const ModificationProvider = ({ children }) => {
  const [onModificationSuccess, setOnModificationSuccess] = useState(null);
  const [actionRequests, setActionRequests] = useState([]);

  return (
    <ModificationContext.Provider
      value={{
        actionRequests,
        setActionRequests,
        onModificationSuccess,
        setOnModificationSuccess,
      }}
    >
      {children}
    </ModificationContext.Provider>
  );
};

// client/src/context/ModificationContext.jsx
import React, { createContext, useContext, useState } from 'react';

const ModificationContext = createContext();

export const ModificationProvider = ({ children }) => {
  const [onModificationSuccess, setOnModificationSuccess] = useState(null);

  return (
    <ModificationContext.Provider value={{ onModificationSuccess, setOnModificationSuccess }}>
      {children}
    </ModificationContext.Provider>
  );
};

export const useModificationContext = () => useContext(ModificationContext);

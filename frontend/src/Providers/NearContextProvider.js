import React, { createContext, useContext } from "react";

const NearContext = createContext(null);

const NearContextProvider = ({ value, children }) => {
  return (
    <NearContext.Provider value={value}>
      {children}
    </NearContext.Provider>
  );
};

export const useNear = () => {
  const ctx = useContext(NearContext);
  if (!ctx) {
    throw new Error("useNear must be used within NearContextProvider");
  }
  return ctx;
};

export default NearContextProvider;

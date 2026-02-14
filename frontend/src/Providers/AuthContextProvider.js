import React, { createContext, useContext } from "react";

const AuthContext = createContext(null);

const AuthContextProvider = ({ value, children }) => {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthContextProvider");
  }
  return ctx;
};

export default AuthContextProvider;

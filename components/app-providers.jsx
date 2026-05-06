'use client'

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import { AppContextProvider } from "@/context/AppContext";

const AppProviders = ({ children }) => {
  return (
    <ClerkProvider>
      <Toaster />
      <AppContextProvider>
        {children}
      </AppContextProvider>
    </ClerkProvider>
  );
};

export default AppProviders;

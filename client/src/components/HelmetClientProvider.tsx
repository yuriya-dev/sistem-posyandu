"use client";

import React from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";

export default function HelmetClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <HelmetProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            fontSize: "13px",
            fontWeight: "600",
            borderRadius: "12px",
            padding: "10px 16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          },
          success: {
            iconTheme: {
              primary: "#0d9488",
              secondary: "#ffffff",
            },
            style: {
              border: "1px solid #ccfbf1",
              background: "#ffffff",
              color: "#0f766e",
            },
          },
          error: {
            iconTheme: {
              primary: "#e11d48",
              secondary: "#ffffff",
            },
            style: {
              border: "1px solid #ffe4e6",
              background: "#ffffff",
              color: "#be123c",
            },
          },
        }}
      />
    </HelmetProvider>
  );
}

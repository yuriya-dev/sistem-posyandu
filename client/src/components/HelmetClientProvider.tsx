"use client";

import React, { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "react-hot-toast";

export default function HelmetClientProvider({ children }: { children: React.ReactNode }) {
  // Mencegah perubahan nilai input type="number" saat mouse scroll/wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type === "number") {
        activeEl.blur();
      }
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "INPUT" && (target as HTMLInputElement).type === "number") {
        (target as HTMLInputElement).blur();
      }
    };

    window.addEventListener("wheel", handleWheel, { capture: true, passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, []);

  return (
    <HelmetProvider>
      {children}
      <Toaster
        position="bottom-right"
        containerStyle={{
          bottom: 24,
          right: 24,
          zIndex: 99999,
        }}
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: "inherit",
            fontSize: "13px",
            fontWeight: "600",
            borderRadius: "14px",
            padding: "12px 18px",
            boxShadow: "0 12px 30px -4px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05)",
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
              boxShadow: "0 12px 30px -4px rgba(13, 148, 136, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.04)",
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
              boxShadow: "0 12px 30px -4px rgba(225, 29, 72, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.04)",
            },
          },
        }}
      />
    </HelmetProvider>
  );
}

"use client";

import { createContext, useContext } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: (message: string, type: ToastType = "info") => {
    const level = type.toUpperCase();
    console.log(`[${level}] ${message}`);
  },
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

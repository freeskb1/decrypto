"use client";
import * as React from "react";

interface Toast {
  id: number;
  message: string;
  type: "info" | "error" | "success";
}

const ToastContext = React.createContext<{
  show: (message: string, type?: Toast["type"]) => void;
}>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const show = (message: string, type: Toast["type"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-lg text-sm shadow-lg pointer-events-auto ${
              t.type === "error"
                ? "bg-red-600 text-white"
                : t.type === "success"
                ? "bg-green-600 text-white"
                : "bg-zinc-900 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}

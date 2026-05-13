"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  selectOnFocus?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, selectOnFocus, onFocus, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-zinc-100 disabled:cursor-not-allowed",
          className
        )}
        onFocus={(e) => {
          if (selectOnFocus) e.target.select();
          onFocus?.(e);
        }}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

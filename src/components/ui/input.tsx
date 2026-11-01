"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  selectOnFocus?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, selectOnFocus, onFocus, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full px-3 py-2.5 text-base bg-white border-[1.5px] border-line rounded-xl outline-none transition-colors placeholder:text-hint focus:border-ink disabled:bg-paper disabled:text-muted disabled:cursor-not-allowed",
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

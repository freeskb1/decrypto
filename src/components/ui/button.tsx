"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "danger" | "secondary" | "red";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40";

    const variants = {
      default: "bg-ink text-paper hover:bg-ink/90",
      red: "bg-stamp text-white hover:bg-stamp/90",
      danger: "bg-stamp text-white hover:bg-stamp/90",
      ghost: "bg-transparent text-muted hover:bg-ink/5",
      outline: "bg-white text-ink shadow-[inset_0_0_0_1.5px_#DDD6C6] hover:bg-paper",
      secondary: "bg-wt text-wt-ink hover:bg-wt/80",
    };

    const sizes = {
      sm: "px-3 py-2 text-xs rounded-xl",
      md: "px-4 py-3 text-sm rounded-2xl",
      lg: "px-5 py-4 text-base rounded-2xl",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

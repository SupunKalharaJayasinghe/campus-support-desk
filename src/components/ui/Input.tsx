import { forwardRef, type InputHTMLAttributes } from "react";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-[16px] border border-border bg-card px-3.5 py-2.5 text-sm text-text transition-colors",
          "placeholder:text-text/55 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
          className
        )}
        {...props}
      />
    );
  }
);

export default Input;

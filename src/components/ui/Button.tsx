import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primaryHover hover:shadow-shadowHover",
  secondary: "border border-border bg-card text-text hover:bg-tint",
  ghost: "bg-transparent text-primary hover:bg-tint hover:text-primaryHover",
  danger: "bg-red-600 text-white hover:bg-red-700 hover:shadow-shadowHover",
};

export default function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "ui-button inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium tracking-[0.01em] transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        className
      )}
      data-variant={variant}
      type={type}
      {...props}
    />
  );
}

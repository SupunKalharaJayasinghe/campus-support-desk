import type { HTMLAttributes } from "react";

type ContainerSize = "6xl" | "7xl" | "1200" | "1400" | "1600" | "full";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize | string;
}

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function Container({
  size = "1200",
  className,
  children,
  ...props
}: ContainerProps) {

  const getSizeClass = (s: string) => {
    switch (s) {
      case "6xl": return "max-w-6xl";
      case "7xl": return "max-w-7xl";
      case "1200": return "max-w-[1200px]";
      case "1400": return "max-w-[1400px]";
      case "1600": return "max-w-[1600px]";
      case "full": return "max-w-full";
      default: return `max-w-[${s}px]`; // generic fallback
    }
  };

  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8 lg:px-10",
        getSizeClass(size as string),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

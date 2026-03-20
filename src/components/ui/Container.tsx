import type { HTMLAttributes } from "react";

type ContainerSize = "7xl" | "6xl" | "1200";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
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
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8 lg:px-10",
        size === "7xl" ? "max-w-[1500px]" : size === "6xl" ? "max-w-6xl" : "max-w-[1200px]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

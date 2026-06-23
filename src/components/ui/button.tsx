import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold cursor-pointer transition-all active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-white bg-gradient-to-b from-primary/90 to-primary/50 border-2 border-primary-foreground/30 shadow-[0_0_18px_oklch(0.58_0.22_258/0.65),inset_0_1px_0_oklch(1_0_0/0.3)]",
        destructive:
          "text-white bg-gradient-to-b from-accent/90 to-accent/60 border-2 border-white/25 shadow-[0_0_18px_oklch(0.65_0.24_28/0.65),inset_0_1px_0_oklch(1_0_0/0.3)]",
        outline:
          "border-2 border-primary/60 bg-primary/10 text-foreground backdrop-blur-sm shadow-[0_0_14px_oklch(0.58_0.22_258/0.35),inset_0_1px_0_oklch(1_0_0/0.15)]",
        secondary:
          "text-white bg-gradient-to-b from-secondary/90 to-secondary/60 border-2 border-primary/40 shadow-[0_0_14px_oklch(0.30_0.13_258/0.55),inset_0_1px_0_oklch(1_0_0/0.2)]",
        ghost: "rounded-md hover:bg-accent/20 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline rounded-md",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

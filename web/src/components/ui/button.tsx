import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * DESIGN.md "Buttons": primary #0F766E-ish solid on the primary token, 8px
 * radius, hover to the mid-teal, active to the deep teal, 2px focus ring with
 * 2px offset. Secondary is the white/teal outlined pair; ghost is text-only.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-body-md-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:bg-[#0d9488] active:bg-[#115e59]",
        outline:
          "bg-surface-container-lowest text-primary border border-[#ccfbf1] hover:bg-[#f0fdfa] hover:border-[#99f6e4]",
        ghost:
          "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
        destructive: "bg-[#ef4444] text-white hover:bg-[#dc2626]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-label-md",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({ className, variant, size, ref, ...props }: ButtonProps) {
  return (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };

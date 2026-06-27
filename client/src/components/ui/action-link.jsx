import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ActionLink = ({
  to,
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}) => (
  <Link
    to={to}
    className={cn(
      buttonVariants({ variant, size }),
      "inline-flex flex-row items-center justify-center gap-2 no-underline",
      className,
    )}
    {...props}
  >
    {children}
  </Link>
);

export default ActionLink;

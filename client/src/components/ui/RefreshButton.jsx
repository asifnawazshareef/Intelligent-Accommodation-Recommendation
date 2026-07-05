import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RefreshButton = ({
  onClick,
  loading = false,
  disabled = false,
  label,
  className,
  ...props
}) => {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn("h-10 gap-2", className)}
      {...props}
    >
      <RefreshCw className={cn("size-4 shrink-0", loading && "animate-spin")} />
      {label ?? t("bookingPage.refresh")}
    </Button>
  );
};

export default RefreshButton;

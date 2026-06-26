import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

const PageLoader = ({ message }) => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <div className="flex w-full max-w-md flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-2 h-32 w-full rounded-xl" />
      </div>
      <p className="text-sm text-muted-foreground" role="status">
        {message || t("common.loading")}
      </p>
    </div>
  );
};

export default PageLoader;

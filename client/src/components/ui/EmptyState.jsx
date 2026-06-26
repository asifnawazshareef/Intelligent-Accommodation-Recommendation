import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

const EmptyState = ({
  icon: Icon,
  title,
  description,
  children,
  className,
}) => (
  <Card className={cn("glass-card border-dashed", className)}>
    <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      {Icon ? (
        <Icon className="size-10 text-muted-foreground/50" aria-hidden="true" />
      ) : null}
      <div className="max-w-md space-y-1">
        {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </CardContent>
  </Card>
);

export default EmptyState;

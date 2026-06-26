import { cn } from "@/lib/utils";

const PageHeader = ({
  title,
  description,
  badge,
  actions,
  className,
}) => (
  <div
    className={cn(
      "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
      className,
    )}
  >
    <div className="min-w-0">
      {badge ? <div className="mb-2">{badge}</div> : null}
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {description ? (
        <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {actions ? (
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {actions}
      </div>
    ) : null}
  </div>
);

export default PageHeader;

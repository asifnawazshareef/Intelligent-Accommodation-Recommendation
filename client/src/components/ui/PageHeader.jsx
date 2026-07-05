import { cn } from "@/lib/utils";

const PageHeader = ({
  title,
  description,
  badge,
  actions,
  meta,
  className,
  headingLevel: Heading = "h1",
  titleClassName,
}) => (
  <div
    className={cn(
      "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
      className,
    )}
  >
    <div className="min-w-0">
      {badge ? <div className="mb-2">{badge}</div> : null}
      <Heading
        className={cn(
          "font-bold tracking-tight",
          Heading === "h1" ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
          titleClassName,
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      ) : null}
      {meta ? <div className="mt-3">{meta}</div> : null}
    </div>
    {actions ? (
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {actions}
      </div>
    ) : null}
  </div>
);

export default PageHeader;

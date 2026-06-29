import { CalendarRange, Loader2, MapPin, Search, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { emptySearchValues, todayInputValue } from "@/lib/searchParams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export { emptySearchValues };

const PropertySearchForm = ({
  values,
  onChange,
  onSubmit,
  onReset,
  loading = false,
  compact = false,
  showHeader = true,
}) => {
  const { t } = useTranslation();
  const minDate = todayInputValue();

  const handleChange = (event) => {
    const { name, value } = event.target;
    onChange({ ...values, [name]: value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <Card className="glass-card overflow-hidden border-border/60 shadow-sm">
      {showHeader && !compact && (
        <CardHeader className="border-b border-border/50 bg-muted/15 pb-4">
          <CardTitle className="text-lg">{t("search.findStay")}</CardTitle>
          <CardDescription>{t("search.findStayHint")}</CardDescription>
        </CardHeader>
      )}

      <CardContent className={cn(compact ? "p-4 sm:p-5" : "pt-5")}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city" className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-muted-foreground" />
                {t("property.city")}
              </Label>
              <Input
                id="city"
                name="city"
                value={values.city}
                onChange={handleChange}
                placeholder={t("search.cityPlaceholder")}
                disabled={loading}
                className="h-10 w-full bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-1.5">
                <Tag className="size-3.5 text-muted-foreground" />
                {t("property.title")}
              </Label>
              <Input
                id="title"
                name="title"
                value={values.title}
                onChange={handleChange}
                placeholder={t("search.titlePlaceholder")}
                disabled={loading}
                className="h-10 w-full bg-background"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="minPrice">{t("search.minPrice")}</Label>
              <Input
                id="minPrice"
                name="minPrice"
                type="number"
                min="0"
                value={values.minPrice}
                onChange={handleChange}
                placeholder="5000"
                disabled={loading}
                className="h-10 w-full bg-background"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPrice">{t("search.maxPrice")}</Label>
              <Input
                id="maxPrice"
                name="maxPrice"
                type="number"
                min="0"
                value={values.maxPrice}
                onChange={handleChange}
                placeholder="25000"
                disabled={loading}
                className="h-10 w-full bg-background"
                dir="ltr"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label
                htmlFor="availabilityDate"
                className="flex items-center gap-1.5"
              >
                <CalendarRange className="size-3.5 text-muted-foreground" />
                {t("search.availabilityDate")}
              </Label>
              <Input
                id="availabilityDate"
                name="availabilityDate"
                type="date"
                min={minDate}
                value={values.availabilityDate}
                onChange={handleChange}
                disabled={loading}
                className="h-10 w-full bg-background"
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-end">
            {onReset && (
              <Button
                type="button"
                variant="outline"
                onClick={onReset}
                disabled={loading}
                className="h-10 w-full sm:w-auto"
              >
                {t("search.clearFilters")}
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full gap-2 sm:min-w-[9rem] sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  {t("search.searching")}
                </>
              ) : (
                <>
                  <Search className="size-4 shrink-0" />
                  {t("common.search")}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PropertySearchForm;

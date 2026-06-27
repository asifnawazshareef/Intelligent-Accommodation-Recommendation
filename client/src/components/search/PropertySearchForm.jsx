import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { emptySearchValues } from "@/lib/searchParams";
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

export { emptySearchValues };

const PropertySearchForm = ({
  values,
  onChange,
  onSubmit,
  onReset,
  loading = false,
  compact = false,
}) => {
  const { t } = useTranslation();

  const handleChange = (event) => {
    const { name, value } = event.target;
    onChange({ ...values, [name]: value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <Card className="glass-card border-border/60">
      {!compact && (
        <CardHeader className="pb-4">
          <CardTitle>{t("search.findStay")}</CardTitle>
          <CardDescription>{t("search.findStayHint")}</CardDescription>
        </CardHeader>
      )}

      <CardContent className={compact ? "p-4 sm:p-5" : undefined}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">{t("property.city")}</Label>
              <Input
                id="city"
                name="city"
                value={values.city}
                onChange={handleChange}
                placeholder={t("search.cityPlaceholder")}
                disabled={loading}
                className="h-10 w-full bg-background/80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">{t("property.title")}</Label>
              <Input
                id="title"
                name="title"
                value={values.title}
                onChange={handleChange}
                placeholder={t("search.titlePlaceholder")}
                disabled={loading}
                className="h-10 w-full bg-background/80"
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
                className="h-10 w-full bg-background/80"
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
                className="h-10 w-full bg-background/80"
                dir="ltr"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="availabilityDate">{t("search.availabilityDate")}</Label>
              <Input
                id="availabilityDate"
                name="availabilityDate"
                type="date"
                value={values.availabilityDate}
                onChange={handleChange}
                disabled={loading}
                className="h-10 w-full bg-background/80"
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
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
              className="h-10 w-full gap-2 sm:w-auto"
            >
              <Search className="size-4 shrink-0" />
              {t("common.search")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PropertySearchForm;

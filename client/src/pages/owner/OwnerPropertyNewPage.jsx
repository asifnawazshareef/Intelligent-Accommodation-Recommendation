import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PropertyForm from "@/components/properties/PropertyForm";
import { createProperty } from "@/services/propertyService";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const OwnerPropertyNewPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (payload) => {
    setLoading(true);
    setError("");

    try {
      await createProperty(payload);
      navigate("/owner/properties", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || t("property.submitError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-4">
          <Link to="/owner/properties">
            <Button variant="ghost" size="sm" className="whitespace-normal">
              <ArrowLeft className="size-4" />
              {t("property.backToList")}
            </Button>
          </Link>

          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("property.createProperty")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t("property.createHint")}
            </p>
          </div>

          <Alert>
            <AlertTitle>{t("property.pending")}</AlertTitle>
            <AlertDescription>{t("property.newListingPending")}</AlertDescription>
          </Alert>
        </div>

        <PropertyForm
          onSubmit={handleSubmit}
          submitLabel={t("property.createProperty")}
          loading={loading}
          error={error}
        />
      </div>
    </DashboardLayout>
  );
};

export default OwnerPropertyNewPage;

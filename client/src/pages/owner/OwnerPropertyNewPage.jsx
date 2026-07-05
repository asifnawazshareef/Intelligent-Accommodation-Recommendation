import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PropertyForm from "@/components/properties/PropertyForm";
import PageHeader from "@/components/ui/PageHeader";
import { createProperty } from "@/services/propertyService";
import notify from "@/lib/notify";
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
      notify.success(t("property.createSuccess"));
      navigate("/owner/properties", { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || t("property.submitError");
      setError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <div className="space-y-4">
          <Link to="/owner/properties">
            <Button variant="ghost" size="sm" className="whitespace-normal">
              <ArrowLeft className="size-4" />
              {t("property.backToList")}
            </Button>
          </Link>

          <PageHeader
            title={t("property.createProperty")}
            description={t("property.createHint")}
            meta={
              <Alert>
                <AlertTitle>{t("property.pending")}</AlertTitle>
                <AlertDescription>{t("property.newListingPending")}</AlertDescription>
              </Alert>
            }
          />
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

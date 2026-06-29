import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PropertyForm from "@/components/properties/PropertyForm";
import PropertyStatusBadge from "@/components/properties/PropertyStatusBadge";
import PageLoader from "@/components/layout/PageLoader";
import { getPropertyById, updateProperty } from "@/services/propertyService";
import notify from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const OwnerPropertyEditPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const fetchProperty = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getPropertyById(id);
        setProperty(response.data.data);
      } catch (err) {
        setError(err.response?.data?.message || t("property.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id, t]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setSubmitError("");

    try {
      await updateProperty(id, payload);
      notify.success(t("property.updateSuccess"));
      navigate("/owner/properties", { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || t("property.submitError");
      setSubmitError(message);
      notify.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message={t("common.loading")} />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="dashboard-page">
          <Alert variant="destructive">
            <AlertTitle>{t("property.loadError")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Link to="/owner/properties">
            <Button variant="outline">{t("property.backToList")}</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t("property.editProperty")}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {t("property.editHint")}
              </p>
            </div>
            <PropertyStatusBadge status={property?.status} />
          </div>
        </div>

        <PropertyForm
          initialValues={property}
          onSubmit={handleSubmit}
          submitLabel={t("property.saveChanges")}
          loading={submitting}
          error={submitError}
        />
      </div>
    </DashboardLayout>
  );
};

export default OwnerPropertyEditPage;

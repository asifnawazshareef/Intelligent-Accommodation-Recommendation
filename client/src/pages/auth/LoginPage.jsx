import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import AuthLayout from "@/components/layout/AuthLayout";
import PageLoader from "@/components/layout/PageLoader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const getSafeRedirect = (from, role, getDashboardPath) => {
  if (!from || from === "/login" || from === "/register") {
    return getDashboardPath(role);
  }

  const rolePrefixes = {
    guest: ["/guest", "/properties", "/bookings"],
    owner: ["/owner", "/properties"],
    admin: ["/admin", "/properties"],
  };

  const allowedPrefixes = rolePrefixes[role] || [];
  const isAllowed = allowedPrefixes.some((prefix) => from.startsWith(prefix));

  return isAllowed ? from : getDashboardPath(role);
};

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, user, getDashboardPath, loading } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const sessionExpired = searchParams.get("session") === "expired";
  const redirectFrom =
    location.state?.from || searchParams.get("from") || null;

  if (loading) {
    return <PageLoader message={t("common.checkingSession")} />;
  }

  if (isAuthenticated && user) {
    return (
      <Navigate
        to={getSafeRedirect(redirectFrom, user.role, getDashboardPath)}
        replace
      />
    );
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const loggedInUser = await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      navigate(
        getSafeRedirect(redirectFrom, loggedInUser.role, getDashboardPath),
        { replace: true },
      );
    } catch (err) {
      setError(
        err.response?.data?.message || t("auth.loginFailedMessage"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.loginHeroTitle")}
      subtitle={t("auth.loginHeroSubtitle")}
    >
      <Card className="glass-card border-border/60 shadow-xl">
        <CardHeader className="space-y-1">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary lg:hidden">
            <LogIn className="size-5" />
          </div>
          <CardTitle className="text-2xl">{t("auth.loginTitle")}</CardTitle>
          <CardDescription>{t("auth.loginDescription")}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {sessionExpired && !error && (
              <Alert>
                <AlertTitle>{t("auth.sessionExpired")}</AlertTitle>
                <AlertDescription>
                  {t("auth.sessionExpiredMessage")}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>{t("auth.loginFailed")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.emailAddress")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                value={formData.email}
                onChange={handleChange}
                required
                disabled={submitting}
                className="w-full"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder={t("auth.passwordPlaceholder")}
                value={formData.password}
                onChange={handleChange}
                required
                disabled={submitting}
                className="w-full"
                dir="ltr"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 border-t-0 bg-transparent">
            <Button
              type="submit"
              className="w-full min-w-fit whitespace-normal"
              size="lg"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("auth.signingIn")}
                </>
              ) : (
                t("auth.loginButton")
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("auth.dontHaveAccount")}{" "}
              <Link
                to="/register"
                className="font-medium text-primary hover:underline"
              >
                {t("auth.createOne")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
};

export default LoginPage;

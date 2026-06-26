import { Link, Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Languages,
  Loader2,
  Mail,
  Phone,
  User,
  UserCircle,
  UserPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import AuthLayout from "@/components/layout/AuthLayout";
import PageLoader from "@/components/layout/PageLoader";
import PasswordInput from "@/components/auth/PasswordInput";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGE_OPTIONS } from "@/utils/languageUtils";

const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { register, isAuthenticated, user, getDashboardPath, loading } =
    useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "guest",
    languagePref: i18n.language?.split("-")[0] || "en",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return <PageLoader message={t("common.checkingSession")} />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleLanguageChange = (value) => {
    setFormData((prev) => ({ ...prev, languagePref: value }));
    i18n.changeLanguage(value);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    if (formData.password.length < 6) {
      setError(t("auth.passwordMinLength"));
      setSubmitting(false);
      return;
    }

    try {
      const registeredUser = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        role: formData.role,
        languagePref: formData.languagePref,
      });

      navigate(getDashboardPath(registeredUser.role), { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || t("auth.registerFailedMessage"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.registerHeroTitle")}
      subtitle={t("auth.registerHeroSubtitle")}
    >
      <Card className="glass-card border-border/60 shadow-xl">
        <CardHeader className="space-y-1">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary lg:hidden">
            <UserPlus className="size-5" />
          </div>
          <CardTitle className="text-2xl">{t("auth.registerTitle")}</CardTitle>
          <CardDescription>{t("auth.registerDescription")}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{t("auth.registerFailed")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.name")}</Label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="name"
                  name="name"
                  placeholder={t("auth.namePlaceholder")}
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                  className="w-full ps-9"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
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
                    className="w-full ps-9"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t("auth.phone")}</Label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="phone"
                    name="phone"
                    placeholder={t("auth.phonePlaceholder")}
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={submitting}
                    className="w-full ps-9"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                placeholder={t("auth.passwordRegisterPlaceholder")}
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                disabled={submitting}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role">{t("auth.registerAs")}</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, role: value }));
                    setError("");
                  }}
                  disabled={submitting}
                >
                  <SelectTrigger id="role" className="w-full whitespace-normal">
                    <UserCircle className="size-4 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder={t("auth.selectRole")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guest">{t("auth.guestOption")}</SelectItem>
                    <SelectItem value="owner">{t("auth.ownerOption")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="languagePref">
                  {t("auth.languagePreference")}
                </Label>
                <Select
                  value={formData.languagePref}
                  onValueChange={handleLanguageChange}
                  disabled={submitting}
                >
                  <SelectTrigger
                    id="languagePref"
                    className="w-full whitespace-normal"
                  >
                    <Languages className="size-4 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder={t("auth.selectLanguage")} />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  {t("auth.creatingAccount")}
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  {t("auth.registerButton")}
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
                {t("auth.loginButton")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthLayout>
  );
};

export default RegisterPage;

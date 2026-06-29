import { Link } from "react-router-dom";
import {
  Building2,
  CalendarCheck,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const FEATURES = [
  { key: "featureSearch", icon: Search },
  { key: "featureBooking", icon: CalendarCheck },
  { key: "featureSentiment", icon: MessageSquareText },
];

const AuthLayout = ({ title, subtitle, children }) => {
  const { t } = useTranslation();

  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.1),transparent_40%)]" />
        <div className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -start-20 size-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-8 xl:p-10">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/90 transition-opacity hover:opacity-100"
            >
              <Building2 className="size-5" />
              {t("common.appName")} · {t("common.appTagline")}
            </Link>
          </div>

          <div className="my-8 max-w-lg space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm backdrop-blur-sm">
              <Sparkles className="size-4 shrink-0" />
              {t("auth.authSideTagline")}
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
                {title}
              </h1>
              <p className="text-base leading-relaxed text-primary-foreground/85">
                {subtitle}
              </p>
            </div>

            <ul className="space-y-3 pt-2">
              {FEATURES.map(({ key, icon: Icon }) => (
                <li
                  key={key}
                  className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="size-4" />
                  </span>
                  <p className="pt-1 text-sm leading-relaxed text-primary-foreground/90">
                    {t(`auth.${key}`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-primary-foreground/70">
            {t("auth.authSideFooter")}
          </p>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-muted/20 p-4 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.02),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_55%)]" />
        <div className="relative w-full max-w-md">{children}</div>
      </div>
    </div>
  );
};

export default AuthLayout;

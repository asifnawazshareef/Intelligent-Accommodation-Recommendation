import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export const LOGO_SRC = "/iars-logo.png";
export const LOGO_SRC_LIGHT = "/iars-logo-light.png";
export const LOGO_ALT =
  "IARS — Intelligent Accommodation Recommendation System";

const sizeClasses = {
  xs: "h-7",
  sm: "h-8 sm:h-9",
  md: "h-10 sm:h-11",
  lg: "h-12 sm:h-14",
  xl: "h-16 sm:h-20",
};

const AppLogo = ({
  to = "/",
  size = "sm",
  variant = "auto",
  className = "",
  imageClassName = "",
  showLink = true,
  onClick,
}) => {
  const imageClass = cn(
    "w-auto max-w-full object-contain object-left",
    sizeClasses[size] || sizeClasses.sm,
    imageClassName,
  );

  const renderImages = () => {
    if (variant === "light") {
      return (
        <img
          src={LOGO_SRC_LIGHT}
          alt={LOGO_ALT}
          className={imageClass}
          width={1024}
          height={256}
          loading="eager"
          decoding="async"
        />
      );
    }

    if (variant === "dark") {
      return (
        <img
          src={LOGO_SRC}
          alt={LOGO_ALT}
          className={imageClass}
          width={1024}
          height={256}
          loading="eager"
          decoding="async"
        />
      );
    }

    return (
      <>
        <img
          src={LOGO_SRC}
          alt={LOGO_ALT}
          className={cn(imageClass, "dark:hidden")}
          width={1024}
          height={256}
          loading="eager"
          decoding="async"
        />
        <img
          src={LOGO_SRC_LIGHT}
          alt={LOGO_ALT}
          className={cn(imageClass, "hidden dark:block")}
          width={1024}
          height={256}
          loading="eager"
          decoding="async"
        />
      </>
    );
  };

  const content = renderImages();

  if (!showLink) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        {content}
      </span>
    );
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center transition-opacity hover:opacity-90",
        className,
      )}
      aria-label={LOGO_ALT}
    >
      {content}
    </Link>
  );
};

export default AppLogo;

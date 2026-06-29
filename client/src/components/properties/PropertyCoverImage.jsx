import { useEffect, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { resolveImageUrl } from "@/lib/imageUrl";

const normalizeImageUrl = (url) => {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : "";
};

const PropertyCoverImage = ({
  src,
  alt = "",
  className,
  imageClassName,
  showLoader = true,
}) => {
  const { t } = useTranslation();
  const imageUrl = resolveImageUrl(normalizeImageUrl(src));
  const imgRef = useRef(null);
  const [status, setStatus] = useState(() =>
    imageUrl ? "loading" : "empty",
  );

  useEffect(() => {
    if (!imageUrl) {
      setStatus("empty");
      return;
    }

    setStatus("loading");

    const img = imgRef.current;
    if (img?.complete) {
      if (img.naturalWidth > 0) {
        setStatus("loaded");
      } else {
        setStatus("error");
      }
    }

    const timeoutId = window.setTimeout(() => {
      setStatus((current) => (current === "loading" ? "error" : current));
    }, 12000);

    return () => window.clearTimeout(timeoutId);
  }, [imageUrl]);

  const showPlaceholder = !imageUrl || status === "empty" || status === "error";
  const showSpinner = imageUrl && status === "loading" && showLoader;

  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden bg-muted/40",
        className,
      )}
    >
      {showPlaceholder && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted/60 to-muted/30 text-muted-foreground"
          aria-hidden={status === "loaded"}
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-background/70 shadow-sm">
            <Building2 className="size-7 opacity-50" />
          </div>
          <span className="px-4 text-center text-xs text-muted-foreground/80">
            {status === "error"
              ? t("common.imageLoadError")
              : t("property.noImage")}
          </span>
        </div>
      )}

      {showSpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/20">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {imageUrl ? (
        <img
          ref={imgRef}
          src={imageUrl}
          alt={alt}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            status === "loaded" ? "opacity-100" : "opacity-0",
            imageClassName,
          )}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      ) : null}
    </div>
  );
};

export default PropertyCoverImage;

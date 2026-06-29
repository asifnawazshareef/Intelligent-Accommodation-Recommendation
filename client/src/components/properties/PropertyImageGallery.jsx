import { useState } from "react";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import ImageVerificationBadge from "@/components/imageAudit/ImageVerificationBadge";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import { resolveImageUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";

const PropertyImageGallery = ({ images = [], title, emptyMessage }) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];
  const total = images.length;

  const goPrev = () => setActiveIndex((index) => (index - 1 + total) % total);
  const goNext = () => setActiveIndex((index) => (index + 1) % total);

  if (!total) {
    return (
      <div className="flex aspect-[16/10] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 text-center sm:aspect-[2/1]">
        <Building2 className="size-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {emptyMessage || t("property.imagesUnderReview")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="group relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
        <PropertyCoverImage
          key={activeImage?.url || activeIndex}
          src={activeImage?.url}
          alt={title}
          className="aspect-[16/10] rounded-none border-0 sm:aspect-[2/1]"
          imageClassName="transition-transform duration-700 group-hover:scale-[1.02]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

        {activeImage?.verificationStatus && (
          <div className="absolute start-3 top-3 z-10">
            <ImageVerificationBadge
              status={activeImage.verificationStatus}
              variant="overlay"
            />
          </div>
        )}

        {total > 1 && (
          <>
            <div className="absolute end-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {activeIndex + 1} / {total}
            </div>
            <button
              type="button"
              onClick={goPrev}
              className="absolute start-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/60 group-hover:opacity-100"
              aria-label={t("propertyDetail.prevImage")}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute end-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/60 group-hover:opacity-100"
              aria-label={t("propertyDetail.nextImage")}
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((image, index) => (
            <button
              key={image._id || index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:size-20",
                activeIndex === index
                  ? "border-primary ring-2 ring-primary/25"
                  : "border-transparent opacity-75 hover:opacity-100",
              )}
            >
              <img
                src={resolveImageUrl(image.url)}
                alt={`${title} ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertyImageGallery;

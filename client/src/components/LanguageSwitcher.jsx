import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { LANGUAGE_OPTIONS } from "@/utils/languageUtils";
import { cn } from "@/lib/utils";

const LanguageSwitcher = ({ className = "", compact = false }) => {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.language?.split("-")[0] || "en";
  const currentOption =
    LANGUAGE_OPTIONS.find((option) => option.code === currentLanguage) ||
    LANGUAGE_OPTIONS[0];

  const handleChange = (value) => {
    i18n.changeLanguage(value);
  };

  return (
    <Select value={currentLanguage} onValueChange={handleChange}>
      <SelectTrigger
        aria-label={t("nav.language")}
        className={cn(
          "h-9 shrink-0 gap-1.5 border-input bg-background px-2.5 shadow-none",
          compact ? "w-[7.25rem]" : "w-full max-w-[9rem] sm:w-[8.5rem]",
          className,
        )}
      >
        <Languages className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{currentOption.label}</span>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[9rem]">
        {LANGUAGE_OPTIONS.map((option) => (
          <SelectItem key={option.code} value={option.code}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSwitcher;

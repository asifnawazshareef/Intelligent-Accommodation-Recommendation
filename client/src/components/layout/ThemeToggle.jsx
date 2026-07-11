import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ThemeToggle = ({ className = "" }) => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={cn("shrink-0", className)}
      aria-label={isDark ? t("common.switchToLight") : t("common.switchToDark")}
      title={isDark ? t("common.switchToLight") : t("common.switchToDark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
};

export default ThemeToggle;

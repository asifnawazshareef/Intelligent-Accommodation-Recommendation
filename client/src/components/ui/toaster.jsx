import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/context/ThemeContext";

const Toaster = () => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "glass-card border-border/60 shadow-lg",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
        },
      }}
    />
  );
};

export default Toaster;

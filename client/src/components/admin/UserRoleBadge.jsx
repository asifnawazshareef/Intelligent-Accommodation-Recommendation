import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const roleClasses = {
  guest: "bg-sky-500/15 text-sky-700 dark:text-sky-400 hover:bg-sky-500/15",
  owner:
    "bg-violet-500/15 text-violet-700 dark:text-violet-400 hover:bg-violet-500/15",
  admin:
    "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15",
};

const UserRoleBadge = ({ role = "guest" }) => {
  const { t } = useTranslation();
  const labelKey = `auth.${role}`;

  return (
    <Badge
      className={cn(
        "whitespace-normal capitalize",
        roleClasses[role] || roleClasses.guest,
      )}
    >
      {t(labelKey, role)}
    </Badge>
  );
};

export default UserRoleBadge;

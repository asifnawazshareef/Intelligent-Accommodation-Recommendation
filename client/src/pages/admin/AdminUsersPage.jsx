import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserRound,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import UserRoleBadge from "@/components/admin/UserRoleBadge";
import {
  getAllUsers,
  updateUserRole,
  updateUserVerification,
} from "@/services/userManagementService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const ROLE_FILTERS = ["all", "guest", "owner", "admin"];
const ROLES = ["guest", "owner", "admin"];

const TableSkeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3, 4].map((row) => (
      <Skeleton key={row} className="h-14 w-full" />
    ))}
  </div>
);

const VerificationBadge = ({ isVerified }) => {
  const { t } = useTranslation();

  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-normal gap-1",
        isVerified
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "text-muted-foreground",
      )}
    >
      {isVerified ? (
        <ShieldCheck className="size-3.5 shrink-0" />
      ) : (
        <ShieldOff className="size-3.5 shrink-0" />
      )}
      {isVerified ? t("userManagement.verified") : t("userManagement.unverified")}
    </Badge>
  );
};

const UserActions = ({
  user,
  currentUserId,
  busyAction,
  onVerify,
  onRoleChange,
}) => {
  const { t } = useTranslation();
  const isSelf = user._id === currentUserId;
  const verifyBusy = busyAction === `${user._id}-verify`;
  const roleBusy = busyAction === `${user._id}-role`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <Button
        size="sm"
        variant={user.isVerified ? "outline" : "default"}
        disabled={verifyBusy || roleBusy}
        className="w-full whitespace-normal sm:w-auto"
        onClick={() => onVerify(user)}
      >
        {verifyBusy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : user.isVerified ? (
          <ShieldOff className="size-4" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        {user.isVerified
          ? t("userManagement.unverify")
          : t("userManagement.verify")}
      </Button>

      <Select
        value={user.role}
        disabled={isSelf || roleBusy || verifyBusy}
        onValueChange={(value) => onRoleChange(user._id, value)}
      >
        <SelectTrigger
          className="w-full sm:w-[140px]"
          aria-label={t("userManagement.changeRole")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {t(`auth.${role}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isSelf && (
        <span className="text-xs text-muted-foreground sm:max-w-[120px] sm:text-end">
          {t("userManagement.cannotChangeOwnRole")}
        </span>
      )}
    </div>
  );
};

const AdminUsersPage = () => {
  const { t, i18n } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await getAllUsers();
      setUsers(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t("userManagement.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const roleCounts = useMemo(() => {
    const counts = { all: users.length, guest: 0, owner: 0, admin: 0 };
    users.forEach((user) => {
      if (counts[user.role] !== undefined) {
        counts[user.role] += 1;
      }
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") return users;
    return users.filter((user) => user.role === roleFilter);
  }, [users, roleFilter]);

  const handleVerify = async (targetUser) => {
    setBusyAction(`${targetUser._id}-verify`);
    setError("");
    setSuccess("");

    try {
      const nextVerified = !targetUser.isVerified;
      const response = await updateUserVerification(
        targetUser._id,
        nextVerified,
      );
      const updated = response.data.data;

      setUsers((prev) =>
        prev.map((item) => (item._id === updated._id ? updated : item)),
      );
      setSuccess(
        updated.isVerified
          ? t("userManagement.verifySuccess")
          : t("userManagement.unverifySuccess"),
      );
    } catch (err) {
      setError(err.response?.data?.message || t("userManagement.actionError"));
    } finally {
      setBusyAction("");
    }
  };

  const handleRoleChange = async (userId, role) => {
    setBusyAction(`${userId}-role`);
    setError("");
    setSuccess("");

    try {
      const response = await updateUserRole(userId, role);
      const updated = response.data.data;

      setUsers((prev) =>
        prev.map((item) => (item._id === updated._id ? updated : item)),
      );
      setSuccess(t("userManagement.roleSuccess"));
    } catch (err) {
      setError(err.response?.data?.message || t("userManagement.actionError"));
    } finally {
      setBusyAction("");
    }
  };

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("admin.manageUsers")}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {t("userManagement.pageHint")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchUsers}
            disabled={loading}
            className="w-full min-w-fit whitespace-normal sm:w-auto"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {t("userManagement.refresh")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={roleFilter === filter ? "default" : "outline"}
              className="whitespace-normal"
              onClick={() => setRoleFilter(filter)}
            >
              {t(`userManagement.filter.${filter}`)}
              {!loading && (
                <Badge
                  variant={roleFilter === filter ? "secondary" : "outline"}
                  className="ms-1.5"
                >
                  {roleCounts[filter] ?? 0}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("userManagement.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertTitle>{t("userManagement.successTitle")}</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {loading && <TableSkeleton />}

        {!loading && filteredUsers.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Users className="size-10 text-muted-foreground/50" />
              <div className="max-w-md space-y-1">
                <h2 className="text-lg font-semibold">
                  {t("userManagement.emptyTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("userManagement.emptyHint")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && filteredUsers.length > 0 && (
          <>
            <div className="hidden lg:block">
              <Card className="glass-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("userManagement.user")}</TableHead>
                      <TableHead>{t("auth.email")}</TableHead>
                      <TableHead>{t("auth.phone")}</TableHead>
                      <TableHead>{t("auth.role")}</TableHead>
                      <TableHead>{t("userManagement.status")}</TableHead>
                      <TableHead>{t("userManagement.joined")}</TableHead>
                      <TableHead className="text-end">
                        {t("userManagement.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                              <UserRound className="size-4 text-muted-foreground" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium">{user.name}</p>
                              {user._id === currentUser?._id && (
                                <p className="text-xs text-primary">
                                  {t("userManagement.you")}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="break-all" dir="ltr">
                            {user.email}
                          </span>
                        </TableCell>
                        <TableCell dir="ltr">
                          {user.phone || t("common.notProvided")}
                        </TableCell>
                        <TableCell>
                          <UserRoleBadge role={user.role} />
                        </TableCell>
                        <TableCell>
                          <VerificationBadge isVerified={user.isVerified} />
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt, i18n.language)}</TableCell>
                        <TableCell>
                          <UserActions
                            user={user}
                            currentUserId={currentUser?._id}
                            busyAction={busyAction}
                            onVerify={handleVerify}
                            onRoleChange={handleRoleChange}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            <div className="grid gap-4 lg:hidden">
              {filteredUsers.map((user) => (
                <Card key={user._id} className="glass-card">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                          <UserRound className="size-5 text-muted-foreground" />
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="text-base">{user.name}</CardTitle>
                          {user._id === currentUser?._id && (
                            <CardDescription className="text-primary">
                              {t("userManagement.you")}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <UserRoleBadge role={user.role} />
                    </div>
                    <VerificationBadge isVerified={user.isVerified} />
                  </CardHeader>

                  <CardContent className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 break-all text-muted-foreground">
                      <Mail className="size-4 shrink-0" />
                      <span dir="ltr">{user.email}</span>
                    </p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-4 shrink-0" />
                      <span dir="ltr">
                        {user.phone || t("common.notProvided")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("userManagement.joined")}: {formatDate(user.createdAt, i18n.language)}
                    </p>
                  </CardContent>

                  <CardFooter className="border-t border-border/60">
                    <UserActions
                      user={user}
                      currentUserId={currentUser?._id}
                      busyAction={busyAction}
                      onVerify={handleVerify}
                      onRoleChange={handleRoleChange}
                    />
                  </CardFooter>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminUsersPage;

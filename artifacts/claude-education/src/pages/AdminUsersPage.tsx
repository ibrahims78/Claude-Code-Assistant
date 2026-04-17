import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/lib/i18n";
import { Link } from "wouter";
import { ArrowRight, ArrowLeft, Search, Shield, User, UserCheck, UserX, Trash2 } from "lucide-react";

interface UserRecord {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-500/20 text-purple-400",
  employee: "bg-blue-500/20 text-blue-400",
  user: "bg-muted text-muted-foreground",
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { lang } = useLang();
  const isAr = lang === "ar";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const roleLabels: Record<string, string> = {
    admin: isAr ? "مدير" : "Admin",
    employee: isAr ? "موظف" : "Employee",
    user: isAr ? "مستخدم" : "User",
  };

  const { data: users, isLoading } = useQuery<UserRecord[]>({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (roleFilter) params.set("role", roleFilter);
      return api.get(`/users?${params}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserRecord> }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => {
      toast({ title: isAr ? "تم التحديث" : "Updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast({ title: isAr ? "تم الحذف" : "Deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" }),
  });

  const handleDelete = (user: UserRecord) => {
    const msg = isAr
      ? `هل أنت متأكد من حذف المستخدم "${user.username}"؟`
      : `Are you sure you want to delete "${user.username}"?`;
    if (!confirm(msg)) return;
    deleteMutation.mutate(user.id);
  };

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <button className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <BackIcon className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{isAr ? "إدارة المستخدمين" : "Manage Users"}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{isAr ? "عرض وإدارة جميع المستخدمين" : "View and manage all users"}</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute ${isAr ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? "بحث باسم المستخدم أو البريد..." : "Search by username or email..."}
            className={`w-full py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary ${isAr ? "pr-10 pl-4" : "pl-10 pr-4"}`}
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">{isAr ? "كل الأدوار" : "All roles"}</option>
          <option value="admin">{isAr ? "مدير" : "Admin"}</option>
          <option value="employee">{isAr ? "موظف" : "Employee"}</option>
          <option value="user">{isAr ? "مستخدم" : "User"}</option>
        </select>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !users?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{isAr ? "لا يوجد مستخدمون" : "No users found"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "المستخدم" : "User"}</th>
                  <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "البريد" : "Email"}</th>
                  <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "الدور" : "Role"}</th>
                  <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "الحالة" : "Status"}</th>
                  <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "تاريخ الإنشاء" : "Created"}</th>
                  <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {user.username[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-sm">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={e => updateMutation.mutate({ id: user.id, data: { role: e.target.value } })}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 focus:outline-none cursor-pointer ${ROLE_COLORS[user.role]}`}
                      >
                        <option value="admin">{isAr ? "مدير" : "Admin"}</option>
                        <option value="employee">{isAr ? "موظف" : "Employee"}</option>
                        <option value="user">{isAr ? "مستخدم" : "User"}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateMutation.mutate({ id: user.id, data: { isActive: !user.isActive } })}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                          user.isActive ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        }`}
                      >
                        {user.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {user.isActive ? (isAr ? "نشط" : "Active") : (isAr ? "موقوف" : "Inactive")}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString(isAr ? "ar" : "en")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={user.role === "admin"}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={user.role === "admin" ? (isAr ? "لا يمكن حذف مدير" : "Cannot delete admin") : (isAr ? "حذف" : "Delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

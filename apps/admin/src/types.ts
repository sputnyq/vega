export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Kundenberater";
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  blocked: boolean;
};

export type PendingInitialPassword = {
  currentPassword: string;
};

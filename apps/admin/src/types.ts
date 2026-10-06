export type StaffUser = {
  name: string;
  email: string;
  role: "Admin" | "Kundenberater";
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
};

export type PendingInitialPassword = {
  currentPassword: string;
};

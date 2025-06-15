export type LoginRequest = {
  userName: string;
  password: string;
};

export type ChangePasswordRequest = {
  oldPassword: string;
  newPassword: string;
};

export type RemoveUserRequest = {
  userId: number;
};

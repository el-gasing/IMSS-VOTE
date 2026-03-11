export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface CasUser {
  sub: string;
  email: string;
  attributes: Record<string, string>;
  roles: string[];
  isStudent: boolean;
  isAdmin: boolean;
}

export interface RegistrationRecord {
  id: string;
  ui_subject_id: string;
  email_ui: string;
  wallet: string;
  status: RegistrationStatus;
  approved_at: string | null;
  tx_hash_whitelist: string | null;
  nonce: string | null;
  nonce_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

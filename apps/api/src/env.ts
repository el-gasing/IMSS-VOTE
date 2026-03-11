import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  SSO_UI_CAS_URL: z.string().url().default("https://sso.ui.ac.id/cas2"),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  APP_WEB_URL: z.string().url().default("http://localhost:3000"),
  SESSION_JWT_SECRET: z.string().min(16),

  CAS_STUDENT_ATTR_KEY: z.string().default("peran_user"),
  CAS_STUDENT_ATTR_VALUES: z.string().default("Mahasiswa,mahasiswa,student"),
  CAS_EMAIL_ATTR_KEY: z.string().default("mail"),
  CAS_ADMIN_USERS: z.string().default(""),

  INTERNAL_API_KEY: z.string().min(16),

  CHAIN_ID: z.coerce.number().int().positive().default(11155111),
  RPC_URL: z.string().url(),
  ADMIN_SIGNER_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  ELECTION_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

export const env = envSchema.parse(process.env);

import { env } from "./env.js";
import { isAdminUsername } from "./db.js";
import type { CasUser } from "./types.js";

function xmlTagValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}

function xmlAttributes(xml: string): Record<string, string> {
  const attributesSection = xmlTagValue(xml, "attributes");
  if (!attributesSection) return {};

  const regex = /<(?:\w+:)?([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/(?:\w+:)?\1>/g;
  const output: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = regex.exec(attributesSection)) !== null) {
    output[match[1]] = match[2].trim();
  }
  return output;
}

function isStudent(attributes: Record<string, string>): boolean {
  const key = env.CAS_STUDENT_ATTR_KEY;
  const attrValue = attributes[key] || "";
  const allowed = env.CAS_STUDENT_ATTR_VALUES.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(attrValue.toLowerCase());
}

function normalizeCasBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function buildCasLoginUrl(serviceUrl: string): string {
  const base = normalizeCasBaseUrl(env.SSO_UI_CAS_URL);
  const url = new URL(`${base}/login`);
  url.searchParams.set("service", serviceUrl);
  // Force CAS to re-prompt credentials instead of silently reusing last SSO session.
  url.searchParams.set("renew", "true");
  return url.toString();
}

export function buildCasLogoutUrl(returnUrl?: string): string {
  const base = normalizeCasBaseUrl(env.SSO_UI_CAS_URL);
  const url = new URL(`${base}/logout`);
  if (returnUrl) {
    // Keep both params for compatibility with different CAS deployments.
    url.searchParams.set("service", returnUrl);
    url.searchParams.set("url", returnUrl);
  }
  return url.toString();
}

export async function validateCasTicket(ticket: string, serviceUrl: string): Promise<CasUser> {
  const base = normalizeCasBaseUrl(env.SSO_UI_CAS_URL);
  const validateUrl = new URL(`${base}/serviceValidate`);
  validateUrl.searchParams.set("ticket", ticket);
  validateUrl.searchParams.set("service", serviceUrl);

  const response = await fetch(validateUrl);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`CAS validation failed with HTTP ${response.status}`);
  }

  const user = xmlTagValue(body, "user");
  if (!user) {
    const failure = xmlTagValue(body, "authenticationFailure") || "CAS authentication failure";
    throw new Error(failure);
  }

  const attributes = xmlAttributes(body);
  const email = attributes[env.CAS_EMAIL_ATTR_KEY] || `${user}@ui.ac.id`;
  const admin = await isAdminUsername(user);

  return {
    sub: user,
    email,
    attributes,
    roles: [isStudent(attributes) ? "student" : "user", admin ? "admin" : ""].filter(Boolean),
    isStudent: isStudent(attributes),
    isAdmin: admin
  };
}

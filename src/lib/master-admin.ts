import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { normalizeUsername } from "@/lib/usernames";
import type { SessionUser } from "@/lib/types";

const SESSION_NAME = "shopledger-master-admin";
const SESSION_MAX_AGE = 60 * 60 * 12;

type MasterSessionData = {
  user?: SessionUser;
};

type MasterLoginInput = {
  username: string;
  password: string;
};

type MasterConfig = {
  id: string;
  password: string;
  sessionSecret: string;
};

function readMasterConfig(): MasterConfig | null {
  const id = process.env.SHOPLEDGER_MASTER_ADMIN_ID?.trim();
  const password = process.env.SHOPLEDGER_MASTER_ADMIN_PASSWORD;
  const sessionSecret = process.env.SHOPLEDGER_SESSION_SECRET?.trim();
  if (!id || !password || !sessionSecret || sessionSecret.length < 32) return null;
  return { id, password, sessionSecret };
}

function sessionConfig(sessionSecret: string) {
  return {
    name: SESSION_NAME,
    password: sessionSecret,
    maxAge: SESSION_MAX_AGE,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

/** Compare secrets without putting the configured password in the client bundle. */
function sameSecret(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function parseLoginInput(input: unknown): MasterLoginInput {
  if (!input || typeof input !== "object") throw new Error("Invalid login request");
  const value = input as Record<string, unknown>;
  // `phone` — পুরনো ক্লায়েন্টের ফিল্ড, এখন ইউজারনেম হিসেবেই মেলে।
  const username = value.username ?? value.phone;
  if (typeof username !== "string" || typeof value.password !== "string") {
    throw new Error("Invalid login request");
  }
  return { username, password: value.password };
}

function masterUser(id: string): SessionUser {
  return {
    id: "system-admin",
    name: "সিস্টেম অ্যাডমিন",
    username: normalizeUsername(id),
    phone: "",
    role: "systemAdmin",
  };
}

export const loginMasterSystemAdmin = createServerFn({ method: "POST" })
  .validator(parseLoginInput)
  .handler(async ({ data }) => {
    const config = readMasterConfig();
    if (!config) return { configured: false, authenticated: false } as const;

    const authenticated =
      normalizeUsername(data.username) === normalizeUsername(config.id) &&
      sameSecret(data.password, config.password);
    if (!authenticated) return { configured: true, authenticated: false } as const;

    const user = masterUser(config.id);
    const session = await useSession<MasterSessionData>(sessionConfig(config.sessionSecret));
    await session.update({ user });
    return { configured: true, authenticated: true, user } as const;
  });

export const getMasterSystemAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const config = readMasterConfig();
  if (!config) return { user: null } as const;
  const session = await useSession<MasterSessionData>(sessionConfig(config.sessionSecret));
  const user = session.data.user;
  return { user: user?.role === "systemAdmin" ? user : null } as const;
});

export const logoutMasterSystemAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const config = readMasterConfig();
  if (config) {
    const session = await useSession<MasterSessionData>(sessionConfig(config.sessionSecret));
    await session.clear();
  }
  return { ok: true } as const;
});

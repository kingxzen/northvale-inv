"use client";

export type LocalUserRole = "admin" | "user";

export type LocalSession = {
  username: string;
  role: LocalUserRole;
  loggedInAt: string;
};

const SESSION_KEY = "northvale_inv_session";

const ACCOUNTS: Record<string, { password: string; secretKey: string; role: LocalUserRole }> = {
  admin: { password: "@@@Khaizen", secretKey: "skylark", role: "admin" },
  adminuser: { password: "@@@Khaizen", secretKey: "skylark", role: "user" }
};

export function signInLocal(username: string, password: string, secretKey: string) {
  const normalizedUsername = username.trim();
  const account = ACCOUNTS[normalizedUsername];

  if (!account || account.password !== password || account.secretKey !== secretKey) {
    return null;
  }

  const session: LocalSession = {
    username: normalizedUsername,
    role: account.role,
    loggedInAt: new Date().toISOString()
  };

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getLocalSession(): LocalSession | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored) as Partial<LocalSession>;
    if (!session.username || !session.role) return null;
    if (session.role !== "admin" && session.role !== "user") return null;
    return {
      username: session.username,
      role: session.role,
      loggedInAt: session.loggedInAt ?? new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export function clearLocalSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

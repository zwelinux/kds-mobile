import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../config";

const STORAGE_KEY = "kds_mobile_auth";

export async function getStoredAuth() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveAuth(auth) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(auth || {}));
}

export async function clearAuth() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function loginWithPassword(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "Login failed");
  }

  const auth = {
    token: data.token,
    username: data.username,
    roles: Array.isArray(data.roles) ? data.roles : [],
    scheme: "Token",
  };

  await saveAuth(auth);
  return auth;
}

export async function authedFetch(path, auth, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (auth?.token) {
    headers.Authorization = `${auth.scheme || "Token"} ${auth.token}`;
  }
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
}

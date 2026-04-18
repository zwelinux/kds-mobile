export const API_BASE = "https://admin.jusbackend.store/api";
export const WS_BASE = "wss://admin.jusbackend.store";
export const ENABLE_ORDER_SOUND = true;
export const ENABLE_ORDER_VOICE = true;
export const ORDER_VOICE_LANGUAGE = "en-US";

export function getWsCandidates(path) {
  const urls = [];

  try {
    const apiUrl = new URL(API_BASE);
    const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
    urls.push(`${wsProtocol}//${apiUrl.host}${path}`);
  } catch {}

  try {
    const wsUrl = new URL(WS_BASE);
    urls.unshift(`${wsUrl.protocol}//${wsUrl.host}${path}`);
  } catch {}

  return [...new Set(urls)];
}

export function cleanStationSlug(value) {
  return String(value || "MAIN")
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z._-]/g, "_")
    .slice(0, 80);
}

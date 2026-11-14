const BASE = import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";
export function saveApiKey(value) { sessionStorage.setItem("payflow_api_key", value.trim()); }
export function getApiKey() { return sessionStorage.getItem("payflow_api_key") || ""; }

export async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getApiKey()}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

export async function fetchData(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    const error = new Error(body?.error || "Aimlabs data is unavailable. Try again.");
    error.status = response.status;
    throw error;
  }
  return body;
}

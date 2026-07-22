export function getCsrfHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {};

  const token = document.cookie
    .split("; ")
    .find((item) => item.startsWith("aa-csrf-token="))
    ?.split("=")[1];

  return token ? { "x-aa-csrf-token": decodeURIComponent(token) } : {};
}

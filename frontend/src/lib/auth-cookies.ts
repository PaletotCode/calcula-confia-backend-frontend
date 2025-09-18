const AUTH_COOKIE_NAME = "access_token";

function buildDomainCandidates(): Array<string | undefined> {
  const domains = new Set<string | undefined>();
  const envDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();

  if (envDomain) {
    domains.add(envDomain);
    if (envDomain.startsWith(".")) {
      domains.add(envDomain.slice(1));
    } else {
      domains.add(`.${envDomain}`);
    }
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host) {
      domains.add(host);
      if (!host.startsWith(".")) {
        domains.add(`.${host}`);
      }

      const hostParts = host.split(".");
      if (hostParts.length > 2) {
        const withoutFirstLabel = hostParts.slice(1).join(".");
        domains.add(withoutFirstLabel);
        domains.add(`.${withoutFirstLabel}`);
      }
    }
  }

  domains.add(undefined);
  return Array.from(domains);
}

export function clearAccessTokenCookie() {
  if (typeof document === "undefined") {
    return;
  }

  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const baseAttributes = ["Path=/", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "Max-Age=0"];

  if (isHttps) {
    // The backend sets the cookie with `Secure; SameSite=None`. Keeping the same
    // attributes avoids browsers ignoring the delete instruction in cross-site
    // scenarios (e.g. Cloudflare Worker proxying to Railway).
    baseAttributes.push("Secure", "SameSite=None");
  }

  for (const domain of buildDomainCandidates()) {
    const attributes = [...baseAttributes];
    if (domain) {
      attributes.unshift(`Domain=${domain}`);
    }
    document.cookie = `${AUTH_COOKIE_NAME}=; ${attributes.join("; ")}`;
  }
}

export { AUTH_COOKIE_NAME };
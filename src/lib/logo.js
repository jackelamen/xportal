// Resolves a stored client logo to something an <img src> can render. Logos are
// stored as base64 data URIs (so they persist on serverless hosts without a
// filesystem); legacy filesystem paths still resolve through the authed files
// route for backward compatibility.
export function logoSrc(logoPath) {
  if (!logoPath) return null;
  if (logoPath.startsWith("data:")) return logoPath;
  return `/api/${logoPath.replace(/^uploads\//, "files/")}`;
}

export const isDataLogo = (logoPath) => !!logoPath && logoPath.startsWith("data:");

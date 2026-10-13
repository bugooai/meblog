const JSDELIVR_GH_REGEX =
  /^https?:\/\/(?:cdn|fastly|testingcf|origin-fastly)\.jsdelivr\.net\/gh\/([^/]+)\/([^@/]+)@([^/]+)\/(.+)$/i;
const RAW_GITHUB_REGEX =
  /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i;

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/+$/, "");
}

export function buildCoverFallbackCandidates(
  src: string,
  options?: {
    giteeAssetsBase?: string | null;
  }
): string[] {
  const candidates: string[] = [];
  const value = (src || "").trim();
  const giteeBase = options?.giteeAssetsBase ? normalizeBaseUrl(options.giteeAssetsBase) : "";

  if (!value) {
    return candidates;
  }

  candidates.push(value);

  const jsdelivrMatch = value.match(JSDELIVR_GH_REGEX);
  if (jsdelivrMatch) {
    const [, owner, repo, ref, path] = jsdelivrMatch;
    if (giteeBase) {
      candidates.push(`${giteeBase}/${path}`);
    }
    candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`);
    return Array.from(new Set(candidates));
  }

  const rawMatch = value.match(RAW_GITHUB_REGEX);
  if (rawMatch && giteeBase) {
    const [, , , , path] = rawMatch;
    candidates.push(`${giteeBase}/${path}`);
  }

  return Array.from(new Set(candidates));
}

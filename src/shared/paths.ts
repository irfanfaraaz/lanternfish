/**
 * Compiles exclude patterns into a matcher. `*` matches any characters;
 * everything else is literal. A trailing `/*` also matches the bare prefix,
 * so `/admin/*` excludes `/admin` but not `/administer`.
 */
export function compileExcludes(patterns: string[]): (path: string) => boolean {
  if (patterns.length === 0) return () => false;
  const parts = patterns.map((p) => {
    const lit = p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
    let src = lit.join(".*");
    if (p.endsWith("/*")) src = `${lit.slice(0, -1).join(".*").replace(/\/$/, "")}(?:/.*)?`;
    return src;
  });
  const re = new RegExp(`^(?:${parts.join("|")})$`);
  return (path) => re.test(path.split("?")[0] ?? path);
}

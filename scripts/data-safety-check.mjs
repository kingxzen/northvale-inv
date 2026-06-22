import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const scanRoots = ["src", "supabase"];
const ignoredDirs = new Set(["node_modules", ".next", ".git"]);
const dangerousPatterns = [
  { label: "localStorage.clear", pattern: /localStorage\.clear\s*\(/ },
  { label: "resetDatabase", pattern: /\bresetDatabase\b/ },
  { label: "deleteMany", pattern: /\bdeleteMany\b/ },
  { label: "truncate command", pattern: /(^|[;\n])\s*truncate\s+(table\s+)?/im },
  { label: "drop table", pattern: /(^|[;\n])\s*drop\s+table\b/im },
  { label: "delete from", pattern: /(^|[;\n])\s*delete\s+from\b/im }
];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (ignoredDirs.has(entry)) return [];
      return walk(fullPath);
    }
    if (!/\.(ts|tsx|js|jsx|sql)$/.test(entry)) return [];
    return [fullPath];
  });
}

const findings = scanRoots
  .flatMap((scanRoot) => walk(join(root, scanRoot)))
  .flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return dangerousPatterns
      .filter(({ pattern }) => pattern.test(text))
      .map(({ label }) => `${relative(root, file)} contains ${label}`);
  });

if (findings.length > 0) {
  console.error("Data safety check failed. Review destructive/reset behavior before deploying:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log("Data safety check passed: no obvious destructive reset patterns found.");

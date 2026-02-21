const fs = require("fs");
const path = require("path");

const baseDir = path.join("src", "app");

function toTitleCase(value) {
  return value
    .replace(/\[|\]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createPlaceholderContent(relativePath) {
  const segments = relativePath.split(path.sep);
  const pageIndex = segments.lastIndexOf("page.tsx");
  const titleSegments = segments.slice(0, pageIndex).filter(Boolean);
  const title = toTitleCase(titleSegments[titleSegments.length - 1] || "Page");
  return `import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export default function Page() {
  return <PlaceholderPage title="${title}" />;
}
`;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && entry.name === "page.tsx") {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.trim().length === 0) {
        const relative = path.relative(baseDir, fullPath);
        const placeholder = createPlaceholderContent(relative);
        fs.writeFileSync(fullPath, placeholder, "utf8");
      }
    }
  }
}

walk(baseDir);
console.log("Empty pages scaffolded.");

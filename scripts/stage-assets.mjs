import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, ".assets");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else fs.copyFileSync(source, target);
  }
}

fs.rmSync(destination, { recursive: true, force: true });
copyDir(path.join(root, "public"), destination);
copyDir(path.join(root, "knowledge"), path.join(destination, "knowledge"));

const playbooks = fs
  .readdirSync(path.join(root, "knowledge"))
  .filter((file) => file.endsWith(".md"))
  .map((file) => {
    const raw = fs.readFileSync(path.join(root, "knowledge", file), "utf8");
    return { id: file.replace(/\.md$/, ""), title: raw.match(/^#\s+(.+)/)?.[1] ?? file };
  });
fs.writeFileSync(path.join(destination, "playbooks.json"), JSON.stringify(playbooks));
console.log(`Assets prêts : ${playbooks.length} playbooks`);

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generated = resolve(root, "android/app/build/generated/ithread");
const web = resolve(generated, "assets/web");
// Generated build outputs only. Always run the normal Vite build first.
const html = await readFile(resolve(root, "dist/index.html"), "utf8");
await mkdir(web, { recursive: true });
await cp(resolve(root, "dist"), web, { recursive: true });
await cp(resolve(root, "android/bootstrap.js"), resolve(web, "android-bootstrap.js"));
await writeFile(
  resolve(web, "index.html"),
  html.replace("<head>", '<head><script src="./android-bootstrap.js"></script>'),
);
const icons = resolve(generated, "res/mipmap-nodpi");
await mkdir(icons, { recursive: true });
await cp(resolve(root, "public/icon-512.png"), resolve(icons, "ic_launcher.png"));
console.log("Android offline assets staged with the existing iThread icon.");

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
const compatibility = process.env.ITHREAD_ANDROID_COMPAT === "huawei";
await writeFile(resolve(generated, "build-profile.txt"), compatibility ? "huawei" : "standard");
if (compatibility) {
  await cp(resolve(root, "android/compatibility.html"), resolve(web, "compatibility.html"));
  await cp(resolve(root, "android/huawei-bootstrap.js"), resolve(web, "huawei-bootstrap.js"));
  await cp(resolve(root, "android/huawei-compat.css"), resolve(web, "huawei-compat.css"));
}
await writeFile(
  resolve(web, "index.html"),
  html.replace(
    "<head>",
    `<head><script src="./android-bootstrap.js"></script>${
      compatibility
        ? '<script src="./huawei-bootstrap.js"></script><link rel="stylesheet" href="./huawei-compat.css">'
        : ""
    }`,
  ),
);
const icons = resolve(generated, "res/mipmap-nodpi");
await mkdir(icons, { recursive: true });
await cp(resolve(root, "public/icon-512.png"), resolve(icons, "ic_launcher.png"));
console.log("Android offline assets staged with the existing iThread icon.");

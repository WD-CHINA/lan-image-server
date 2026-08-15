/**
 * 构建脚本：将 qrcode-generator 内联到主文件，然后打包 SEA 可执行文件
 * 支持平台：Windows / macOS / Linux（在当前运行平台上构建）
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── 平台检测 ──────────────────────────────────────
const platform = process.platform;
const isWin = platform === "win32";
const isMac = platform === "darwin";
const BIN_NAME = isWin ? "图片传输服务.exe" : "图片传输服务";

console.log(`🖥️  当前平台: ${platform} (${process.arch})`);
console.log(`📦 输出文件: dist/${BIN_NAME}\n`);

// ── 1. 内联合并 ──────────────────────────────────
let libCode = fs.readFileSync(
  path.join(__dirname, "node_modules", "qrcode-generator", "dist", "qrcode.js"),
  "utf-8"
);
libCode = libCode.replace(
  /\(function\s*\(factory\)\s*\{[\s\S]*?\}\)\);\s*$/,
  () => "module.exports = qrcode;"
);

let mainCode = fs.readFileSync(path.join(__dirname, "image_server.js"), "utf-8");
mainCode = mainCode.replace(
  'const qrcode = require("qrcode-generator");',
  () => '// ── qrcode-generator (内联) ──\n' + libCode + '\n// ── end qrcode-generator ──\n'
);

const bundledPath = path.join(__dirname, "_bundled_server.js");
fs.writeFileSync(bundledPath, mainCode, "utf-8");
console.log("✅ 已生成合并文件");

// ── 2. SEA blob ─────────────────────────────────
const seaConfig = {
  main: "_bundled_server.js",
  output: "sea-prep.blob",
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
};
const seaConfigPath = path.join(__dirname, "sea-config.json");
fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

console.log("⏳ 生成 SEA blob...");
execSync("node --experimental-sea-config sea-config.json", { stdio: "inherit" });

// ── 3. 复制 node 二进制 ─────────────────────────
const distDir = path.join(__dirname, "dist");
fs.mkdirSync(distDir, { recursive: true });
const binPath = path.join(distDir, BIN_NAME);
fs.copyFileSync(process.execPath, binPath);

// macOS: 移除代码签名（必须，否则注入失败）
if (isMac) {
  console.log("⏳ 移除 macOS 代码签名...");
  try { execSync(`codesign --remove-signature "${binPath}"`, { stdio: "inherit" }); }
  catch (_) { /* 无签名时忽略 */ }
}
console.log(`✅ 已复制 node → dist/${BIN_NAME}`);

// ── 4. 注入 blob ────────────────────────────────
console.log("⏳ 注入 blob...");
const postjectArgs = [
  `npx postject "${binPath}"`,
  "NODE_SEA_BLOB sea-prep.blob",
  "--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  "--overwrite",
];
// macOS 需要额外指定 Mach-O segment name
if (isMac) {
  postjectArgs.push("--macho-segment-name NODE_SEA");
}
execSync(postjectArgs.join(" "), { stdio: "inherit" });

// macOS: 重新签名（ad-hoc）
if (isMac) {
  console.log("⏳ 重新签名 (ad-hoc)...");
  try { execSync(`codesign --sign - "${binPath}"`, { stdio: "inherit" }); }
  catch (_) { /* 忽略 */ }
}

// Linux: 添加可执行权限
if (platform === "linux") {
  fs.chmodSync(binPath, 0o755);
}

// ── 5. 清理 ─────────────────────────────────────
fs.unlinkSync(bundledPath);
fs.unlinkSync(seaConfigPath);
fs.unlinkSync(path.join(__dirname, "sea-prep.blob"));

const sizeMB = (fs.statSync(binPath).size / 1024 / 1024).toFixed(1);
console.log(`\n🎉 打包完成！ dist/${BIN_NAME} (${sizeMB} MB)`);

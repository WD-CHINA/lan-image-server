/**
 * 构建脚本：将 qrcode-generator 内联到主文件，然后打包 SEA exe
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// 读取库代码，去掉末尾的 UMD wrapper，改为直接赋值给全局变量
let libCode = fs.readFileSync(
  path.join(__dirname, "node_modules", "qrcode-generator", "dist", "qrcode.js"),
  "utf-8"
);
// 去掉最后的 UMD 导出块 (function (factory) { ... })
libCode = libCode.replace(
  /\(function\s*\(factory\)\s*\{[\s\S]*?\}\)\);\s*$/,
  () => "module.exports = qrcode;"
);

// 读取主文件，替换 require("qrcode-generator") 为内联代码
let mainCode = fs.readFileSync(path.join(__dirname, "image_server.js"), "utf-8");
mainCode = mainCode.replace(
  'const qrcode = require("qrcode-generator");',
  () => '// ── qrcode-generator (内联) ──\n' + libCode + '\n// ── end qrcode-generator ──\n'
);

// 写出合并后的文件
const bundledPath = path.join(__dirname, "_bundled_server.js");
fs.writeFileSync(bundledPath, mainCode, "utf-8");
console.log("✅ 已生成合并文件:", bundledPath);

// SEA 配置
const seaConfig = {
  main: "_bundled_server.js",
  output: "sea-prep.blob",
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
};
const seaConfigPath = path.join(__dirname, "sea-config.json");
fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

// 生成 blob
console.log("⏳ 生成 SEA blob...");
execSync("node --experimental-sea-config sea-config.json", { stdio: "inherit" });

// 复制 node.exe
const distDir = path.join(__dirname, "dist");
fs.mkdirSync(distDir, { recursive: true });
const exePath = path.join(distDir, "图片传输服务.exe");
fs.copyFileSync(process.execPath, exePath);
console.log("✅ 已复制 node.exe →", exePath);

// 注入 blob
console.log("⏳ 注入 blob...");
execSync(
  `npx postject "${exePath}" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite`,
  { stdio: "inherit" }
);

// 清理
fs.unlinkSync(bundledPath);
fs.unlinkSync(seaConfigPath);
fs.unlinkSync(path.join(__dirname, "sea-prep.blob"));

const sizeMB = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1);
console.log(`\n🎉 打包完成！ dist\\图片传输服务.exe (${sizeMB} MB)`);

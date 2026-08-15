/**
 * 局域网图片接收服务 (Node.js, 零依赖)
 *
 * 用法:  node image_server.js [--port 8080] [--dir ./uploads]
 *
 * 启动后，iPhone 连接同一 WiFi，用 Safari 打开终端显示的地址即可上传图片。
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { pipeline } = require("stream/promises");
const qrcode = require("qrcode-generator");

// ── 参数解析 ──────────────────────────────────────
const args = process.argv.slice(2);
let PORT = 8080;
let SAVE_DIR = path.join(os.homedir(), "Pictures", "iPhone上传");

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) PORT = parseInt(args[++i], 10);
  if (args[i] === "--dir" && args[i + 1]) SAVE_DIR = path.resolve(args[++i]);
}

fs.mkdirSync(SAVE_DIR, { recursive: true });

// ── 获取局域网 IP ─────────────────────────────────
function getLanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

// ── 简易 multipart 解析器 ─────────────────────────
function parseMultipart(buffer, boundary) {
  const files = [];
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const endBuf = Buffer.from(`--${boundary}--`);

  let start = buffer.indexOf(boundaryBuf) + boundaryBuf.length;

  while (start < buffer.length) {
    // 找下一个 boundary
    const nextBound = buffer.indexOf(boundaryBuf, start);
    if (nextBound === -1) break;

    // 这一段的完整内容
    const part = buffer.subarray(start, nextBound);

    // 头与 body 之间有空行 \r\n\r\n
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) { start = nextBound + boundaryBuf.length; continue; }

    const headerStr = part.subarray(0, headerEnd).toString("utf-8");
    // body 去掉末尾 \r\n
    let body = part.subarray(headerEnd + 4);
    if (body.length >= 2 && body[body.length - 2] === 13 && body[body.length - 1] === 10) {
      body = body.subarray(0, body.length - 2);
    }

    // 提取 filename
    const fnMatch = headerStr.match(/filename="([^"]+)"/i);
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (fnMatch) {
      files.push({
        filename: fnMatch[1],
        contentType: ctMatch ? ctMatch[1].trim() : "application/octet-stream",
        data: body,
      });
    }

    start = nextBound + boundaryBuf.length;
  }
  return files;
}

// ── 上传页面 HTML ─────────────────────────────────
const UPLOAD_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>图片传输</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"SF Pro","Helvetica Neue",sans-serif;
     background:#0a0a0a;color:#e8e8e8;min-height:100vh;padding:20px;padding-bottom:100px}
h1{text-align:center;font-size:1.5rem;margin-bottom:4px;color:#fff}
.sub{text-align:center;font-size:.8rem;color:#888;margin-bottom:24px}
.drop-zone{border:2px dashed #444;border-radius:16px;padding:36px 20px;
  text-align:center;cursor:pointer;transition:all .2s;
  background:#151515;margin-bottom:20px;position:relative}
.drop-zone.active{border-color:#0a84ff;background:#0a84ff10}
.drop-zone .icon{font-size:48px;margin-bottom:10px}
.drop-zone p{color:#aaa;font-size:.95rem}
.drop-zone input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer}
.cam-btn{display:inline-block;margin-top:14px;padding:10px 22px;
  background:#1c1c1e;border:1px solid #333;border-radius:10px;
  color:#0a84ff;font-size:.9rem;cursor:pointer}
.preview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));
  gap:8px;margin-bottom:20px}
.preview-grid .thumb{position:relative}
.preview-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid #333}
.preview-grid .remove{position:absolute;top:2px;right:2px;width:24px;height:24px;
  border-radius:50%;background:rgba(0,0,0,.7);color:#fff;border:none;
  font-size:14px;line-height:24px;text-align:center;cursor:pointer}
.btn{display:block;width:100%;padding:16px;border:none;border-radius:12px;
  font-size:1.1rem;font-weight:600;cursor:pointer;transition:all .15s;color:#fff;background:#0a84ff;
  position:fixed;bottom:20px;left:20px;right:20px;z-index:10}
.btn:disabled{background:#333;color:#666;cursor:default}
.btn:not(:disabled):active{transform:scale(.97)}
.progress{margin-top:16px}
.progress-bar{height:6px;border-radius:3px;background:#222;overflow:hidden}
.progress-bar .fill{height:100%;background:#0a84ff;width:0%;transition:width .2s}
.status{text-align:center;font-size:.85rem;color:#888;margin-top:8px}
.toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
  background:#30d158;color:#fff;padding:12px 28px;border-radius:20px;
  font-size:.95rem;font-weight:500;opacity:0;transition:opacity .3s;
  pointer-events:none;z-index:99;white-space:nowrap}
.toast.show{opacity:1}
</style>
</head>
<body>
<h1>📷 图片传输</h1>
<p class="sub">选择或拍照上传图片，发送到电脑</p>
<div class="drop-zone" id="dropZone">
  <input type="file" id="fileInput" multiple accept="image/*">
  <div class="icon">📁</div>
  <p>点击选择图片 / 拖拽到此处</p>
  <p style="font-size:.75rem;color:#555;margin-top:4px">支持多选</p>
  <label class="cam-btn" id="camBtn">📸 拍照上传
    <input type="file" accept="image/*" capture="environment" style="display:none" id="camInput">
  </label>
</div>
<div class="preview-grid" id="grid"></div>
<button class="btn" id="uploadBtn" disabled>上传图片 (0)</button>
<div class="progress" id="progressArea" style="display:none">
  <div class="progress-bar"><div class="fill" id="fill"></div></div>
  <p class="status" id="st">准备中...</p>
</div>
<div class="toast" id="toast"></div>
<script>
const $=s=>document.getElementById(s);
const dropZone=$("dropZone"),fileInput=$("fileInput"),grid=$("grid"),
      uploadBtn=$("uploadBtn"),progressArea=$("progressArea"),
      fill=$("fill"),st=$("st"),toast=$("toast"),camInput=$("camInput");
let files=[];

fileInput.addEventListener("change",e=>addFiles(e.target.files));
camInput.addEventListener("change",e=>addFiles(e.target.files));

dropZone.addEventListener("dragover",e=>{e.preventDefault();dropZone.classList.add("active")});
dropZone.addEventListener("dragleave",()=>dropZone.classList.remove("active"));
dropZone.addEventListener("drop",e=>{e.preventDefault();dropZone.classList.remove("active");addFiles(e.dataTransfer.files)});

function addFiles(fl){for(const f of fl)if(f.type.startsWith("image/"))files.push(f);render()}

function render(){
  grid.innerHTML="";
  files.forEach((f,i)=>{
    const d=document.createElement("div");d.className="thumb";
    const img=document.createElement("img");img.src=URL.createObjectURL(f);
    const btn=document.createElement("button");btn.className="remove";btn.textContent="×";
    btn.onclick=()=>{files.splice(i,1);render()};
    d.appendChild(img);d.appendChild(btn);grid.appendChild(d);
  });
  uploadBtn.disabled=!files.length;
  uploadBtn.textContent="上传图片 ("+files.length+")";
}

uploadBtn.addEventListener("click",async()=>{
  if(!files.length)return;
  uploadBtn.disabled=true;progressArea.style.display="block";
  const total=files.length;let done=0,fail=0;
  for(const file of files){
    const fd=new FormData();fd.append("file",file);
    try{st.textContent="上传中 "+(done+1)+"/"+total+" ...";
      const r=await fetch("/upload",{method:"POST",body:fd});
      if(!r.ok)throw 0;
    }catch(e){fail++}
    done++;fill.style.width=(done/total*100)+"%";
  }
  toast.textContent=fail?"⚠️ "+fail+" 个失败":"✅ 全部 "+total+" 张上传成功！";
  toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),3000);
  if(!fail){files=[];grid.innerHTML="";uploadBtn.textContent="上传图片 (0)"}
  progressArea.style.display="none";fill.style.width="0%";uploadBtn.disabled=false;
  fileInput.value="";camInput.value="";
});
</script>
</body>
</html>`;

// ── HTTP 服务器 ───────────────────────────────────
const server = http.createServer(async (req, res) => {
  // GET /  → 上传页面
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(UPLOAD_HTML);
    return;
  }

  // POST /upload  → 接收文件
  if (req.method === "POST" && req.url === "/upload") {
    const ct = req.headers["content-type"] || "";
    const bMatch = ct.match(/boundary=(.+)/);
    if (!bMatch) { res.writeHead(400); res.end("Bad Request"); return; }

    // 读取整个请求体
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    const uploaded = parseMultipart(body, bMatch[1]);

    for (const file of uploaded) {
      const ext = path.extname(file.filename) || ".jpg";
      const stem = path.basename(file.filename, ext).replace(/[^a-zA-Z0-9_\\u4e00-\\u9fff-]/g, "_");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const safeName = `${stem}_${ts}${ext}`;
      const savePath = path.join(SAVE_DIR, safeName);

      fs.writeFileSync(savePath, file.data);
      const kb = (file.data.length / 1024).toFixed(1);
      console.log(`  ✅ 已保存: ${safeName}  (${kb} KB)`);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, count: uploaded.length }));
    return;
  }

  // 其他 → 404
  res.writeHead(404);
  res.end("Not Found");
});

// ── 启动 ──────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  const lanIP = getLanIP();
  const url = `http://${lanIP}:${PORT}`;

  console.log();
  console.log("=".repeat(52));
  console.log("  📷  局域网图片接收服务  已启动");
  console.log("=".repeat(52));
  console.log();
  console.log(`  📁 保存目录 : ${SAVE_DIR}`);
  console.log(`  🌐 本机地址 : ${url}`);
  console.log(`  📱 iPhone   : 连接同一 WiFi → Safari 打开上方地址`);
  console.log();
  console.log("  按 Ctrl+C 停止服务");
  console.log("-".repeat(52));

  // 终端二维码
  try {
    const qr = qrcode(0, "L");
    qr.addData(url);
    qr.make();
    const modules = qr.getModuleCount();
    const lines = [];
    // 使用 Unicode half-block 字符，每行显示 2 个模块行，更紧凑
    const UP = "\u2580";  // ▀ 上半块
    const DN = "\u2584";  // ▄ 下半块
    const FULL = "\u2588"; // █ 全块
    const NONE = " ";
    const border = 2;
    const width = modules + border * 2;
    for (let r = -border; r < modules + border; r += 2) {
      let line = "";
      for (let c = -border; c < modules + border; c++) {
        const top = (r >= 0 && r < modules && c >= 0 && c < modules) ? qr.isDark(r, c) : false;
        const bot = (r+1 >= 0 && r+1 < modules && c >= 0 && c < modules) ? qr.isDark(r+1, c) : false;
        if (top && bot) line += FULL;
        else if (top)   line += UP;
        else if (bot)   line += DN;
        else            line += NONE;
      }
      lines.push(line);
    }
    console.log();
    lines.forEach(l => console.log("  " + l));
    console.log();
    console.log("  ↑ 用 iPhone 相机扫描此二维码");
    console.log();
  } catch (e) {
    console.log("  (二维码生成失败: " + e.message + ")");
  }
});



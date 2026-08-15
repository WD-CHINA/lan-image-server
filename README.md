# 📂 LAN Image Server

> 零依赖、跨平台的局域网文件传输工具。设备间互传任意文件，无需安装客户端。

[![Build & Release](https://github.com/WD-CHINA/lan-image-server/actions/workflows/build.yml/badge.svg)](https://github.com/WD-CHINA/lan-image-server/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## ✨ 特性

- **零依赖** — 单文件可执行程序，无需安装 Node.js 或任何运行时
- **跨平台** — 支持 Windows / macOS (Apple Silicon & Intel) / Linux
- **任意文件** — 不限于图片，支持传输任意类型文件
- **设备通用** — 手机、电脑、平板，只要有浏览器即可使用
- **终端二维码** — 启动后直接在终端显示可扫描的二维码
- **暗色 UI** — 移动端优化的现代深色界面

## 🚀 快速开始

### 下载

前往 [Releases](https://github.com/WD-CHINA/lan-image-server/releases) 下载对应平台的可执行文件：

| 平台 | 文件 |
|------|------|
| Windows x64 | `lan-image-server-windows-x64.exe` |
| macOS ARM64 (Apple Silicon) | `lan-image-server-macos-arm64` |
| Linux x64 | `lan-image-server-linux-x64.bin` |

### 使用

**Windows**：双击 `.exe` 文件即可运行。

**macOS / Linux**：打开终端，执行：

```bash
# 添加执行权限（仅首次需要）
chmod +x lan-image-server-*

# 运行
./lan-image-server-macos-arm64   # macOS Apple Silicon
./lan-image-server-linux-x64.bin # Linux
```

> macOS 首次运行可能提示“无法验证开发者”，前往 **系统设置 → 隐私与安全性** 点击“仍要打开”。

### 通用流程

1. 运行后终端会显示局域网地址和二维码
2. 其他设备连接同一 WiFi，浏览器打开该地址（或扫描二维码）
3. 选择文件，点击上传 — 完成！

```bash
# 默认端口 8080，文件保存到 ~/Desktop/LAN-Uploads/
./lan-image-server

# 自定义端口和保存目录
./lan-image-server --port 9090 --dir "/path/to/folder"
```

### 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--port` | `8080` | HTTP 服务监听端口 |
| `--dir` | `~/Desktop/LAN-Uploads` | 文件保存目录 |

## 🔧 从源码构建

需要 [Node.js 22+](https://nodejs.org/) 和 npm。

```bash
git clone https://github.com/WD-CHINA/lan-image-server.git
cd lan-image-server

npm install        # 安装依赖
npm run dev        # 开发模式运行
npm run build      # 打包为当前平台的可执行文件
```

构建产物输出到 `dist/` 目录。

> **注意**：Node.js SEA 只能在当前运行平台上构建对应平台的可执行文件。如需分发所有平台，需在各平台分别构建，或使用 GitHub Actions 自动构建。

## 🏗️ 技术栈

- **运行时**: [Node.js](https://nodejs.org/) — 仅使用内置模块（http, fs, path, os）
- **二维码**: [qrcode-generator](https://github.com/nicjansma/qrcode-generator) — 构建时内联
- **打包**: [Node.js SEA](https://nodejs.org/api/single-executable-applications.html) — 单可执行文件
- **注入**: [postject](https://github.com/nicjansma/postject) — SEA blob 注入
- **CI/CD**: GitHub Actions — 跨平台自动构建 + Release 发布
- **主页**: GitHub Pages — 项目文档与下载页

## 📁 项目结构

```
lan-image-server/
├── .github/
│   └── workflows/
│       └── build.yml          # GitHub Actions 多平台构建
├── docs/
│   └── index.html             # GitHub Pages 项目主页
├── build.js                   # SEA 构建脚本
├── image_server.js            # 主程序
├── package.json
└── package-lock.json
```

## 📄 License

[MIT](LICENSE)

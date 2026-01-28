# Web Serial Assistant

[中文](README.md) | [English](#english)

一个基于浏览器的串口和蓝牙调试助手，支持 TTY 终端交互及 ZMODEM 文件传输。

## 🚀 核心特性

- **Web Serial 支持**：直接与本地串口设备通信，支持波特率、数据位、停止位及校验位配置。
- **Web Bluetooth 支持**：支持 BLE 设备的搜索与连接，内置常用 UART 服务支持（如 FFE0, FFF0），支持名称前缀筛选。
- **专业 TTY 终端**：集成 Xterm.js 渲染，提供类似 Linux 终端的即时字符交互体验。
- **ZMODEM 协议 (sz/rz)**：支持通过串口/蓝牙进行文件双向传输，完美适配嵌入式开发场景。
- **HEX 模式**：支持十六进制数据的发送与接收预览。
- **跨平台**：无需安装驱动（取决于系统对 Web API 的支持），在 Chrome/Edge 浏览器中即可使用。
- **现代技术栈**：基于 React 19 + TypeScript + Vite 构建，代码逻辑严谨，类型安全。

---

<a name="english"></a>
# Web Serial Assistant (English)

A browser-based debugger for Serial and Bluetooth communication, featuring TTY terminal interaction and ZMODEM file transfers.

## 🚀 Key Features

- **Web Serial Support**: Communicate directly with local serial devices. Configurable baud rate, data bits, stop bits, and parity.
- **Web Bluetooth Support**: Discover and connect to BLE devices. Built-in support for common UART services (e.g., FFE0, FFF0) and name prefix filtering.
- **Professional TTY Terminal**: Powered by Xterm.js for a real Linux-like character interaction experience.
- **ZMODEM Protocol (sz/rz)**: Bidirectional file transfers over Serial/Bluetooth, perfect for embedded development.
- **HEX Mode**: Preview and send data in hexadecimal format.
- **Cross-platform**: No drivers needed (subject to browser Web API support). Works in Chrome and Edge.
- **Modern Tech Stack**: Built with React 19, TypeScript, and Vite with strict type safety.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Terminal**: @xterm/xterm, @xterm/addon-fit
- **Protocol**: zmodem.js
- **UI Components**: Bootstrap 5 + Bootstrap Icons
- **Web APIs**: Web Serial API, Web Bluetooth API

## 📦 Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Start Dev Server**
   ```bash
   pnpm run dev
   ```

3. **Build for Production**
   ```bash
   pnpm run build
   ```

## 📖 Usage Guide

### Bluetooth Connection
- Supports both 16-bit UUIDs (e.g., `0xffe0`) and standard 128-bit UUIDs.
- When using "Name Prefix" filtering, ensure the correct Service UUID is provided to successfully discover communication characteristics.
- Includes a built-in write queue and data chunking (127 bytes/packet) to prevent `GATT operation already in progress` errors.

### File Transfer (sz/rz)
- **sz (Device -> Browser)**: Run `sz filename` on your device; the browser will automatically prompt a download.
- **rz (Browser -> Device)**: Run `rz` on your device; the browser will open a file picker and begin uploading upon selection.

## 📄 License

This project is licensed under the [MIT](LICENSE) License.

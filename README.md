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

## 🔌 协议预设 (Protocol Presets)

你可以通过向 `src/presets/` 目录添加新的 `.ts` 文件来贡献自定义协议模版。

### 如何添加新协议

1. 在 `src/presets/` 目录下创建一个新的 TypeScript 文件 (例如 `my_protocol.ts`)。
2. 按照以下结构导出协议定义：

```typescript
const pack = `
function(option) {
  const { data, utils } = option;
  // 将输入数据转换为原始字节
  return data;
}`;

const unpack = `
function(option) {
  const { data, utils } = option;
  // 将原始字节转换为逻辑对象
  return data;
}`;

const toString = `
function(option) {
  const { data, utils } = option;
  // 将逻辑对象转换为终端显示的文本
  return String(data);
}`;

export default {
  name: '我的协议名称',
  pack,
  unpack,
  toString
};
```

3. 重新打包或运行开发服务器，新协议将自动出现在“协议预设”下拉菜单中。

---

### Adding New Protocols (English)

You can contribute custom protocol templates by adding new `.ts` files to the `src/presets/` directory.

1. Create a new TypeScript file in `src/presets/` (e.g., `my_protocol.ts`).
2. Export your protocol definition using the following structure:

```typescript
const pack = `
function(option) {
  const { data, utils } = option;
  return data;
}`;

const unpack = `
function(option) {
  const { data, utils } = option;
  return data;
}`;

const toString = `
function(option) {
  const { data, utils } = option;
  return String(data);
}`;

export default {
  name: 'My Protocol Name',
  pack,
  unpack,
  toString
};
```

3. The application will automatically scan and include your new preset in the dropdown menu.

## 📄 License

This project is licensed under the [MIT](LICENSE) License.

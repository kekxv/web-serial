# Web Serial Assistant

一个基于浏览器的串口和蓝牙调试助手，支持 TTY 终端交互及 ZMODEM 文件传输。

## 🚀 核心特性

- **Web Serial 支持**：直接与本地串口设备通信，支持波特率、数据位、停止位及校验位配置。
- **Web Bluetooth 支持**：支持 BLE 设备的搜索与连接，内置常用 UART 服务支持（如 FFE0, FFF0），支持名称前缀筛选。
- **专业 TTY 终端**：集成 Xterm.js 渲染，提供类似 Linux 终端的即时字符交互体验。
- **ZMODEM 协议 (sz/rz)**：支持通过串口/蓝牙进行文件双向传输，完美适配嵌入式开发场景。
- **HEX 模式**：支持十六进制数据的发送与接收预览。
- **跨平台**：无需安装驱动（取决于系统对 Web API 的支持），在 Chrome/Edge 浏览器中即可使用。
- **现代技术栈**：基于 React 19 + TypeScript + Vite 构建，代码逻辑严谨，类型安全。

## 🛠️ 技术栈

- **Frontend**: React 19, TypeScript, Vite
- **Terminal**: @xterm/xterm, @xterm/addon-fit
- **Protocol**: zmodem.js
- **UI Component**: Bootstrap 5 + Bootstrap Icons
- **APIs**: Web Serial API, Web Bluetooth API

## 📦 快速开始

### 本地开发

1. **安装依赖**
   ```bash
   pnpm install
   ```

2. **启动开发服务器**
   ```bash
   pnpm run dev
   ```

3. **构建发布**
   ```bash
   pnpm run build
   ```

## 📖 使用指南

### 蓝牙连接
- 程序支持 16-bit UUID（如 `ffe0`）和标准 128-bit UUID。
- 使用“名称前缀”过滤时，建议同时正确填写设备的服务 UUID，以确保连接成功后能正常发现通信特征。
- 蓝牙发送已内置队列管理和分片逻辑（127 字节/包），有效防止 `GATT operation already in progress` 冲突。

### 文件传输 (sz/rz)
- **sz (设备 -> 浏览器)**：在设备端执行 `sz filename`，浏览器将自动弹出下载提示。
- **rz (浏览器 -> 设备)**：在设备端执行 `rz`，浏览器将自动弹出文件选择框，选择文件后即开始发送。

## 📄 开源协议

本项目采用 [MIT](LICENSE) 协议。
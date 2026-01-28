/// <reference types="web-bluetooth" />
/// <reference types="w3c-web-serial" />

// Global type declarations

// 为 window 对象添加自定义属性
interface Window {
  shellTerminal?: {
    write: (data: Uint8Array) => void
    clear: () => void
  }
}

// ZModem 相关类型定义
declare module 'zmodem.js' {
  export interface ZModemSession {
    type: 'send' | 'receive'
    on: (event: string, callback: (arg?: unknown) => void) => void
    start: () => void
    close: () => void
    skip: () => void
    consume: (data: Uint8Array) => void
  }

  export interface ZModemDetection {
    confirm: () => ZModemSession
  }

  export interface ZModemOffer {
    accept: () => Promise<Uint8Array[]>
    get_details: () => { name: string, size: number }
  }

  export class Sentry {
    constructor(options: {
      to_terminal: (data: number[]) => void
      sender: (data: number[]) => void
      on_detect: (detection: ZModemDetection) => void
      on_retract: () => void
    })
    consume: (data: Uint8Array) => void
  }

  export const Browser: {
    send_files: (session: ZModemSession, files: FileList | { name: string, size: number, mtime: Date, content: Uint8Array }[]) => Promise<void>
  }
}

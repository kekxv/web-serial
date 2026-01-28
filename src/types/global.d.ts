// Global type declarations for Web APIs

declare global {
  interface Navigator {
    serial: {
      requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
      getPorts(): Promise<SerialPort[]>
    }
    bluetooth: {
      requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>
    }
  }

  interface SerialPortRequestOptions {
    filters?: SerialPortFilter[]
  }

  interface SerialPortFilter {
    usbVendorId?: number
    usbProductId?: number
  }

  interface SerialPort {
    readonly readable: ReadableStream<Uint8Array> | null
    readonly writable: WritableStream<Uint8Array> | null
    open(options: SerialOptions): Promise<void>
    close(): Promise<void>
    forget(): Promise<void>
    getInfo(): SerialPortInfo
  }

  interface SerialPortInfo {
    usbVendorId?: number
    usbProductId?: number
  }

  interface SerialOptions {
    baudRate: number
    dataBits?: number
    stopBits?: number
    parity?: 'none' | 'even' | 'odd'
    bufferSize?: number
    flowControl?: 'none' | 'hardware'
  }

  interface BluetoothLEScanFilter {
    readonly services?: BluetoothServiceUUID[]
    readonly name?: string
    readonly namePrefix?: string
  }

  interface RequestDeviceOptions {
    readonly filters?: BluetoothLEScanFilter[]
    readonly optionalServices?: BluetoothServiceUUID[]
    readonly acceptAllDevices?: boolean
  }

  // 为 window 对象添加自定义属性
  interface Window {
    shellTerminal?: {
      write: (data: Uint8Array) => void
      clear: () => void
    }
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

export {}

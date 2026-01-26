// Global type declarations for Web APIs

declare global {
  interface Navigator {
    serial?: {
      requestPort(options?: any): Promise<any>
      getPorts(): Promise<any[]>
    }
    bluetooth?: {
      requestDevice(options: any): Promise<any>
    }
  }

  interface SerialPort {
    readonly readable?: ReadableStream<any>
    readonly writable: WritableStream<any>
    open(options: any): Promise<void>
    close(): Promise<void>
    forget(): Promise<void>
    getInfo(): any
  }
}

export {}

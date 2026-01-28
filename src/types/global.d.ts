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

  interface BluetoothLEScanFilter {
    readonly services?: BluetoothServiceUUID[];
    readonly name?: string;
    readonly namePrefix?: string;
    readonly manufacturerData?: any[];
    readonly serviceData?: any[];
  }

  interface RequestDeviceOptions {
    readonly filters?: BluetoothLEScanFilter[];
    readonly optionalServices?: BluetoothServiceUUID[];
    readonly acceptAllDevices?: boolean;
  }
}

declare module 'zmodem.js' {
  export const Sentry: any;
  export const Session: any;
  export const Browser: any;
}

export {}

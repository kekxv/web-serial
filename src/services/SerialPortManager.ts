export type PortDataCallback = (data: Uint8Array, direction: 'rx' | 'tx') => void
export type PortStatusCallback = (connected: boolean) => void

export interface SerialConfig {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: 'none' | 'even' | 'odd'
  bufferSize?: number
  flowControl?: 'none' | 'hardware'
}

class SerialPortManager {
  private port: any = null
  private reader: ReadableStreamDefaultReader<string> | null = null
  private writer: WritableStreamDefaultWriter<string> | null = null
  private readableStreamClosed: Promise<void> | null = null
  private writableStreamClosed: Promise<void> | null = null
  private dataCallback: PortDataCallback | null = null
  private statusCallback: PortStatusCallback | null = null
  private reading = false
  private keepReading = true

  constructor() {
    if (!('serial' in navigator)) {
      console.warn('Web Serial API is not supported in this browser')
    }
  }

  // 检查浏览器支持
  isSupported(): boolean {
    return 'serial' in navigator
  }

  // 设置数据回调
  onData(callback: PortDataCallback): void {
    this.dataCallback = callback
  }

  // 设置状态回调
  onStatusChange(callback: PortStatusCallback): void {
    this.statusCallback = callback
  }

  // 连接串口
  async connect(config: SerialConfig): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        throw new Error('Web Serial API is not supported')
      }

      if (this.port && this.port.readable) {
        await this.disconnect()
      }

      this.port = await (navigator as any).serial.requestPort()

      await this.port.open({
        baudRate: config.baudRate,
        dataBits: config.dataBits || 8,
        stopBits: config.stopBits || 1,
        parity: config.parity || 'none',
        bufferSize: config.bufferSize || 255,
        flowControl: config.flowControl || 'none',
      })

      const textEncoder = new TextEncoderStream()
      const textDecoder = new TextDecoderStream()
      this.writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable)
      this.writer = textEncoder.writable.getWriter()

      this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable)
      this.reader = textDecoder.readable.getReader()

      this.keepReading = true
      await this.startReading()

      this.statusCallback?.(true)
      return true
    } catch (error) {
      console.error('Serial connect error:', error)
      this.statusCallback?.(false)
      return false
    }
  }

  // 开始读取数据
  private async startReading(): Promise<void> {
    if (this.reading || !this.reader) return

    this.reading = true
    try {
      while (this.keepReading && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) {
          break
        }
        if (value) {
          const encoder = new TextEncoder()
          const uint8Array = encoder.encode(value)
          this.dataCallback?.(uint8Array, 'rx')
        }
      }
    } catch (error) {
      console.error('Serial read error:', error)
    } finally {
      this.reading = false
    }
  }

  // 发送数据
  async send(data: string | Uint8Array): Promise<boolean> {
    if (!this.writer) return false

    try {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data)
      await this.writer.write(text)
      
      const uint8Array = typeof data === 'string' ? new TextEncoder().encode(data) : data
      this.dataCallback?.(uint8Array, 'tx')
      return true
    } catch (error) {
      console.error('Serial send error:', error)
      return false
    }
  }

  // 断开连接
  async disconnect(): Promise<void> {
    this.keepReading = false

    if (this.reader) {
      await this.reader.cancel().catch(() => {})
      this.reader.releaseLock()
      this.reader = null
    }

    if (this.writer) {
      await this.writer.close().catch(() => {})
      this.writer = null
    }

    if (this.readableStreamClosed) {
      await this.readableStreamClosed.catch(() => {})
      this.readableStreamClosed = null
    }

    if (this.writableStreamClosed) {
      await this.writableStreamClosed.catch(() => {})
      this.writableStreamClosed = null
    }

    if (this.port) {
      await this.port.close().catch(() => {})
      this.port = null
    }

    this.statusCallback?.(false)
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.port !== null && this.port.readable !== undefined
  }

  // 清理
  async cleanup(): Promise<void> {
    await this.disconnect()
  }
}

export default new SerialPortManager()

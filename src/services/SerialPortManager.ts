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
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private dataCallback: PortDataCallback | null = null
  private statusCallback: PortStatusCallback | null = null
  private reading = false
  private keepReading = true

  /**
   * 检查浏览器是否支持 Web Serial API
   */
  isSupported(): boolean {
    return 'serial' in navigator
  }

  /**
   * 设置数据接收回调
   */
  onData(callback: PortDataCallback): void {
    this.dataCallback = callback
  }

  /**
   * 设置连接状态变更回调
   */
  onStatusChange(callback: PortStatusCallback): void {
    this.statusCallback = callback
    callback(this.isConnected())
  }

  /**
   * 连接串口
   */
  async connect(config: SerialConfig): Promise<boolean> {
    try {
      if (!this.isSupported()) throw new Error('Web Serial API is not supported')

      if (this.port) await this.disconnect()

      this.port = await navigator.serial.requestPort()

      await this.port.open({
        baudRate: config.baudRate,
        dataBits: (config.dataBits || 8) as 7 | 8,
        stopBits: (config.stopBits || 1) as 1 | 2,
        parity: config.parity || 'none',
        bufferSize: config.bufferSize || 255,
        flowControl: config.flowControl || 'none',
      })

      if (this.port.writable && this.port.readable) {
        this.writer = this.port.writable.getWriter()
        this.reader = this.port.readable.getReader()
        
        this.keepReading = true
        this.startReading()
        
        this.statusCallback?.(true)
        return true
      }
      return false
    } catch (error) {
      console.error('Serial connection failed:', error)
      this.statusCallback?.(false)
      return false
    }
  }

  /**
   * 循环读取串口数据
   */
  private async startReading(): Promise<void> {
    if (this.reading || !this.reader) return

    this.reading = true
    try {
      while (this.keepReading && this.reader) {
        const { value, done } = await this.reader.read()
        if (done) break
        if (value) {
          this.dataCallback?.(value, 'rx')
        }
      }
    } catch (error) {
      console.error('Serial read error:', error)
    } finally {
      this.reading = false
    }
  }

  /**
   * 发送数据
   */
  async send(data: string | Uint8Array): Promise<boolean> {
    if (!this.writer) return false

    try {
      const uint8Array = typeof data === 'string' ? new TextEncoder().encode(data) : data
      await this.writer.write(uint8Array)
      this.dataCallback?.(uint8Array, 'tx')
      return true
    } catch (error) {
      console.error('Serial send failed:', error)
      return false
    }
  }

  /**
   * 断开串口连接
   */
  async disconnect(): Promise<void> {
    this.keepReading = false

    if (this.reader) {
      await this.reader.cancel().catch(() => {})
      this.reader.releaseLock()
      this.reader = null
    }

    if (this.writer) {
      await this.writer.close().catch(() => {})
      this.writer.releaseLock()
      this.writer = null
    }

    if (this.port) {
      await this.port.close().catch(() => {})
      this.port = null
    }

    this.statusCallback?.(false)
  }

  /**
   * 获取当前连接状态
   */
  isConnected(): boolean {
    return this.port !== null
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.disconnect()
  }
}

export default new SerialPortManager()
export type BluetoothDataCallback = (data: Uint8Array, direction: 'rx' | 'tx') => void
export type BluetoothStatusCallback = (connected: boolean) => void

export interface BluetoothDeviceConfig {
  serviceUUID: string
  characteristicUUID: string
  optionalServices?: string[]
}

class BluetoothManager {
  private device: any = null
  private characteristic: any = null
  private dataCallback: BluetoothDataCallback | null = null
  private statusCallback: BluetoothStatusCallback | null = null

  constructor() {
    if (!('bluetooth' in navigator)) {
      console.warn('Web Bluetooth API is not supported in this browser')
    }
  }

  // 检查浏览器支持
  isSupported(): boolean {
    return 'bluetooth' in navigator
  }

  // 设置数据回调
  onData(callback: BluetoothDataCallback): void {
    this.dataCallback = callback
  }

  // 设置状态回调
  onStatusChange(callback: BluetoothStatusCallback): void {
    this.statusCallback = callback
  }

  // 连接 BLE 设备
  async connect(config: BluetoothDeviceConfig): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        throw new Error('Web Bluetooth API is not supported')
      }

      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [config.serviceUUID] }],
        optionalServices: config.optionalServices,
      })

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this))

      const server = await this.device.gatt?.connect()
      if (!server) {
        throw new Error('Failed to connect to GATT server')
      }

      const service = await server.getPrimaryService(config.serviceUUID)
      this.characteristic = await service.getCharacteristic(config.characteristicUUID)

      // 开始通知
      await this.characteristic.startNotifications()
      this.characteristic.addEventListener(
        'characteristicvaluechanged',
        this.handleDataReceived.bind(this)
      )

      this.statusCallback?.(true)
      return true
    } catch (error) {
      console.error('Bluetooth connect error:', error)
      this.statusCallback?.(false)
      return false
    }
  }

  // 处理接收到的数据
  private handleDataReceived(event: Event): void {
    const value = (event.target as any).value
    if (value) {
      const data = new Uint8Array(value.buffer)
      this.dataCallback?.(data, 'rx')
    }
  }

  // 处理断开连接
  private handleDisconnect(): void {
    console.log('Bluetooth device disconnected')
    this.statusCallback?.(false)
    this.characteristic = null
  }

  // 发送数据
  async send(data: string | Uint8Array): Promise<boolean> {
    if (!this.characteristic) return false

    try {
      const uint8Array = typeof data === 'string' ? new TextEncoder().encode(data) : data
      await this.characteristic.writeValue(uint8Array)
      this.dataCallback?.(uint8Array, 'tx')
      return true
    } catch (error) {
      console.error('Bluetooth send error:', error)
      return false
    }
  }

  // 断开连接
  async disconnect(): Promise<void> {
    if (this.characteristic) {
      try {
        await this.characteristic.stopNotifications()
        this.characteristic.removeEventListener(
          'characteristicvaluechanged',
          this.handleDataReceived.bind(this)
        )
      } catch (error) {
        console.error('Error stopping notifications:', error)
      }
      this.characteristic = null
    }

    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect.bind(this))
      this.device.gatt?.disconnect()
      this.device = null
    }

    this.statusCallback?.(false)
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.device !== null && this.device.gatt?.connected
  }

  // 清理
  async cleanup(): Promise<void> {
    await this.disconnect()
  }
}

export default new BluetoothManager()

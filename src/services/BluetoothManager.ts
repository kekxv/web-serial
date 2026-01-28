export type BluetoothDataCallback = (data: Uint8Array, direction: 'rx' | 'tx') => void
export type BluetoothStatusCallback = (connected: boolean) => void

export interface BluetoothDeviceConfig {
  serviceUUID?: string | number
  characteristicUUID?: string | number
  optionalServices?: (string | number)[]
  acceptAllDevices?: boolean
  namePrefix?: string
}

class BluetoothManager {
  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private dataCallback: BluetoothDataCallback | null = null
  private statusCallback: BluetoothStatusCallback | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  /**
   * 检查浏览器是否支持 Web Bluetooth API
   */
  isSupported(): boolean {
    return 'bluetooth' in navigator
  }

  /**
   * 设置数据接收回调
   */
  onData(callback: BluetoothDataCallback): void {
    this.dataCallback = callback
  }

  /**
   * 设置连接状态变更回调
   */
  onStatusChange(callback: BluetoothStatusCallback): void {
    this.statusCallback = callback
    callback(this.isConnected())
  }

  /**
   * 解析 UUID 为 Web Bluetooth 接受的格式
   */
  private parseUUID(uuid: string | number): string | number {
    if (typeof uuid === 'number') return uuid
    if (!uuid) return ''
    const clean = uuid.toString().toLowerCase().trim()
    if (clean.startsWith('0x')) return parseInt(clean, 16)
    if (/^[0-9a-f]{1,4}$/.test(clean)) return parseInt(clean, 16)
    return clean
  }

  /**
   * 连接蓝牙设备
   */
  async connect(config: BluetoothDeviceConfig): Promise<boolean> {
    try {
      if (!this.isSupported()) throw new Error('Web Bluetooth API is not supported')

      const sUUID = this.parseUUID(config.serviceUUID || '')
      const cUUID = this.parseUUID(config.characteristicUUID || '')

      const options: RequestDeviceOptions = {
        optionalServices: []
      }

      // 配置扫描过滤选项
      if (config.namePrefix) {
        options.filters = [{ namePrefix: config.namePrefix }]
        if (sUUID) options.optionalServices?.push(sUUID as BluetoothServiceUUID)
      } else if (config.acceptAllDevices) {
        options.acceptAllDevices = true
        if (sUUID) options.optionalServices?.push(sUUID as BluetoothServiceUUID)
      } else if (sUUID) {
        options.filters = [{ services: [sUUID as BluetoothServiceUUID] }]
      }

      // 合并额外的可选服务
      if (config.optionalServices) {
        config.optionalServices.forEach(s => {
          const p = this.parseUUID(s)
          if (!options.optionalServices?.includes(p as BluetoothServiceUUID)) {
            options.optionalServices?.push(p as BluetoothServiceUUID)
          }
        })
      }

      console.log('Requesting Bluetooth device...', options)
      this.device = await navigator.bluetooth.requestDevice(options)
      
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this))

      console.log('Connecting to GATT server...')
      const server = await this.device.gatt?.connect()
      if (!server) throw new Error('Failed to connect to GATT server')

      console.log('Accessing service:', sUUID)
      const service = await server.getPrimaryService(sUUID as BluetoothServiceUUID)

      console.log('Accessing characteristic:', cUUID)
      this.characteristic = await service.getCharacteristic(cUUID as BluetoothCharacteristicUUID)

      // 开启通知订阅
      await this.characteristic.startNotifications()
      this.characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
        const char = event.target as BluetoothRemoteGATTCharacteristic
        if (char.value) {
          this.dataCallback?.(new Uint8Array(char.value.buffer), 'rx')
        }
      })

      this.statusCallback?.(true)
      return true
    } catch (error) {
      console.error('Bluetooth connection failed:', error)
      this.statusCallback?.(false)
      return false
    }
  }

  /**
   * 处理意外断开连接
   */
  private handleDisconnect(): void {
    console.log('Bluetooth device disconnected')
    this.statusCallback?.(false)
    this.characteristic = null
    this.device = null
    this.writeQueue = Promise.resolve()
  }

  /**
   * 发送数据 (带分片和队列管理)
   */
  async send(data: string | Uint8Array): Promise<boolean> {
    if (!this.characteristic) return false

    const value = typeof data === 'string' ? new TextEncoder().encode(data) : data

    this.writeQueue = this.writeQueue.then(async () => {
      try {
        if (!this.characteristic) return
        // BLE MTU 限制分片发送 (127 字节每包)
        for (let i = 0; i < value.length; i += 127) {
          const end = Math.min(value.length, i + 127)
          await this.characteristic.writeValue(value.subarray(i, end))
        }
        this.dataCallback?.(value, 'tx')
      } catch (error) {
        console.error('Bluetooth send failed:', error)
      }
    })

    await this.writeQueue
    return true
  }

  /**
   * 主动断开连接
   */
  async disconnect(): Promise<void> {
    if (this.characteristic) {
      try {
        await this.characteristic.stopNotifications()
      } catch { /* ignore */ }
      this.characteristic = null
    }

    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect()
    }

    this.device = null
    this.writeQueue = Promise.resolve()
    this.statusCallback?.(false)
  }

  /**
   * 获取当前连接状态
   */
  isConnected(): boolean {
    return this.device?.gatt?.connected || false
  }

  /**
   * 组件卸载时的清理
   */
  async cleanup(): Promise<void> {
    await this.disconnect()
  }
}

export default new BluetoothManager()

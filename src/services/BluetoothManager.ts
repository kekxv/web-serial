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
    callback(this.isConnected())
  }

  // 解析 UUID (支持数字或字符串)
  private parseUUID(uuid: string | number): string | number {
    if (typeof uuid === 'number') return uuid
    if (!uuid) return ''
    const clean = uuid.toString().toLowerCase().trim()
    if (clean.startsWith('0x')) return parseInt(clean, 16)
    // 如果是 4位以内的 16 进制字符串，视为 16位 UUID 数字
    if (/^[0-9a-f]{1,4}$/.test(clean)) return parseInt(clean, 16)
    return clean
  }

  // 连接 BLE 设备
  async connect(config: BluetoothDeviceConfig): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        throw new Error('Web Bluetooth API is not supported')
      }

      const sUUID = this.parseUUID(config.serviceUUID || '')
      const cUUID = this.parseUUID(config.characteristicUUID || '')

      // 1. 扫描/请求设备 (参考 search 代码)
      let options: any = {
        optionalServices: []
      }

      if (config.namePrefix) {
        options.filters = [{ namePrefix: config.namePrefix }]
        if (sUUID) options.optionalServices.push(sUUID)
      } else if (config.acceptAllDevices) {
        options.acceptAllDevices = true
        if (sUUID) options.optionalServices.push(sUUID)
      } else if (sUUID) {
        options.filters = [{ services: [sUUID] }]
      }

      if (config.optionalServices) {
        config.optionalServices.forEach(s => {
          const p = this.parseUUID(s)
          if (!options.optionalServices.includes(p)) options.optionalServices.push(p)
        })
      }

      console.log('Requesting Bluetooth device with options:', options)
      this.device = await navigator.bluetooth.requestDevice(options)
      
      // 2. 连接设备 (参考 connect 代码)
      console.log('Connecting to GATT server...')
      const server = await this.device.gatt?.connect()
      if (!server) throw new Error('Failed to connect to GATT server')

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnect()
      })

      console.log('Getting primary service:', sUUID)
      const service = await server.getPrimaryService(sUUID)

      console.log('Getting characteristic:', cUUID)
      this.characteristic = await service.getCharacteristic(cUUID)

      // 3. 订阅通知
      await this.characteristic.startNotifications()
      this.characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value
        if (value) {
          this.dataCallback?.(new Uint8Array(value.buffer), 'rx')
        }
      })

      this.statusCallback?.(true)
      return true
    } catch (error) {
      console.error('Bluetooth connect error:', error)
      this.statusCallback?.(false)
      return false
    }
  }

  // 处理断开连接
  private handleDisconnect(): void {
    console.log('Bluetooth device disconnected')
    this.statusCallback?.(false)
    this.characteristic = null
    this.device = null
    this.writeQueue = Promise.resolve()
  }

  // 发送数据 (带队列管理和分片)
  async send(data: string | Uint8Array): Promise<boolean> {
    if (!this.characteristic) return false

    const value = typeof data === 'string' ? new TextEncoder().encode(data) : data

    // 将新的写入请求排入队列
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        if (!this.characteristic) return

        // 按照参考代码逻辑进行分片发送 (每片 127 字节)
        for (let i = 0; i < value.length; i += 127) {
          let end = Math.min(value.length, i + 127)
          if (end === i) break

          const chunk = value.subarray(i, end)
          await this.characteristic.writeValue(chunk)
        }
        
        this.dataCallback?.(value, 'tx')
      } catch (error) {
        console.error('Bluetooth send error:', error)
      }
    })

    await this.writeQueue
    return true
  }

  // 断开连接
  async disconnect(): Promise<void> {
    if (this.characteristic) {
      try {
        await this.characteristic.stopNotifications()
      } catch (error) {
        console.error('Error stopping notifications:', error)
      }
      this.characteristic = null
    }

    if (this.device) {
      this.device.gatt?.disconnect()
      this.device = null
    }

    this.writeQueue = Promise.resolve()
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

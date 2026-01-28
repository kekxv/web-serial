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

  isSupported(): boolean {
    return 'bluetooth' in navigator
  }

  onData(callback: BluetoothDataCallback): void {
    this.dataCallback = callback
  }

  onStatusChange(callback: BluetoothStatusCallback): void {
    this.statusCallback = callback
    callback(this.isConnected())
  }

  private parseUUID(uuid: string | number): string | number {
    if (typeof uuid === 'number') return uuid
    if (!uuid) return ''
    const clean = uuid.toString().toLowerCase().trim()
    if (clean.startsWith('0x')) return parseInt(clean, 16)
    if (/^[0-9a-f]{1,4}$/.test(clean)) return parseInt(clean, 16)
    return clean
  }

  async connect(config: BluetoothDeviceConfig): Promise<boolean> {
    try {
      if (!this.isSupported()) throw new Error('Web Bluetooth API is not supported')

      const sUUID = this.parseUUID(config.serviceUUID || '') as BluetoothServiceUUID
      const cUUID = this.parseUUID(config.characteristicUUID || '') as BluetoothCharacteristicUUID

      // 构造可选服务列表
      const optServices: BluetoothServiceUUID[] = []
      if (sUUID) optServices.push(sUUID)
      if (config.optionalServices) {
        config.optionalServices.forEach(s => {
          const p = this.parseUUID(s) as BluetoothServiceUUID
          if (!optServices.includes(p)) optServices.push(p)
        })
      }

      // 严格按照接口要求初始化 options 对象
      let options: RequestDeviceOptions
      if (config.namePrefix) {
        options = {
          filters: [{ namePrefix: config.namePrefix }],
          optionalServices: optServices
        }
      } else if (config.acceptAllDevices) {
        options = {
          acceptAllDevices: true,
          optionalServices: optServices
        }
      } else if (sUUID) {
        options = {
          filters: [{ services: [sUUID] }],
          optionalServices: optServices
        }
      } else {
        options = {
          acceptAllDevices: true,
          optionalServices: optServices
        }
      }

      console.log('Requesting Bluetooth device...', options)
      this.device = await navigator.bluetooth.requestDevice(options)
      
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this))

      console.log('Connecting to GATT server...')
      const server = await this.device.gatt?.connect()
      if (!server) throw new Error('Failed to connect to GATT server')

      console.log('Accessing service:', sUUID)
      const service = await server.getPrimaryService(sUUID)

      console.log('Accessing characteristic:', cUUID)
      this.characteristic = await service.getCharacteristic(cUUID)

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

  private handleDisconnect(): void {
    console.log('Bluetooth device disconnected')
    this.statusCallback?.(false)
    this.characteristic = null
    this.device = null
    this.writeQueue = Promise.resolve()
  }

  async send(data: string | Uint8Array): Promise<boolean> {
    if (!this.characteristic) return false
    const value = typeof data === 'string' ? new TextEncoder().encode(data) : data
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        if (!this.characteristic) return
        for (let i = 0; i < value.length; i += 127) {
          const end = Math.min(value.length, i + 127)
          // 显式转换为 Uint8Array 以避免 SharedArrayBuffer 引起的 BufferSource 冲突
          const chunk = new Uint8Array(value.buffer, value.byteOffset + i, end - i)
          // @ts-expect-error: BufferSource and SharedArrayBuffer incompatibility in some environments
          await this.characteristic.writeValue(chunk)
        }
        this.dataCallback?.(value, 'tx')
      } catch (error) {
        console.error('Bluetooth send failed:', error)
      }
    })
    await this.writeQueue
    return true
  }

  async disconnect(): Promise<void> {
    if (this.characteristic) {
      try { await this.characteristic.stopNotifications() } catch { /* ignore */ }
      this.characteristic = null
    }
    if (this.device?.gatt?.connected) this.device.gatt.disconnect()
    this.device = null
    this.writeQueue = Promise.resolve()
    this.statusCallback?.(false)
  }

  isConnected(): boolean {
    return this.device?.gatt?.connected || false
  }

  async cleanup(): Promise<void> {
    await this.disconnect()
  }
}

export default new BluetoothManager()
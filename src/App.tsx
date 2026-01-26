import { useState, useEffect } from 'react'
import SerialPortManager from './services/SerialPortManager'
import BluetoothManager from './services/BluetoothManager'
import Terminal, { type TerminalMessage } from './components/Terminal'
import ShellTerminal from './components/ShellTerminal'
import './App.css'

type ConnectionType = 'serial' | 'bluetooth' | 'none'

interface SerialConfig {
  baudRate: number
  dataBits: number
  stopBits: number
  parity: 'none' | 'even' | 'odd'
}

interface BluetoothConfig {
  serviceUUID: string
  characteristicUUID: string
}

function App() {
  const [connectionType, setConnectionType] = useState<ConnectionType>('none')
  const [connected, setConnected] = useState(false)
  const [hexMode, setHexMode] = useState(false)
  const [shellMode, setShellMode] = useState(false)
  const [messages, setMessages] = useState<TerminalMessage[]>([])
  const [sendData, setSendData] = useState('')

  // 串口配置
  const [serialConfig, setSerialConfig] = useState<SerialConfig>({
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
  })

  // 蓝牙配置
  const [bluetoothConfig, setBluetoothConfig] = useState<BluetoothConfig>({
    serviceUUID: '0000ffe0-0000-1000-8000-00805f9b34fb', // 典型 BLE UART 服务
    characteristicUUID: '0000ffe1-0000-1000-8000-00805f9b34fb', // 典型 BLE UART 特征
  })

  useEffect(() => {
    // 设置串口数据回调
    SerialPortManager.onData((data, direction) => {
      const text = new TextDecoder().decode(data)
      addMessage(text, direction)

      // Shell 模式下添加到终端
      if ((window as any).shellTerminal) {
        if (direction === 'rx') {
          (window as any).shellTerminal.addOutputLine(hexMode ?
            Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase() :
            text)
        }
      }
    })

    SerialPortManager.onStatusChange(setConnected)

    // 设置蓝牙数据回调
    BluetoothManager.onData((data, direction) => {
      const text = new TextDecoder().decode(data)
      addMessage(text, direction)

      // Shell 模式下添加到终端
      if ((window as any).shellTerminal) {
        if (direction === 'rx') {
          (window as any).shellTerminal.addOutputLine(hexMode ?
            Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase() :
            text)
        }
      }
    })

    BluetoothManager.onStatusChange(setConnected)
  }, [hexMode])

  const addMessage = (data: string, direction: 'rx' | 'tx') => {
    const newMessage: TerminalMessage = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      data,
      direction,
    }
    setMessages((prev) => [...prev, newMessage])
  }

  const connectSerial = async () => {
    setConnectionType('serial')
    const success = await SerialPortManager.connect(serialConfig)
    if (!success) {
      setConnectionType('none')
      alert('连接串口失败')
    }
  }

  const connectBluetooth = async () => {
    if (!BluetoothManager.isSupported()) {
      alert('当前浏览器不支持 Web Bluetooth API')
      return
    }
    setConnectionType('bluetooth')
    const success = await BluetoothManager.connect(bluetoothConfig)
    if (!success) {
      setConnectionType('none')
      alert('连接蓝牙设备失败')
    }
  }

  const disconnect = async () => {
    if (connectionType === 'serial') {
      await SerialPortManager.disconnect()
    } else if (connectionType === 'bluetooth') {
      await BluetoothManager.disconnect()
    }
    setConnectionType('none')
    setConnected(false)
  }

  const handleSend = async () => {
    if (!sendData.trim()) return

    let dataToSend: string | Uint8Array = sendData.trim()

    if (hexMode) {
      // HEX 模式：转换 hex 字符串为 Uint8Array
      const cleanHex = sendData.trim().replace(/\s+/g, '')
      const hexRegex = /^[0-9A-Fa-f]{2,}$/
      if (!hexRegex.test(cleanHex)) {
        alert('请输入有效的 HEX 格式（例如：01 02 03 FF）')
        return
      }
      const length = (cleanHex.length / 2) | 0
      const result = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        result[i] = parseInt(cleanHex.substr(i * 2, 2), 16)
      }
      dataToSend = result
    }

    let success = false
    if (connectionType === 'serial') {
      success = await SerialPortManager.send(dataToSend)
    } else if (connectionType === 'bluetooth') {
      success = await BluetoothManager.send(dataToSend)
    }

    if (!success) {
      alert('发送数据失败')
    } else {
      setSendData('')
    }
  }

  const handleShellCommand = async (command: string) => {
    if (!command.trim()) return

    const data = hexMode ?
      // HEX 模式：命令的 HEX 表示
      command.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ') :
      command + '\n'

    let success = false
    if (connectionType === 'serial') {
      success = await SerialPortManager.send(hexMode ? data : command + '\n')
    } else if (connectionType === 'bluetooth') {
      success = await BluetoothManager.send(hexMode ? data : command + '\n')
    }

    if (!success) {
      alert('发送命令失败')
    }
  }

  const handleClear = () => {
    setMessages([])
  }

  const handleCopy = () => {
    const text = messages.map(m => `[${m.timestamp}] ${m.direction.toUpperCase()}: ${m.data}`).join('\n')
    navigator.clipboard.writeText(text)
    alert('已复制到剪贴板')
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <i className="bi bi-cpu"></i>
          <h1 className="mb-0">Web Serial Assistant</h1>
        </div>
        <div className="header-info">
          <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '已连接' : '未连接'}
          </span>
        </div>
      </header>

      <main className="app-main">
        {/* 左侧控制面板 */}
        <aside className="control-panel">
          <div className="panel-section">
            <div className="section-title">
              <i className="bi bi-link-45deg"></i> 连接类型
            </div>
            <div className="btn-group w-100" role="group">
              <button
                className={`btn ${connectionType === 'serial' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={connectSerial}
                disabled={connected && connectionType !== 'serial'}
              >
                <i className="bi bi-usb"></i> 串口
              </button>
              <button
                className={`btn ${connectionType === 'bluetooth' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={connectBluetooth}
                disabled={connected && connectionType !== 'bluetooth'}
              >
                <i className="bi bi-bluetooth"></i> BLE
              </button>
            </div>
          </div>

          {connectionType === 'serial' && (
            <div className="panel-section">
              <div className="section-title">
                <i className="bi bi-gear"></i> 串口配置
              </div>
              <div className="form-group mb-3">
                <label>波特率</label>
                <select
                  className="form-select"
                  value={serialConfig.baudRate}
                  onChange={(e) => setSerialConfig({ ...serialConfig, baudRate: Number(e.target.value) })}
                >
                  {[
                    1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600,
                    115200, 230400, 460800, 921600
                  ].map(rate => (
                    <option key={rate} value={rate}>{rate}</option>
                  ))}
                </select>
              </div>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label>数据位</label>
                  <select
                    className="form-select"
                    value={serialConfig.dataBits}
                    onChange={(e) => setSerialConfig({ ...serialConfig, dataBits: Number(e.target.value) })}
                  >
                    {[7, 8].map(bits => (
                      <option key={bits} value={bits}>{bits}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label>停止位</label>
                  <select
                    className="form-select"
                    value={serialConfig.stopBits}
                    onChange={(e) => setSerialConfig({ ...serialConfig, stopBits: Number(e.target.value) })}
                  >
                    {[1, 2].map(bits => (
                      <option key={bits} value={bits}>{bits}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group mb-3">
                <label>校验位</label>
                <select
                  className="form-select"
                  value={serialConfig.parity}
                  onChange={(e) => setSerialConfig({ ...serialConfig, parity: e.target.value as any })}
                >
                  <option value="none">None</option>
                  <option value="even">Even</option>
                  <option value="odd">Odd</option>
                </select>
              </div>
            </div>
          )}

          {connectionType === 'bluetooth' && (
            <div className="panel-section">
              <div className="section-title">
                <i className="bi bi-bluetooth"></i> BLE 配置
              </div>
              <div className="form-group mb-3">
                <label>服务 UUID</label>
                <input
                  type="text"
                  className="form-control"
                  value={bluetoothConfig.serviceUUID}
                  onChange={(e) => setBluetoothConfig({ ...bluetoothConfig, serviceUUID: e.target.value })}
                  placeholder="例如: 0000ffe0-0000-1000-8000-00805f9b34fb"
                />
              </div>
              <div className="form-group mb-3">
                <label>特征 UUID</label>
                <input
                  type="text"
                  className="form-control"
                  value={bluetoothConfig.characteristicUUID}
                  onChange={(e) => setBluetoothConfig({ ...bluetoothConfig, characteristicUUID: e.target.value })}
                  placeholder="例如: 0000ffe1-0000-1000-8000-00805f9b34fb"
                />
              </div>
            </div>
          )}

          <div className="panel-section">
            <div className="section-title">
              <i className="bi bi-sliders"></i> 显示设置
            </div>
            <div className="form-check mb-2">
              <input
                type="checkbox"
                className="form-check-input"
                id="hexMode"
                checked={hexMode}
                onChange={(e) => setHexMode(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="hexMode">
                HEX 模式
              </label>
            </div>
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="shellMode"
                checked={shellMode}
                onChange={(e) => setShellMode(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="shellMode">
                Shell 模式
              </label>
            </div>
          </div>

          {!shellMode && (
            <div className="panel-section">
              <div className="section-title">
                <i className="bi bi-send"></i> 发送数据
              </div>
              <div className="form-group mb-2">
                <textarea
                  className="form-control send-area"
                  value={sendData}
                  onChange={(e) => setSendData(e.target.value)}
                  placeholder={hexMode ? '输入 HEX 数据 (例: 01 02 03 FF)' : '输入文本数据'}
                  rows={4}
                />
              </div>
              <button
                className="btn btn-primary w-100"
                onClick={handleSend}
                disabled={!connected}
              >
                <i className="bi bi-send"></i> 发送
              </button>
            </div>
          )}

          {connected && (
            <div className="panel-section">
              <button
                className="btn btn-danger w-100"
                onClick={disconnect}
              >
                <i className="bi bi-x-circle"></i> 断开连接
              </button>
            </div>
          )}
        </aside>

        {/* 右侧终端显示区域 */}
        <section className="terminal-panel">
          {shellMode ? (
            <ShellTerminal
              connected={connected}
              hexMode={hexMode}
              onCommand={handleShellCommand}
              onClear={handleClear}
            />
          ) : (
            <Terminal
              messages={messages}
              hexMode={hexMode}
              onClear={handleClear}
              onCopy={handleCopy}
              autoScroll={true}
            />
          )}
        </section>
      </main>

      <footer className="app-footer">
        <small className="text-muted">
          Web Serial Assistant v1.0 | 支持 Web Serial & Web Bluetooth
        </small>
      </footer>
    </div>
  )
}

export default App

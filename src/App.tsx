import { useState, useEffect } from 'react'
import SerialPortManager from './services/SerialPortManager'
import BluetoothManager from './services/BluetoothManager'
import Terminal, { type TerminalMessage } from './components/Terminal'
import ShellTerminal from './components/ShellTerminal'
import CommandPanel from './components/CommandPanel'
import { translations, type Language } from './locales/translations'
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
  namePrefix: string
  filterType: 'service' | 'name' | 'all'
}

function App() {
  // 1. 状态定义
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang')
    return (saved as Language) || (navigator.language.startsWith('zh') ? 'zh' : 'en')
  })
  
  const t = translations[lang]

  const [connectionType, setConnectionType] = useState<ConnectionType>('none')
  const [connected, setConnected] = useState(false)
  const [hexMode, setHexMode] = useState(false)
  const [shellMode, setShellMode] = useState(false)
  const [encoding, setEncoding] = useState<'utf-8' | 'gbk'>('utf-8')
  const [darkMode, setDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  const [messages, setMessages] = useState<TerminalMessage[]>([])
  const [sendData, setSendData] = useState('')

  const [serialConfig, setSerialConfig] = useState<SerialConfig>({
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
  })

  const [bluetoothConfig, setBluetoothConfig] = useState<BluetoothConfig>({
    serviceUUID: '0xfff0', 
    characteristicUUID: '0xfff1',
    namePrefix: 'KT',
    filterType: 'name'
  })

  // 2. 副作用处理
  useEffect(() => {
    localStorage.setItem('app_lang', lang)
  }, [lang])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('dark-theme', darkMode)
    document.body.classList.toggle('light-theme', !darkMode)
  }, [darkMode])

  // 3. 回调函数
  const addMessage = (data: string, direction: 'rx' | 'tx') => {
    const newMessage: TerminalMessage = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      data,
      direction,
    }
    setMessages((prev) => [...prev, newMessage])
  }

  const handleClear = () => {
    setMessages([])
    if (window.shellTerminal) {
      window.shellTerminal.clear()
    }
  }

  useEffect(() => {
    SerialPortManager.onData((data, direction) => {
      if (connectionType !== 'serial') return
      const decoder = new TextDecoder(encoding)
      const text = decoder.decode(data)
      addMessage(text, direction)
      if (window.shellTerminal && direction === 'rx') window.shellTerminal.write(data)
    })

    SerialPortManager.onStatusChange((status) => {
      if (connectionType === 'serial') setConnected(status)
    })

    BluetoothManager.onData((data, direction) => {
      if (connectionType !== 'bluetooth') return
      const decoder = new TextDecoder(encoding)
      const text = decoder.decode(data)
      addMessage(text, direction)
      if (window.shellTerminal && direction === 'rx') window.shellTerminal.write(data)
    })

    BluetoothManager.onStatusChange((status) => {
      if (connectionType === 'bluetooth') setConnected(status)
    })
  }, [encoding, connectionType])

  // 4. 业务逻辑
  const connectSerial = async () => {
    if (!SerialPortManager.isSupported()) {
      alert(t.notSupportedSerial)
      return
    }
    const success = await SerialPortManager.connect(serialConfig)
    if (success) setConnectionType('serial')
    else alert(t.connectSerialFail)
  }

  const connectBluetooth = async () => {
    if (!BluetoothManager.isSupported()) {
      alert(t.notSupportedBLE)
      return
    }
    const config = {
      serviceUUID: bluetoothConfig.serviceUUID,
      characteristicUUID: bluetoothConfig.characteristicUUID,
      namePrefix: bluetoothConfig.filterType === 'name' ? bluetoothConfig.namePrefix : undefined,
      acceptAllDevices: bluetoothConfig.filterType === 'all'
    }
    const success = await BluetoothManager.connect(config)
    if (success) setConnectionType('bluetooth')
    else alert(t.connectBLEFail)
  }

  const disconnect = async () => {
    if (connectionType === 'serial') await SerialPortManager.disconnect()
    else if (connectionType === 'bluetooth') await BluetoothManager.disconnect()
    setConnectionType('none')
    setConnected(false)
  }

  const handleSend = async (customData?: string, customType?: 'text' | 'hex') => {
    const rawData = customData !== undefined ? customData : sendData
    if (!rawData.trim()) return
    
    // 决定是否使用 HEX 模式 (如果 customType 存在则优先使用)
    const isHex = customType ? (customType === 'hex') : hexMode

    let dataToSend: string | Uint8Array = rawData
    if (isHex) {
      // 兼容 0x 前缀，移除空格和 0x
      const cleanHex = rawData.replace(/\s+/g, '').replace(/0x/gi, '')
      if (!/^[0-9A-Fa-f]{2,}$/.test(cleanHex)) {
        alert(t.inputHex)
        return
      }
      const length = (cleanHex.length / 2) | 0
      const result = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        result[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16)
      }
      dataToSend = result
    }

    const success = connectionType === 'serial' 
      ? await SerialPortManager.send(dataToSend) 
      : await BluetoothManager.send(dataToSend)

    if (!success) {
      alert(t.sendFail)
    } else if (customData === undefined) {
      setSendData('')
    }
  }

  const handleShellData = async (data: Uint8Array) => {
    const success = connectionType === 'serial' ? await SerialPortManager.send(data) : await BluetoothManager.send(data)
    if (!success) console.error('Failed to send data to TTY')
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <i className="bi bi-cpu"></i>
          <h1 className="mb-0">{t.title}</h1>
        </div>
        <div className="header-info">
          <div className="btn-group btn-group-sm me-3">
            <button className={`btn btn-outline-secondary ${lang === 'zh' ? 'active' : ''}`} onClick={() => setLang('zh')}>中</button>
            <button className={`btn btn-outline-secondary ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
          </div>
          <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? t.connected : t.disconnected}
          </span>
        </div>
      </header>

      <main className="app-main">
        <aside className="control-panel">
          <div className="panel-section">
            <div className="section-title"><i className="bi bi-link-45deg"></i> {t.connectionType}</div>
            <div className="btn-group w-100">
              <button className={`btn ${connectionType === 'serial' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => !connected && setConnectionType('serial')} disabled={connected}>{t.serial}</button>
              <button className={`btn ${connectionType === 'bluetooth' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => !connected && setConnectionType('bluetooth')} disabled={connected}>{t.ble}</button>
            </div>
          </div>

          {connectionType === 'serial' && (
            <div className="panel-section">
              <div className="section-title"><i className="bi bi-gear"></i> {t.serialConfig}</div>
              <div className="form-group mb-3"><label>{t.baudRate}</label>
                <select className="form-select" value={serialConfig.baudRate} onChange={(e) => setSerialConfig({ ...serialConfig, baudRate: Number(e.target.value) }) }>
                  {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="row g-2 mb-3">
                <div className="col-6"><label>{t.dataBits}</label><select className="form-select" value={serialConfig.dataBits} onChange={(e) => setSerialConfig({ ...serialConfig, dataBits: Number(e.target.value) })}>{[7, 8].map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                <div className="col-6"><label>{t.stopBits}</label><select className="form-select" value={serialConfig.stopBits} onChange={(e) => setSerialConfig({ ...serialConfig, stopBits: Number(e.target.value) })}>{[1, 2].map(b => <option key={b} value={b}>{b}</option>)}</select></div>
              </div>
              <div className="form-group mb-3"><label>{t.parity}</label>
                <select className="form-select" value={serialConfig.parity} onChange={(e) => setSerialConfig({ ...serialConfig, parity: e.target.value as 'none' | 'even' | 'odd' }) }>
                  <option value="none">None</option><option value="even">Even</option><option value="odd">Odd</option>
                </select>
              </div>
              {!connected && <button className="btn btn-success w-100" onClick={connectSerial}><i className="bi bi-plug"></i> {t.openSerial}</button>}
            </div>
          )}

          {connectionType === 'bluetooth' && (
            <div className="panel-section">
              <div className="section-title"><i className="bi bi-bluetooth"></i> {t.bleConfig}</div>
              <div className="form-group mb-3"><label>{t.filterType}</label>
                <select className="form-select" value={bluetoothConfig.filterType} onChange={(e) => setBluetoothConfig({ ...bluetoothConfig, filterType: e.target.value as 'service' | 'name' | 'all' }) }>
                  <option value="name">{t.byName}</option><option value="service">{t.byService}</option><option value="all">{t.showAll}</option>
                </select>
              </div>
              {bluetoothConfig.filterType === 'name' && (
                <div className="form-group mb-3"><label>{t.namePrefix}</label><input type="text" className="form-control" value={bluetoothConfig.namePrefix} onChange={(e) => setBluetoothConfig({ ...bluetoothConfig, namePrefix: e.target.value })} /></div>
              )}
              <div className="form-group mb-3"><label>{t.serviceUUID}</label><input type="text" className="form-control" value={bluetoothConfig.serviceUUID} onChange={(e) => setBluetoothConfig({ ...bluetoothConfig, serviceUUID: e.target.value })} /></div>
              <div className="form-group mb-3"><label>{t.charUUID}</label><input type="text" className="form-control" value={bluetoothConfig.characteristicUUID} onChange={(e) => setBluetoothConfig({ ...bluetoothConfig, characteristicUUID: e.target.value })} /></div>
              {!connected && <button className="btn btn-success w-100" onClick={connectBluetooth}><i className="bi bi-search"></i> {t.searchConnect}</button>}
            </div>
          )}

          <div className="panel-section">
            <div className="section-title"><i className="bi bi-sliders"></i> {t.displaySettings}</div>
            <div className="form-check mb-2"><input type="checkbox" className="form-check-input" id="hexMode" checked={hexMode} onChange={(e) => setHexMode(e.target.checked)} /><label className="form-check-label" htmlFor="hexMode">{t.hexMode}</label></div>
            <div className="form-check mb-2"><input type="checkbox" className="form-check-input" id="shellMode" checked={shellMode} onChange={(e) => setShellMode(e.target.checked)} /><label className="form-check-label" htmlFor="shellMode">{t.shellMode}</label></div>
            <div className="form-group mb-2"><label>{t.encoding}</label><select className="form-select" value={encoding} onChange={(e) => setEncoding(e.target.value as 'utf-8' | 'gbk')}><option value="utf-8">UTF-8</option><option value="gbk">GBK</option></select></div>
            <div className="form-check"><input type="checkbox" className="form-check-input" id="darkMode" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} /><label className="form-check-label" htmlFor="darkMode">{t.darkMode} ({darkMode ? t.auto : t.light})</label></div>
          </div>

          {!shellMode && (
            <div className="panel-section">
              <div className="section-title"><i className="bi bi-send"></i> {t.sendData}</div>
              <div className="form-group mb-2"><textarea className="form-control send-area" value={sendData} onChange={(e) => setSendData(e.target.value)} placeholder={hexMode ? t.inputHex : t.inputText} rows={4} /></div>
              <button className="btn btn-primary w-100" onClick={() => handleSend()} disabled={!connected}><i className="bi bi-send"></i> {t.send}</button>
            </div>
          )}

          {connected && <div className="panel-section"><button className="btn btn-danger w-100" onClick={disconnect}><i className="bi bi-x-circle"></i> {t.disconnect}</button></div>}
        </aside>

        <section className="terminal-panel">
          <div className="main-content-row h-100 d-flex">
            <div className="flex-grow-1 h-100 overflow-hidden">
              {shellMode ? (
                <ShellTerminal connected={connected} onData={handleShellData} onClear={handleClear} lang={lang} />
              ) : (
                <Terminal 
                  messages={messages} 
                  hexMode={hexMode} 
                  onClear={handleClear} 
                  onCopy={() => { 
                    const text = messages.map(m => `[${m.timestamp}] ${m.direction.toUpperCase()}: ${m.data}`).join('\n'); 
                    navigator.clipboard.writeText(text); 
                    alert(t.copied); 
                  }} 
                  autoScroll={true} 
                  lang={lang} 
                />
              )}
            </div>
            {!shellMode && (
              <CommandPanel onSend={(content, type) => handleSend(content, type)} lang={lang} connected={connected} />
            )}
          </div>
        </section>
      </main>
      <footer className="app-footer"><small className="text-muted">Web Serial Assistant v1.0 | Web Serial & Web Bluetooth</small></footer>
    </div>
  )
}

export default App
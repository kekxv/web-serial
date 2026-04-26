import {useState, useEffect, useRef, useCallback} from 'react'
import SerialPortManager from './services/SerialPortManager'
import BluetoothManager from './services/BluetoothManager'
import Terminal, {type TerminalMessage} from './components/Terminal'
import ShellTerminal from './components/ShellTerminal'
import CommandPanel from './components/CommandPanel'
import * as FormatUtils from './utils/FormatUtils'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'
import {translations, type Language} from './locales/translations'
import {PROTOCOL_PRESETS} from './presets'
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

  const [connectionType, setConnectionType] = useState<ConnectionType>(() =>
    (localStorage.getItem('app_connection_type') as ConnectionType) || 'none'
  )
  const [connected, setConnected] = useState(false)
  const [hexMode, setHexMode] = useState(() => localStorage.getItem('app_hex_mode') === 'true')
  const [shellMode, setShellMode] = useState(() => localStorage.getItem('app_shell_mode') === 'true')
  const [encoding, setEncoding] = useState<'utf-8' | 'gbk'>(() =>
    (localStorage.getItem('app_encoding') as 'utf-8' | 'gbk') || 'utf-8'
  )
  const [frameTimeout, setFrameTimeout] = useState(() =>
    Number(localStorage.getItem('app_frame_timeout')) || 5
  )
  const [maxHistory, setMaxHistory] = useState(() =>
    Number(localStorage.getItem('app_max_history')) || 1000
  )
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('app_dark_mode')
    if (saved !== null) return saved === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [useFieldMode, setUseFieldMode] = useState(() => localStorage.getItem('app_use_field_mode') !== 'false')
  const [messages, setMessages] = useState<TerminalMessage[]>([])
  const [sendData, setSendData] = useState('')
  const [protocolFieldsData, setProtocolFieldsData] = useState<Record<string, any>>({})

  // 统计数据
  const [rxCount, setRxCount] = useState(0)
  const [txCount, setTxCount] = useState(0)

  // 协议模式相关的状态
  const [protocolEnabled, setProtocolEnabled] = useState(() => localStorage.getItem('app_protocol_enabled') === 'true')
  const [protocolPanelCollapsed, setProtocolPanelCollapsed] = useState(() => localStorage.getItem('app_protocol_panel_collapsed') === 'true')
  const [packCollapsed, setPackCollapsed] = useState(() => localStorage.getItem('app_pack_collapsed') === 'true')
  const [unpackCollapsed, setUnpackCollapsed] = useState(() => localStorage.getItem('app_unpack_collapsed') === 'true')
  const [toStringCollapsed, setToStringCollapsed] = useState(() => localStorage.getItem('app_toString_collapsed') === 'true')
  const [activeEditor, setActiveEditor] = useState<{ type: 'pack' | 'unpack' | 'toString', code: string } | null>(null)

  const [packCode, setPackCode] = useState(() => localStorage.getItem('protocol_pack') || `/**
 * 打包函数 (Pack)
 * @param {Object} option { data: 待发送内容, utils: 工具类 }
 * @returns {Uint8Array|string}
 */
function(option) {
  const { data, utils } = option;
  return data;
}`)
  const [unpackCode, setUnpackCode] = useState(() => localStorage.getItem('protocol_unpack') || `/**
 * 解包函数 (Unpack)
 * @param {Object} option { data: 接收原始字节, utils: 工具类 }
 * @returns {any}
 */
function(option) {
  const { data, utils } = option;
  return data;
}`)
  const [toStringCode, setToStringCode] = useState(() => localStorage.getItem('protocol_toString') || `/**
 * 输出函数 (toString)
 * @param {Object} option { data: unpack后的数据, utils: 工具类 }
 * @returns {string}
 */
function(option) {
  const { data, utils } = option;
  if (data instanceof Uint8Array) return utils.uint8ArrayToString(data);
  if (typeof data === "object") return JSON.stringify(data);
  return String(data);
}`)

  const addMessage = useCallback((data: string, direction: 'rx' | 'tx') => {
    setMessages((prev) => {
      const now = Date.now()
      if (prev.length > 0) {
        const lastMessage = prev[prev.length - 1]

        // 只要内容完全一致、方向一致就合并计数
        if (
          lastMessage.data === data &&
          lastMessage.direction === direction
        ) {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            timestamp: now,
            count: (lastMessage.count || 1) + 1
          }
          return newMessages
        }
      }

      const newMessage: TerminalMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        timestamp: now,
        data,
        direction,
        count: 1
      }

      const newMessages = [...prev, newMessage]
      if (newMessages.length > maxHistory) {
        return newMessages.slice(newMessages.length - maxHistory)
      }
      return newMessages
    })
  }, [maxHistory])

  // 2. Refs 用于分帧合并
  const rxFrameBuffer = useRef<number[]>([])
  const rxFrameTimer = useRef<number | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const runProtocolFunc = useCallback((handler: string | Function, data: unknown) => {
    try {
      if (typeof handler === 'function') {
        return handler({data, utils: FormatUtils})
      }

      const trimmed = handler.trim()
      // 支持箭头函数和完整函数定义的字符串执行
      if (trimmed.includes('=>') || (trimmed.startsWith('function') && !trimmed.match(/^function\s*\(.*?\)\s*\{/))) {
        const fn = new Function('option', `return (${trimmed})(option)`)
        return fn({data, utils: FormatUtils})
      }

      let body = handler
      const match = handler.match(/function\s*\(.*?\)\s*\{([\s\S]*)\}/)
      if (match) {
        body = match[1]
      }

      const fn = new Function('option', body)
      return fn({data, utils: FormatUtils})
    } catch (e) {
      console.error('Protocol function error:', e)
      return data
    }
  }, [])

  const processData = useCallback((data: Uint8Array, direction: 'rx' | 'tx') => {
    if (protocolEnabled) {
      const unpacked = runProtocolFunc(unpackCode, data)
      const formatted = runProtocolFunc(toStringCode, unpacked)
      addMessage(String(formatted), direction)
    } else if (hexMode) {
      addMessage(FormatUtils.uint8ArrayToHex(data), direction)
    } else {
      const decoder = new TextDecoder(encoding)
      addMessage(decoder.decode(data), direction)
    }
  }, [protocolEnabled, unpackCode, toStringCode, encoding, hexMode, addMessage, runProtocolFunc])

  const [serialConfig, setSerialConfig] = useState<SerialConfig>(() => {
    const saved = localStorage.getItem('app_serial_config')
    return saved ? JSON.parse(saved) : {
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    }
  })

  const [bluetoothConfig, setBluetoothConfig] = useState<BluetoothConfig>(() => {
    const saved = localStorage.getItem('app_bluetooth_config')
    return saved ? JSON.parse(saved) : {
      serviceUUID: '0xfff0',
      characteristicUUID: '0xfff1',
      namePrefix: 'KT',
      filterType: 'name'
    }
  })

  // 3. 副作用处理
  useEffect(() => {
    localStorage.setItem('app_lang', lang)
  }, [lang])

  useEffect(() => {
    localStorage.setItem('protocol_pack', packCode)
    localStorage.setItem('protocol_unpack', unpackCode)
    localStorage.setItem('protocol_toString', toStringCode)
  }, [packCode, unpackCode, toStringCode])

  useEffect(() => {
    localStorage.setItem('app_connection_type', connectionType)
    localStorage.setItem('app_hex_mode', String(hexMode))
    localStorage.setItem('app_shell_mode', String(shellMode))
    localStorage.setItem('app_encoding', encoding)
    localStorage.setItem('app_frame_timeout', String(frameTimeout))
    localStorage.setItem('app_max_history', String(maxHistory))
    localStorage.setItem('app_dark_mode', String(darkMode))
    localStorage.setItem('app_protocol_enabled', String(protocolEnabled))
    localStorage.setItem('app_use_field_mode', String(useFieldMode))
    localStorage.setItem('app_protocol_panel_collapsed', String(protocolPanelCollapsed))
    localStorage.setItem('app_pack_collapsed', String(packCollapsed))
    localStorage.setItem('app_unpack_collapsed', String(unpackCollapsed))
    localStorage.setItem('app_toString_collapsed', String(toStringCollapsed))
    localStorage.setItem('app_serial_config', JSON.stringify(serialConfig))
    localStorage.setItem('app_bluetooth_config', JSON.stringify(bluetoothConfig))
  }, [
    connectionType, hexMode, shellMode, encoding, frameTimeout,
    maxHistory, darkMode, protocolEnabled, useFieldMode, protocolPanelCollapsed, 
    packCollapsed, unpackCollapsed, toStringCollapsed,
    serialConfig, bluetoothConfig
  ])

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

  // 4. 回调函数
  const flushRxFrame = useCallback(() => {
    const data = new Uint8Array(rxFrameBuffer.current)
    rxFrameBuffer.current = [] // 立即清空，防止新数据混入
    if (rxFrameTimer.current) {
      window.clearTimeout(rxFrameTimer.current)
      rxFrameTimer.current = null
    }
    processData(data, 'rx')
  }, [processData])

  const handleClear = () => {
    setMessages([])
    rxFrameBuffer.current = [] // 清除缓存
    if (rxFrameTimer.current) {
      window.clearTimeout(rxFrameTimer.current)
      rxFrameTimer.current = null
    }
    if (window.shellTerminal) {
      window.shellTerminal.clear()
    }
  }

  const resetStats = () => {
    setRxCount(0)
    setTxCount(0)
  }

  useEffect(() => {
    const onDataHandler = (data: Uint8Array, direction: 'rx' | 'tx') => {
      // 统计和 Shell 模式处理
      if (direction === 'rx') {
        setRxCount(prev => prev + data.length)
        if (window.shellTerminal) window.shellTerminal.write(data)
      } else {
        setTxCount(prev => prev + data.length)
      }

      if (shellMode) return

      if (direction === 'rx') {
        if (frameTimeout > 0) {
          // 如果已经在计时，先清除旧计时
          if (rxFrameTimer.current) {
            window.clearTimeout(rxFrameTimer.current)
          }
          // 放入缓冲区
          rxFrameBuffer.current.push(...Array.from(data))
          // 重新启动计时
          rxFrameTimer.current = window.setTimeout(() => {
            flushRxFrame()
          }, frameTimeout)
        } else {
          processData(data, 'rx')
        }
      } else {
        // 发送的数据不进入分帧缓冲，直接处理
        processData(data, 'tx')
      }
    }

    SerialPortManager.onData((data, direction) => {
      if (connectionType === 'serial') onDataHandler(data, direction)
    })

    BluetoothManager.onData((data, direction) => {
      if (connectionType === 'bluetooth') onDataHandler(data, direction)
    })

    SerialPortManager.onStatusChange((status) => {
      if (connectionType === 'serial') setConnected(status)
    })

    BluetoothManager.onStatusChange((status) => {
      if (connectionType === 'bluetooth') setConnected(status)
    })

    return () => {
      if (rxFrameTimer.current) window.clearTimeout(rxFrameTimer.current)
    }
  }, [connectionType, frameTimeout, shellMode, flushRxFrame, processData, addMessage])

  // 5. 业务逻辑
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
    let dataToPack: any;
    const isHex = customType ? (customType === 'hex') : hexMode;

    if (customData !== undefined) {
      // 来自保存命令的点击
      if (isHex) {
        const cleanHex = customData.replace(/\s+/g, '').replace(/0x/gi, '');
        dataToPack = FormatUtils.hexToUint8Array(cleanHex);
      } else {
        dataToPack = customData;
      }
    } else {
      // 来自底部发送区域
      const currentPreset = PROTOCOL_PRESETS[Object.keys(PROTOCOL_PRESETS).find(k => PROTOCOL_PRESETS[k].pack.toString() === packCode) || ''];
      
      if (protocolEnabled && useFieldMode && currentPreset?.fields) {
        // 字段模式：构造对象
        dataToPack = { ...protocolFieldsData };
        // 特殊处理 faces 这种 JSON 字符串
        if (typeof dataToPack.faces === 'string') {
          try {
            dataToPack.faces = new Function(`return ${dataToPack.faces}`)();
          } catch (e) {
            alert('人脸数据格式错误: ' + e);
            return;
          }
        }
      } else if (isHex) {
        const cleanHex = sendData.replace(/\s+/g, '').replace(/0x/gi, '');
        if (!/^[0-9A-Fa-f]{2,}$/.test(cleanHex)) {
          alert(t.inputHex);
          return;
        }
        dataToPack = FormatUtils.hexToUint8Array(cleanHex);
      } else {
        dataToPack = sendData;
      }
    }

    if (!dataToPack && typeof dataToPack !== 'object') return;

    let dataToSend: string | Uint8Array = dataToPack;
    if (protocolEnabled) {
      dataToSend = runProtocolFunc(packCode, dataToPack);
    }

    const success = connectionType === 'serial' ? await SerialPortManager.send(dataToSend) : await BluetoothManager.send(dataToSend);
    if (!success) alert(t.sendFail);
    else if (customData === undefined) setSendData('');
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
            <button className={`btn btn-outline-secondary ${lang === 'zh' ? 'active' : ''}`}
                    onClick={() => setLang('zh')}>中
            </button>
            <button className={`btn btn-outline-secondary ${lang === 'en' ? 'active' : ''}`}
                    onClick={() => setLang('en')}>EN
            </button>
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
              <button className={`btn ${connectionType === 'serial' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => !connected && setConnectionType('serial')} disabled={connected}>{t.serial}</button>
              <button className={`btn ${connectionType === 'bluetooth' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => !connected && setConnectionType('bluetooth')} disabled={connected}>{t.ble}</button>
            </div>
          </div>

          {connectionType === 'serial' && (
            <div className="panel-section">
              <div className="section-title"><i className="bi bi-gear"></i> {t.serialConfig}</div>
              <div className="form-group mb-3"><label>{t.baudRate}</label>
                <select className="form-select" value={serialConfig.baudRate}
                        onChange={(e) => setSerialConfig({...serialConfig, baudRate: Number(e.target.value)})}>
                  {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map(r => <option
                    key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="row g-2 mb-3">
                <div className="col-6"><label>{t.dataBits}</label><select className="form-select"
                                                                          value={serialConfig.dataBits}
                                                                          onChange={(e) => setSerialConfig({
                                                                            ...serialConfig,
                                                                            dataBits: Number(e.target.value)
                                                                          })}>{[7, 8].map(b => <option key={b}
                                                                                                       value={b}>{b}</option>)}</select>
                </div>
                <div className="col-6"><label>{t.stopBits}</label><select className="form-select"
                                                                          value={serialConfig.stopBits}
                                                                          onChange={(e) => setSerialConfig({
                                                                            ...serialConfig,
                                                                            stopBits: Number(e.target.value)
                                                                          })}>{[1, 2].map(b => <option key={b}
                                                                                                       value={b}>{b}</option>)}</select>
                </div>
              </div>
              <div className="form-group mb-3"><label>{t.parity}</label>
                <select className="form-select" value={serialConfig.parity} onChange={(e) => setSerialConfig({
                  ...serialConfig,
                  parity: e.target.value as 'none' | 'even' | 'odd'
                })}>
                  <option value="none">None</option>
                  <option value="even">Even</option>
                  <option value="odd">Odd</option>
                </select>
              </div>
              {!connected && <button className="btn btn-success w-100" onClick={connectSerial}><i
                className="bi bi-plug"></i> {t.openSerial}</button>}
            </div>
          )}

          {connectionType === 'bluetooth' && (
            <div className="panel-section">
              <div className="section-title"><i className="bi bi-bluetooth"></i> {t.bleConfig}</div>
              <div className="form-group mb-3"><label>{t.filterType}</label>
                <select className="form-select" value={bluetoothConfig.filterType} onChange={(e) => setBluetoothConfig({
                  ...bluetoothConfig,
                  filterType: e.target.value as 'service' | 'name' | 'all'
                })}>
                  <option value="name">{t.byName}</option>
                  <option value="service">{t.byService}</option>
                  <option value="all">{t.showAll}</option>
                </select>
              </div>
              {bluetoothConfig.filterType === 'name' && (
                <div className="form-group mb-3"><label>{t.namePrefix}</label><input type="text"
                                                                                     className="form-control"
                                                                                     value={bluetoothConfig.namePrefix}
                                                                                     onChange={(e) => setBluetoothConfig({
                                                                                       ...bluetoothConfig,
                                                                                       namePrefix: e.target.value
                                                                                     })}/></div>
              )}
              <div className="form-group mb-3"><label>{t.serviceUUID}</label><input type="text" className="form-control"
                                                                                    value={bluetoothConfig.serviceUUID}
                                                                                    onChange={(e) => setBluetoothConfig({
                                                                                      ...bluetoothConfig,
                                                                                      serviceUUID: e.target.value
                                                                                    })}/></div>
              <div className="form-group mb-3"><label>{t.charUUID}</label><input type="text" className="form-control"
                                                                                 value={bluetoothConfig.characteristicUUID}
                                                                                 onChange={(e) => setBluetoothConfig({
                                                                                   ...bluetoothConfig,
                                                                                   characteristicUUID: e.target.value
                                                                                 })}/></div>
              {!connected && <button className="btn btn-success w-100" onClick={connectBluetooth}><i
                className="bi bi-search"></i> {t.searchConnect}</button>}
            </div>
          )}

          <div className="panel-section">
            <div className="section-title"><i className="bi bi-sliders"></i> {t.displaySettings}</div>
            <div className="form-check mb-2"><input type="checkbox" className="form-check-input" id="hexMode"
                                                    checked={hexMode}
                                                    onChange={(e) => setHexMode(e.target.checked)}/><label
              className="form-check-label" htmlFor="hexMode">{t.hexMode}</label></div>
            <div className="form-check mb-2"><input type="checkbox" className="form-check-input" id="shellMode"
                                                    checked={shellMode}
                                                    onChange={(e) => setShellMode(e.target.checked)}/><label
              className="form-check-label" htmlFor="shellMode">{t.shellMode}</label></div>
            <div className="form-group mb-2"><label>{t.encoding}</label><select className="form-select" value={encoding}
                                                                                onChange={(e) => setEncoding(e.target.value as 'utf-8' | 'gbk')}>
              <option value="utf-8">UTF-8</option>
              <option value="gbk">GBK</option>
            </select></div>
            <div className="row g-2 mb-2">
              <div className="col-6"><label className="small">{t.frameTimeout}</label><input type="number"
                                                                                             className="form-control form-control-sm"
                                                                                             value={frameTimeout}
                                                                                             onChange={e => setFrameTimeout(Math.max(0, Number(e.target.value)))}/>
              </div>
              <div className="col-6"><label className="small">{t.maxHistory}</label><input type="number"
                                                                                           className="form-control form-control-sm"
                                                                                           value={maxHistory}
                                                                                           onChange={e => setMaxHistory(Math.max(10, Number(e.target.value)))}/>
              </div>
            </div>
            <div className="form-check"><input type="checkbox" className="form-check-input" id="darkMode"
                                               checked={darkMode}
                                               onChange={(e) => setDarkMode(e.target.checked)}/><label
              className="form-check-label" htmlFor="darkMode">{t.darkMode} ({darkMode ? t.auto : t.light})</label></div>
          </div>

          <div className="panel-section">
            <div className="section-title cursor-pointer d-flex justify-content-between align-items-center"
                 onClick={() => setProtocolPanelCollapsed(!protocolPanelCollapsed)}>
              <span>
                <i className="bi bi-braces"></i> {t.protocolMode}
                {protocolEnabled && (
                  <span className="badge rounded-pill bg-success ms-2"
                        style={{fontSize: '10px', padding: '2px 6px', verticalAlign: 'middle'}}>ON</span>
                )}
                <button className="btn btn-link btn-sm p-0 ms-2" onClick={(e) => {
                  e.stopPropagation();
                  alert(t.protocolHelp);
                }} title={t.help}>
                  <i className="bi bi-question-circle"></i>
                </button>
              </span>
              <i className={`bi bi-chevron-${protocolPanelCollapsed ? 'down' : 'up'} small transition-transform`}></i>
            </div>

            {!protocolPanelCollapsed && (
              <>
                <div className="d-flex align-items-center mb-3">
                  <div className="form-check flex-grow-1">
                    <input type="checkbox" className="form-check-input" id="protocolEnabled" checked={protocolEnabled}
                           onChange={(e) => setProtocolEnabled(e.target.checked)}/>
                    <label className="form-check-label" htmlFor="protocolEnabled">{t.protocolEnabled}</label>
                  </div>
                  <div className="dropdown">
                    <button className="btn btn-sm btn-outline-secondary dropdown-toggle" type="button"
                            data-bs-toggle="dropdown">
                      <i className="bi bi-list-stars me-1"></i> {t.presets}
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end">
                      {Object.entries(PROTOCOL_PRESETS).map(([key, preset]) => (
                        <li key={key}>
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
                              const toCodeString = (f: string | Function) => typeof f === 'function' ? f.toString() : f;
                              setPackCode(toCodeString(preset.pack));
                              setUnpackCode(toCodeString(preset.unpack));
                              if (preset.toString) setToStringCode(toCodeString(preset.toString));
                              if (preset.fields) {
                                const initialFields: Record<string, any> = {};
                                preset.fields.forEach(f => initialFields[f.key] = f.default);
                                setProtocolFieldsData(initialFields);
                              }
                              setProtocolEnabled(true);
                            }}
                          >
                            {preset.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {protocolEnabled && (
                  <div className="protocol-config">
                    <div className="mb-2">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="small cursor-pointer d-flex align-items-center" onClick={() => setPackCollapsed(!packCollapsed)}>
                          <i className={`bi bi-chevron-${packCollapsed ? 'right' : 'down'} me-1 small transition-transform`}></i>
                          {t.packFunc}
                        </label>
                        {!packCollapsed && (
                          <button className="btn btn-link btn-sm p-0 text-decoration-none"
                                  onClick={() => setActiveEditor({type: 'pack', code: packCode})}>
                            <i className="bi bi-arrows-fullscreen small"></i>
                          </button>
                        )}
                      </div>
                      {!packCollapsed && (
                        <div className="editor-container">
                          <Editor
                            value={packCode}
                            onValueChange={code => setPackCode(code)}
                            highlight={code => Prism.highlight(code, Prism.languages.javascript, 'javascript')}
                            padding={10}
                            className="code-area-highlight"
                          />
                        </div>
                      )}
                    </div>
                    <div className="mb-2">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="small cursor-pointer d-flex align-items-center" onClick={() => setUnpackCollapsed(!unpackCollapsed)}>
                          <i className={`bi bi-chevron-${unpackCollapsed ? 'right' : 'down'} me-1 small transition-transform`}></i>
                          {t.unpackFunc}
                        </label>
                        {!unpackCollapsed && (
                          <button className="btn btn-link btn-sm p-0 text-decoration-none"
                                  onClick={() => setActiveEditor({type: 'unpack', code: unpackCode})}>
                            <i className="bi bi-arrows-fullscreen small"></i>
                          </button>
                        )}
                      </div>
                      {!unpackCollapsed && (
                        <div className="editor-container">
                          <Editor
                            value={unpackCode}
                            onValueChange={code => setUnpackCode(code)}
                            highlight={code => Prism.highlight(code, Prism.languages.javascript, 'javascript')}
                            padding={10}
                            className="code-area-highlight"
                          />
                        </div>
                      )}
                    </div>
                    <div className="mb-2">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="small cursor-pointer d-flex align-items-center" onClick={() => setToStringCollapsed(!toStringCollapsed)}>
                          <i className={`bi bi-chevron-${toStringCollapsed ? 'right' : 'down'} me-1 small transition-transform`}></i>
                          {t.toStringFunc}
                        </label>
                        {!toStringCollapsed && (
                          <button className="btn btn-link btn-sm p-0 text-decoration-none"
                                  onClick={() => setActiveEditor({type: 'toString', code: toStringCode})}>
                            <i className="bi bi-arrows-fullscreen small"></i>
                          </button>
                        )}
                      </div>
                      {!toStringCollapsed && (
                        <div className="editor-container">
                          <Editor
                            value={toStringCode}
                            onValueChange={code => setToStringCode(code)}
                            highlight={code => Prism.highlight(code, Prism.languages.javascript, 'javascript')}
                            padding={10}
                            className="code-area-highlight"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!shellMode && (
            <div className="panel-section">
              <div className="section-title d-flex justify-content-between align-items-center">
                <span><i className="bi bi-send"></i> {t.sendData}</span>
                {protocolEnabled && PROTOCOL_PRESETS[Object.keys(PROTOCOL_PRESETS).find(k => PROTOCOL_PRESETS[k].pack.toString() === packCode) || '']?.fields && (
                  <div className="btn-group btn-group-xs">
                    <button 
                      className={`btn btn-outline-secondary btn-xs ${useFieldMode ? 'active' : ''}`}
                      onClick={() => setUseFieldMode(true)}
                      style={{ fontSize: '10px', padding: '1px 5px' }}
                    >
                      字段
                    </button>
                    <button 
                      className={`btn btn-outline-secondary btn-xs ${!useFieldMode ? 'active' : ''}`}
                      onClick={() => setUseFieldMode(false)}
                      style={{ fontSize: '10px', padding: '1px 5px' }}
                    >
                      原始
                    </button>
                  </div>
                )}
              </div>
              
              {protocolEnabled && useFieldMode && PROTOCOL_PRESETS[Object.keys(PROTOCOL_PRESETS).find(k => PROTOCOL_PRESETS[k].pack.toString() === packCode) || '']?.fields ? (
                <div className="protocol-fields-inputs mb-2">
                  {PROTOCOL_PRESETS[Object.keys(PROTOCOL_PRESETS).find(k => PROTOCOL_PRESETS[k].pack.toString() === packCode) || '']?.fields?.map(field => (
                    <div key={field.key} className="mb-2">
                      <label className="small text-muted">{field.name}</label>
                      {field.type === 'number' ? (
                        <input 
                          type="number" 
                          className="form-control form-control-sm"
                          value={protocolFieldsData[field.key] ?? field.default}
                          onChange={e => setProtocolFieldsData(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                        />
                      ) : (
                        <input 
                          type="text" 
                          className="form-control form-control-sm"
                          value={protocolFieldsData[field.key] ?? field.default}
                          placeholder={field.placeholder}
                          onChange={e => setProtocolFieldsData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="form-group mb-2">
                  <textarea 
                    className="form-control send-area" 
                    value={sendData}
                    onChange={(e) => setSendData(e.target.value)}
                    placeholder={hexMode ? t.inputHex : t.inputText} 
                    rows={4}
                  />
                </div>
              )}
              
              <button className="btn btn-primary w-100" onClick={() => handleSend()} disabled={!connected}>
                <i className="bi bi-send"></i> {t.send}
              </button>
            </div>
          )}

          {connected && <div className="panel-section">
            <button className="btn btn-danger w-100" onClick={disconnect}><i
              className="bi bi-x-circle"></i> {t.disconnect}</button>
          </div>}
        </aside>

        <section className="terminal-panel">
          <div className="main-content-row h-100 d-flex">
            <div className="flex-grow-1 h-100 overflow-hidden">
              {shellMode ? (
                <ShellTerminal
                  connected={connected}
                  onData={handleShellData}
                  onClear={handleClear}
                  lang={lang}
                  rxCount={rxCount}
                  txCount={txCount}
                  onResetStats={resetStats}
                />
              ) : (
                <Terminal
                  messages={messages}
                  onClear={handleClear}
                  onCopy={() => {
                    const text = messages.map(m => `[${m.timestamp}] ${m.direction.toUpperCase()}: ${m.data}`).join('\n');
                    navigator.clipboard.writeText(text);
                    alert(t.copied);
                  }}
                  autoScroll={true}
                  lang={lang}
                  rxCount={rxCount}
                  txCount={txCount}
                  onResetStats={resetStats}
                />
              )}
            </div>
            {!shellMode && (
              <CommandPanel onSend={(content, type) => handleSend(content, type)} lang={lang} connected={connected}/>
            )}
          </div>
        </section>
      </main>
      <footer className="app-footer">
        <small className="text-muted">Web Serial Assistant v1.0 | Web Serial & Web Bluetooth</small>
      </footer>

      {activeEditor && (
        <div className="protocol-modal-overlay">
          <div className="protocol-modal-content">
            <div className="protocol-modal-header">
              <h5 className="mb-0">
                {activeEditor.type === 'pack' ? t.packFunc : activeEditor.type === 'unpack' ? t.unpackFunc : t.toStringFunc}
              </h5>
              <div className="d-flex gap-2">
                <div className="dropdown">
                  <button className="btn btn-sm btn-outline-secondary dropdown-toggle" type="button"
                          data-bs-toggle="dropdown">
                    {t.presets || 'Presets'}
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end">
                    {Object.entries(PROTOCOL_PRESETS).map(([key, preset]) => (
                      <li key={key}>
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
                            const toCodeString = (f: string | Function) => typeof f === 'function' ? f.toString() : f;
                            if (activeEditor.type === 'pack') setActiveEditor({
                              ...activeEditor,
                              code: toCodeString(preset.pack)
                            });
                            else if (activeEditor.type === 'unpack') setActiveEditor({
                              ...activeEditor,
                              code: toCodeString(preset.unpack)
                            });
                            else if (activeEditor.type === 'toString') setActiveEditor({
                              ...activeEditor,
                              code: toCodeString(preset.toString || '') || activeEditor.code
                            });
                          }}
                        >
                          {preset.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <button className="btn-close btn-close-white" onClick={() => setActiveEditor(null)}></button>
              </div>
            </div>
            <div className="protocol-modal-body">
              <Editor
                value={activeEditor.code}
                onValueChange={code => setActiveEditor({...activeEditor, code})}
                highlight={code => Prism.highlight(code, Prism.languages.javascript, 'javascript')}
                padding={20}
                className="full-editor"
              />
            </div>
            <div className="protocol-modal-footer">
              <button className="btn btn-secondary me-2"
                      onClick={() => setActiveEditor(null)}>{t.clear || 'Cancel'}</button>
              <button className="btn btn-primary" onClick={() => {
                if (activeEditor.type === 'pack') setPackCode(activeEditor.code);
                else if (activeEditor.type === 'unpack') setUnpackCode(activeEditor.code);
                else if (activeEditor.type === 'toString') setToStringCode(activeEditor.code);
                setActiveEditor(null);
              }}>{t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

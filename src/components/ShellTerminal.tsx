import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import * as ZModem from 'zmodem.js'
import { translations, type Language } from '../locales/translations'
import '@xterm/xterm/css/xterm.css'
import './ShellTerminal.css'

interface ShellTerminalProps {
  connected: boolean
  onData: (data: Uint8Array) => void
  onClear?: () => void
  lang: Language
  rxCount?: number
  txCount?: number
  onResetStats?: () => void
}

const ShellTerminal: React.FC<ShellTerminalProps> = ({
  connected,
  onData,
  onClear,
  lang,
  rxCount = 0,
  txCount = 0,
  onResetStats,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const sentryRef = useRef<ZModem.Sentry | null>(null)
  const sessionRef = useRef<ZModem.ZModemSession | null>(null)
  const onDataRef = useRef(onData)
  const t = translations[lang]

  // 更新 ref 确保总是使用最新的回调
  useEffect(() => {
    onDataRef.current = onData
  }, [onData])

  // 对应 sz：远程发送，本地接收
  const handleZmodemSend = async (session: ZModem.ZModemSession) => {
    console.log('ZMODEM Send Session started (receiving file from device)')
    
    session.on('offer', (arg: unknown) => {
      const offer = arg as ZModem.ZModemOffer
      offer.accept().then((contents: Uint8Array[]) => {
        const blob = new Blob(contents as BlobPart[], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = offer.get_details().name
        a.click()
        URL.revokeObjectURL(url)
      })
    })

    session.on('session_end', () => {
      sessionRef.current = null
      console.log('ZMODEM session ended')
    })

    session.start()
  }

  // 对应 rz：远程接收，本地发送
  const handleZmodemReceive = async (session: ZModem.ZModemSession) => {
    console.log('ZMODEM Receive Session started (sending file to device)')

    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) {
        session.skip()
        return
      }

      const reader = new FileReader()
      reader.onload = async () => {
        const buffer = reader.result as ArrayBuffer
        const uint8Array = new Uint8Array(buffer)
        
        ZModem.Browser.send_files(session, [
          {
            name: file.name,
            size: file.size,
            mtime: new Date(file.lastModified),
            content: uint8Array,
          }
        ]).then(() => {
          session.close()
        })
      }
      reader.readAsArrayBuffer(file)
    }
    input.click()

    session.on('session_end', () => {
      sessionRef.current = null
      console.log('ZMODEM session ended')
    })

    session.start()
  }

  useEffect(() => {
    if (!terminalRef.current) return

    // 初始化 Xterm
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0c0c0c',
        foreground: '#00ff00',
      },
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
      fontSize: 14,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term

    // 初始化 ZMODEM Sentry
    const sentry = new ZModem.Sentry({
      to_terminal: (data: number[]) => {
        term.write(new Uint8Array(data))
      },
      sender: (data: number[]) => {
        onDataRef.current(new Uint8Array(data))
      },
      on_detect: (detection: ZModem.ZModemDetection) => {
        const zsession = detection.confirm()
        sessionRef.current = zsession

        if (zsession.type === 'send') {
          handleZmodemSend(zsession)
        } else {
          handleZmodemReceive(zsession)
        }
      },
      on_retract: () => {
        console.log('ZMODEM retracted')
      },
    })
    sentryRef.current = sentry

    // 监听输入
    term.onData((data) => {
      if (sessionRef.current) return
      const encoder = new TextEncoder()
      onDataRef.current(encoder.encode(data))
    })

    // 处理窗口大小变化
    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    // 暴露方法给全局窗口对象
    window.shellTerminal = {
      write: (data: Uint8Array) => {
        if (sessionRef.current) {
          sessionRef.current.consume(data)
        } else if (sentryRef.current) {
          sentryRef.current.consume(data)
        }
      },
      clear: () => term.clear()
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      window.shellTerminal = undefined
      term.dispose()
    }
  }, [])

  useEffect(() => {
    if (connected && xtermRef.current) {
      xtermRef.current.focus()
    }
  }, [connected])

  return (
    <div className="shell-terminal-container">
      <div className="shell-terminal-header">
        <div className="d-flex align-items-center flex-grow-1">
          <h6 className="mb-0 me-3">
            <i className="bi bi-terminal-fill me-2"></i>
            {t.ttyTitle}
          </h6>
          <div className="terminal-stats-header d-flex align-items-center gap-2">
            <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle">
              RX: {rxCount}
            </span>
            <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle">
              TX: {txCount}
            </span>
            <button className="btn btn-link btn-sm p-0 text-decoration-none text-muted" onClick={onResetStats} title={t.reset}>
              <i className="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
        </div>
        <div className="shell-terminal-actions">
          <button 
            className="btn btn-sm btn-outline-danger" 
            onClick={() => { xtermRef.current?.clear(); onClear?.(); }} 
            title={t.clear}
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div ref={terminalRef} className="xterm-wrapper" />
    </div>
  )
}

export default ShellTerminal

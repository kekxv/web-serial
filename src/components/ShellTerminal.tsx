import { useState, useEffect, useRef } from 'react'
import './ShellTerminal.css'

export interface ShellLine {
  id: string
  type: 'input' | 'output' | 'error'
  content: string
  timestamp?: string
}

interface ShellTerminalProps {
  connected: boolean
  hexMode: boolean
  onCommand: (command: string) => void
  onClear?: () => void
}

const ShellTerminal: React.FC<ShellTerminalProps> = ({
  connected,
  hexMode,
  onCommand,
  onClear,
}) => {
  const [lines, setLines] = useState<ShellLine[]>([
    {
      id: 'welcome',
      type: 'output',
      content: 'Web Serial Terminal v1.0\n输入 help 查看可用命令\n',
    },
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [lines])

  useEffect(() => {
    if (connected && inputRef.current) {
      inputRef.current.focus()
    }
  }, [connected])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExecute()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      navigateHistory(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      navigateHistory(1)
    } else if (e.key === 'Tab') {
      e.preventDefault()
    }
  }

  const navigateHistory = (direction: number) => {
    const newIndex = historyIndex + direction
    if (newIndex >= -1 && newIndex < history.length) {
      setHistoryIndex(newIndex)
      if (newIndex === -1) {
        setInput('')
      } else {
        setInput(history[history.length - 1 - newIndex])
      }
    }
  }

  const handleExecute = () => {
    if (!input.trim()) {
      return
    }

    const command = input.trim()
    setHistory([...history, command])
    setHistoryIndex(-1)

    addLine(command, 'input')
    setInput('')

    // 处理内置命令
    if (command.toLowerCase() === 'help') {
      addLine('可用命令:', 'output')
      addLine('  help    - 显示帮助信息', 'output')
      addLine('  clear   - 清空终端', 'output')
      addLine('  version - 显示版本信息', 'output')
      addLine('  echo    - 回显测试', 'output')
      addLine('  status  - 显示连接状态', 'output')
      addLine('', 'output')
    } else if (command.toLowerCase() === 'clear') {
      setLines([])
    } else if (command.toLowerCase() === 'version') {
      addLine('Web Serial Terminal v1.0.0', 'output')
      addLine('Built with React + TypeScript', 'output')
    } else if (command.toLowerCase() === 'echo') {
      addLine('Echo test successful!', 'output')
    } else if (command.toLowerCase() === 'status') {
      addLine(`连接状态: ${connected ? '已连接' : '未连接'}`, 'output')
      addLine(`HEX 模式: ${hexMode ? '开启' : '关闭'}`, 'output')
    } else {
      // 发送给串口
      onCommand(command)
    }
  }

  const addLine = (content: string, type: ShellLine['type']) => {
    const newLine: ShellLine = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLines([...lines, newLine])
  }

  const addOutputLine = (content: string) => {
    addLine(content, 'output')
  }

  const addErrorLine = (content: string) => {
    addLine(content, 'error')
  }

  // 暴露方法给父组件
  useEffect(() => {
    ;(window as any).shellTerminal = {
      addOutputLine,
      addErrorLine,
    }
  }, [])

  return (
    <div className="shell-terminal-container">
      <div className="shell-terminal-header">
        <h6 className="mb-0">
          <i className="bi bi-terminal-fill me-2"></i>
          Shell
        </h6>
        <div className="shell-terminal-actions">
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={onClear}
            title="清空"
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div ref={terminalRef} className="shell-terminal-content custom-scrollbar">
        {lines.map((line) => (
          <div key={line.id} className={`shell-line shell-${line.type}`}>
            {line.type === 'input' && (
              <span className="shell-prompt">
                <i className="bi bi-arrow-right-circle-fill"></i>
              </span>
            )}
            <span className="shell-content">{line.content}</span>
          </div>
        ))}
        <div className="shell-input-line">
          <span className="shell-prompt">
            <span className={connected ? 'prompt-active' : 'prompt-inactive'}>
              {connected ? '$' : '(未连接)'}
            </span>
          </span>
          <input
            ref={inputRef}
            type="text"
            className="shell-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={connected ? '输入命令...' : '请先连接串口'}
            disabled={!connected}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}

export default ShellTerminal

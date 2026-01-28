import { useState, useEffect } from 'react'
import { translations, type Language } from '../locales/translations'
import './CommandPanel.css'

export interface SavedCommand {
  id: string
  name: string
  content: string
  type: 'text' | 'hex'
}

interface CommandPanelProps {
  onSend: (content: string, type?: 'text' | 'hex') => void
  lang: Language
  connected: boolean
}

const CommandPanel: React.FC<CommandPanelProps> = ({ onSend, lang, connected }) => {
  const t = translations[lang]
  const [commands, setCommands] = useState<SavedCommand[]>(() => {
    const saved = localStorage.getItem('saved_commands')
    return saved ? JSON.parse(saved) : []
  })
  
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState<'text' | 'hex'>('text')

  useEffect(() => {
    localStorage.setItem('saved_commands', JSON.stringify(commands))
  }, [commands])

  const handleSave = () => {
    if (!newName.trim() || !newContent.trim()) return

    if (editingId) {
      setCommands(prev => prev.map(cmd => 
        cmd.id === editingId ? { ...cmd, name: newName, content: newContent, type: newType } : cmd
      ))
      setEditingId(null)
    } else {
      const newCmd: SavedCommand = {
        id: Date.now().toString(),
        name: newName,
        content: newContent,
        type: newType
      }
      setCommands(prev => [...prev, newCmd])
    }
    
    setNewName('')
    setNewContent('')
    setNewType('text')
    setIsAdding(false)
  }

  const handleEdit = (cmd: SavedCommand) => {
    setNewName(cmd.name)
    setNewContent(cmd.content)
    setNewType(cmd.type || 'text')
    setEditingId(cmd.id)
    setIsAdding(true)
  }

  const handleDelete = (id: string) => {
    setCommands(prev => prev.filter(cmd => cmd.id !== id))
  }

  return (
    <div className="command-panel-container">
      <div className="command-panel-header">
        <h6 className="mb-0"><i className="bi bi-list-stars me-2"></i>{t.commonCommands}</h6>
        <button 
          className="btn btn-sm btn-primary" 
          onClick={() => { setIsAdding(true); setEditingId(null); setNewName(''); setNewContent(''); setNewType('text'); }}
          disabled={isAdding}
        >
          <i className="bi bi-plus-lg"></i>
        </button>
      </div>

      <div className="command-panel-content custom-scrollbar">
        {isAdding && (
          <div className="command-edit-box mb-3">
            <input 
              type="text" 
              className="form-control form-control-sm mb-2" 
              placeholder={t.commandName}
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <textarea 
              className="form-control form-control-sm mb-2" 
              placeholder={t.commandContent}
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              rows={3}
            />
            <div className="d-flex gap-2 mb-2">
              <select 
                className="form-select form-select-sm" 
                value={newType}
                onChange={e => setNewType(e.target.value as 'text' | 'hex')}
              >
                <option value="text">{t.typeText}</option>
                <option value="hex">{t.typeHex}</option>
              </select>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-success flex-grow-1" onClick={handleSave}>{t.save}</button>
              <button className="btn btn-sm btn-outline-secondary flex-grow-1" onClick={() => setIsAdding(false)}>{t.clear}</button>
            </div>
          </div>
        )}

        {commands.length === 0 && !isAdding ? (
          <div className="text-center py-4 text-muted">
            <small>{t.noCommands}</small>
          </div>
        ) : (
          <div className="command-list">
            {commands.map(cmd => (
              <div key={cmd.id} className="command-item p-2 mb-2">
                <div className="command-item-info mb-2">
                  <div>
                    <span className={`badge ${cmd.type === 'hex' ? 'bg-warning text-dark' : 'bg-info text-dark'} me-2`}>
                      {cmd.type === 'hex' ? t.typeHex : t.typeText}
                    </span>
                    <span className="command-name fw-bold">{cmd.name}</span>
                  </div>
                  <div className="command-actions">
                    <i className="bi bi-pencil-square me-2 text-primary pointer" onClick={() => handleEdit(cmd)}></i>
                    <i className="bi bi-trash text-danger pointer" onClick={() => handleDelete(cmd.id)}></i>
                  </div>
                </div>
                <button 
                  className="btn btn-sm btn-outline-primary w-100 text-truncate text-start"
                  onClick={() => onSend(cmd.content, cmd.type)}
                  disabled={!connected}
                  title={cmd.content}
                >
                  <i className="bi bi-send me-2"></i>
                  {cmd.content}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CommandPanel
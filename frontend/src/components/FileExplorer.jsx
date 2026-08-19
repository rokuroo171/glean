import { useMemo, useRef, useState, useEffect } from 'react'
import { colors, space, typography } from '../lib/theme'
import StarIcon from './StarIcon'
import Icon from './Icon'

function groupByFolder(notes) {
  const groups = {}
  for (const n of notes) {
    const folder = n.folder || '_root'
    if (!groups[folder]) groups[folder] = []
    groups[folder].push(n)
  }
  return groups
}

function sortNotes(notes, sort) {
  const list = [...notes]
  if (sort === 'recent') {
    list.sort((a, b) => {
      const ta = a.last_visited || a.created_at || ''
      const tb = b.last_visited || b.created_at || ''
      return tb.localeCompare(ta)
    })
  } else {
    list.sort((a, b) => a.title.localeCompare(b.title))
  }
  return list
}

// Inline input for creating a file or folder.
function InlineInput({ isFolder, placeholder, onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  const ref = useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value.trim())
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%',
      padding: '3px 12px' }}>
      <Icon name={isFolder ? 'folder' : 'file'} size={13}
        style={{ flexShrink: 0, color: colors.textMuted }} />
      <input ref={ref} value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown} onBlur={onCancel}
        placeholder={placeholder}
        style={{ flex: 1, background: 'transparent', border: `1px solid ${colors.accent}`,
          borderRadius: 3, padding: '2px 6px', fontSize: 12, color: colors.text,
          outline: 'none', minWidth: 0 }} />
    </div>
  )
}

export default function FileExplorer({ notes, activeId, onOpenNote, skyName,
  onCreateNote, onCreateFolder, onRefresh }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('alpha')
  const [collapsed, setCollapsed] = useState({})
  const [creating, setCreating] = useState(null) // { type: 'file'|'folder', folder: string }

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return notes
    return notes.filter(n => n.title.toLowerCase().includes(q))
  }, [notes, q])

  const groups = useMemo(() => groupByFolder(filtered), [filtered])
  const folderNames = useMemo(() => {
    return Object.keys(groups).sort((a, b) => {
      if (a === '_root') return -1
      if (b === '_root') return 1
      return a.localeCompare(b)
    })
  }, [groups])

  function toggleFolder(name) {
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function collapseAll() {
    const all = {}
    for (const f of folderNames) {
      if (f !== '_root') all[f] = true
    }
    setCollapsed(all)
  }

  function handleCreateFile(name) {
    if (creating && onCreateNote) {
      onCreateNote(name, creating.folder === '_root' ? '' : creating.folder)
    }
    setCreating(null)
  }

  function handleCreateFolder(name) {
    if (onCreateFolder) onCreateFolder(name)
    setCreating(null)
  }

  const tb = { background: 'none', border: 'none', color: colors.textMuted,
    cursor: 'pointer', padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 4 }
  const tbHover = { background: 'rgba(90, 106, 122, 0.15)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: `${space[2]}px ${space[2]}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ ...typography.sectionLabel, color: colors.textMuted, textTransform: 'uppercase',
            letterSpacing: '0.08em', fontSize: 11 }}>
            {skyName || 'Sky'}
          </div>
        </div>
        {/* Toolbar -- VSCode style: new file, new folder, refresh, collapse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 6 }}>
          <button type="button" title="New file" style={tb}
            onMouseEnter={e => Object.assign(e.currentTarget.style, tbHover)}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            onClick={() => setCreating({ type: 'file', folder: '_root' })}>
            <Icon name="file-plus" size={13} />
          </button>
          <button type="button" title="New folder" style={tb}
            onMouseEnter={e => Object.assign(e.currentTarget.style, tbHover)}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            onClick={() => setCreating({ type: 'folder', folder: '_root' })}>
            <Icon name="folder-plus" size={13} />
          </button>
          {onRefresh && (
            <button type="button" title="Refresh" style={tb}
              onMouseEnter={e => Object.assign(e.currentTarget.style, tbHover)}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              onClick={onRefresh}>
              <Icon name="refresh-cw" size={13} />
            </button>
          )}
          <button type="button" title="Collapse all" style={tb}
            onMouseEnter={e => Object.assign(e.currentTarget.style, tbHover)}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            onClick={collapseAll}>
            <Icon name="layout-list" size={13} />
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" style={{ ...tb, padding: 2 }}
            onClick={() => setSort(s => s === 'alpha' ? 'recent' : 'alpha')}
            title={sort === 'alpha' ? 'Sort by recent' : 'Sort alphabetically'}>
            <Icon name={sort === 'alpha' ? 'star' : 'pencil'} size={11} />
          </button>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter files..."
          style={{ width: '100%', background: colors.bg, color: colors.text,
            border: `1px solid ${colors.border}`, borderRadius: 6, padding: '5px 10px',
            fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* File tree */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `${space[1]}px 0` }}>
        {/* Inline creation at root */}
        {creating && creating.folder === '_root' && (
          <InlineInput isFolder={creating.type === 'folder'}
            placeholder={creating.type === 'folder' ? 'Folder name...' : 'Note name...'}
            onSubmit={creating.type === 'folder' ? handleCreateFolder : handleCreateFile}
            onCancel={() => setCreating(null)} />
        )}

        {filtered.length === 0 && !creating ? (
          <div style={{ padding: `0 ${space[2]}px`, fontSize: 12, color: colors.textDim }}>
            {q ? 'No matching files.' : 'No notes yet.'}
          </div>
        ) : (
          folderNames.map(folder => {
            const isRoot = folder === '_root'
            const isCollapsed = collapsed[folder]
            const folderNotes = sortNotes(groups[folder], sort)
            return (
              <div key={folder}>
                {/* Folder header */}
                {!isRoot && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button type="button" onClick={() => toggleFolder(folder)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1,
                        padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left' }}>
                      <span style={{ display: 'inline-block', transition: 'transform 0.15s ease',
                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', color: colors.textMuted }}>
                        <Icon name="chevron-right" size={10} />
                      </span>
                      <Icon name="folder" size={12} style={{ color: colors.textMuted }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted,
                        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {folder}
                      </span>
                    </button>
                    <button type="button" title="New file in folder" style={{ ...tb, padding: 2, marginRight: 4 }}
                      onClick={() => setCreating({ type: 'file', folder })}>
                      <Icon name="file-plus" size={10} />
                    </button>
                  </div>
                )}

                {/* Notes */}
                {!isCollapsed && folderNotes.map(note => {
                  const active = note.id === activeId
                  return (
                    <button key={note.id} type="button" onClick={() => onOpenNote(note.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: `4px ${isRoot ? 12 : 24}px`,
                        background: active ? colors.bg : 'transparent',
                        border: 'none',
                        borderLeft: active ? `2px solid ${colors.accent}` : '2px solid transparent',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'background 120ms ease-out' }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = colors.bg }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <StarIcon species={note.species} size="sm" />
                      <span style={{ color: active ? colors.text : colors.textMuted, fontSize: 13,
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: active ? 500 : 400 }}>
                        {note.title}
                      </span>
                    </button>
                  )
                })}

                {/* Inline creation inside folder */}
                {creating && creating.folder === folder && !isCollapsed && (
                  <InlineInput isFolder={creating.type === 'folder'}
                    placeholder={creating.type === 'folder' ? 'Folder name...' : 'Note name...'}
                    onSubmit={creating.type === 'folder' ? handleCreateFolder : handleCreateFile}
                    onCancel={() => setCreating(null)} />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: `${space[1]}px ${space[2]}px`, borderTop: `1px solid ${colors.border}`,
        fontSize: 11, color: colors.textDim }}>
        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </div>
    </div>
  )
}

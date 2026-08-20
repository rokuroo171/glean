import { useMemo, useRef, useState, useEffect } from 'react'
import { colors, space, typography } from '../lib/theme'
import StarIcon from './StarIcon'
import Icon from './Icon'

/* ------------------------------------------------------------------ */
/* Tree data structure                                                 */
/* ------------------------------------------------------------------ */

function buildTree(notes) {
  const root = { folders: {}, notes: [] }
  for (const n of notes) {
    const parts = (n.folder || '').split('/').filter(Boolean)
    let node = root
    for (const part of parts) {
      if (!node.folders[part]) node.folders[part] = { folders: {}, notes: [] }
      node = node.folders[part]
    }
    node.notes.push(n)
  }
  return root
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

function sortFolders(folders, sort) {
  return Object.keys(folders).sort((a, b) => a.localeCompare(b))
}

/* ------------------------------------------------------------------ */
/* Inline input for creating a file or folder                          */
/* ------------------------------------------------------------------ */

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
      <Icon name={isFolder ? 'folder' : 'file-text'} size={13}
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

/* ------------------------------------------------------------------ */
/* Recursive folder tree node                                          */
/* ------------------------------------------------------------------ */

function FolderNode({ name, node, depth, activeId, sort, collapsed, toggleFolder,
  onOpenNote, creating, setCreating, onCreateFile }) {
  const path = depth === 0 ? name : `${name}`
  const isCollapsed = collapsed[name]
  const children = sortFolders(node.folders, sort)
  const notes = sortNotes(node.notes, sort)
  const indent = depth * 16

  return (
    <div>
      {/* Folder header row */}
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <button type="button" onClick={() => toggleFolder(name)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1,
            padding: `4px ${8 + indent}px`, background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ display: 'inline-block', transition: 'transform 0.15s ease',
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            color: colors.textMuted, flexShrink: 0 }}>
            <Icon name="chevron-right" size={10} />
          </span>
          <Icon name={isCollapsed ? 'folder' : 'folder-open'} size={13}
            style={{ color: colors.accentWarm, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: colors.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
        </button>
        <button type="button" title="New file in folder"
          style={{ background: 'none', border: 'none', color: colors.textMuted,
            cursor: 'pointer', padding: 2, marginRight: 6, borderRadius: 3,
            display: 'none', // shown on hover via CSS
            alignItems: 'center', justifyContent: 'center' }}
          className="folder-add-btn"
          onClick={(e) => { e.stopPropagation(); setCreating({ type: 'file', folder: name }) }}>
          <Icon name="file-plus" size={10} />
        </button>
      </div>

      {/* Children: notes and subfolders */}
      {!isCollapsed && (
        <div>
          {/* Notes in this folder */}
          {sortNotes(node.notes, sort).map(note => (
            <NoteRow key={note.id} note={note} depth={depth + 1} activeId={activeId}
              onOpenNote={onOpenNote} />
          ))}

          {/* Inline file creation */}
          {creating && creating.folder === name && creating.type === 'file' && (
            <div style={{ paddingLeft: 8 + (depth + 1) * 16 }}>
              <InlineInput isFolder={false} placeholder="Note name..."
                onSubmit={(n) => onCreateFile(n, name)}
                onCancel={() => setCreating(null)} />
            </div>
          )}

          {/* Subfolders */}
          {sortFolders(node.folders, sort).map(subName => (
            <FolderNode key={subName} name={subName} node={node.folders[subName]}
              depth={depth + 1} activeId={activeId} sort={sort}
              collapsed={collapsed} toggleFolder={toggleFolder}
              onOpenNote={onOpenNote} creating={creating}
              setCreating={setCreating} onCreateFile={onCreateFile} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Note row                                                            */
/* ------------------------------------------------------------------ */

function NoteRow({ note, depth, activeId, onOpenNote }) {
  const active = note.id === activeId
  const indent = depth * 16

  return (
    <button type="button" onClick={() => onOpenNote(note.id)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        padding: `4px ${8 + indent}px`,
        background: active ? 'rgba(91, 159, 212, 0.08)' : 'transparent',
        border: 'none',
        borderLeft: active ? `2px solid ${colors.accent}` : '2px solid transparent',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 120ms ease-out' }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(180, 140, 80, 0.06)' }}
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
}

/* ------------------------------------------------------------------ */
/* Main FileExplorer component                                         */
/* ------------------------------------------------------------------ */

export default function FileExplorer({ notes, activeId, onOpenNote, skyName, skyPath,
  onCreateNote, onCreateFolder, onRefresh, onManageSky }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('alpha')
  const [collapsed, setCollapsed] = useState({})
  const [creating, setCreating] = useState(null) // { type: 'file'|'folder', folder: string }

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return notes
    return notes.filter(n => n.title.toLowerCase().includes(q))
  }, [notes, q])

  const tree = useMemo(() => buildTree(filtered), [filtered])

  function toggleFolder(name) {
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function collapseAll() {
    const all = {}
    function walk(node) {
      for (const f of Object.keys(node.folders)) {
        all[f] = true
        walk(node.folders[f])
      }
    }
    walk(tree)
    setCollapsed(all)
  }

  function handleCreateFile(name, folder) {
    if (onCreateNote) onCreateNote(name, folder === '_root' ? '' : folder)
    setCreating(null)
  }

  const tb = { background: 'none', border: 'none', color: colors.textMuted,
    cursor: 'pointer', padding: 3, display: 'flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: 4 }
  const tbHover = { background: 'rgba(90, 106, 122, 0.15)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: `${space[2]}px ${space[2]}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6 }}>
          <div style={{ ...typography.sectionLabel, color: colors.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
            {skyName || 'Sky'}
          </div>
        </div>

        {/* Toolbar */}
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
            onClick={() => { if (onCreateFolder) onCreateFolder() }}>
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

        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter files..."
          style={{ width: '100%', background: colors.bg, color: colors.text,
            border: `1px solid ${colors.border}`, borderRadius: 6,
            padding: '5px 10px', fontSize: 12, outline: 'none',
            boxSizing: 'border-box' }} />
      </div>

      {/* File tree */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `${space[1]}px 0` }}>
        {/* Inline creation at root */}
        {creating && creating.folder === '_root' && creating.type === 'file' && (
          <InlineInput isFolder={false} placeholder="Note name..."
            onSubmit={(n) => handleCreateFile(n, '_root')}
            onCancel={() => setCreating(null)} />
        )}


        {filtered.length === 0 && !creating ? (
          <div style={{ padding: `0 ${space[2]}px`, fontSize: 12, color: colors.textDim }}>
            {q ? 'No matching files.' : 'No notes yet.'}
          </div>
        ) : (
          <>
            {/* Root notes (no folder) */}
            {sortNotes(tree.notes, sort).map(note => (
              <NoteRow key={note.id} note={note} depth={0} activeId={activeId}
                onOpenNote={onOpenNote} />
            ))}

            {/* Nested folders */}
            {sortFolders(tree.folders, sort).map(name => (
              <FolderNode key={name} name={name} node={tree.folders[name]}
                depth={0} activeId={activeId} sort={sort}
                collapsed={collapsed} toggleFolder={toggleFolder}
                onOpenNote={onOpenNote} creating={creating}
                setCreating={setCreating} onCreateFile={handleCreateFile} />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: `${space[1]}px ${space[2]}px`,
        borderTop: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </div>
        {/* Sky picker row */}
        <button type="button" onClick={onManageSky}
          style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            padding: '4px 6px', background: 'rgba(180, 140, 80, 0.06)',
            border: `1px solid ${colors.border}`, borderRadius: 6,
            cursor: 'pointer', fontSize: 12,
            transition: 'background 160ms ease-out, border-color 160ms ease-out' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(180, 140, 80, 0.12)'; e.currentTarget.style.borderColor = colors.borderStrong }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(180, 140, 80, 0.06)'; e.currentTarget.style.borderColor = colors.border }}
        >
          <Icon name="sparkles" size={12} style={{ color: colors.accentWarm }} />
          <span style={{ color: colors.text, fontWeight: 500, flex: 1, textAlign: 'left',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {skyName || 'Sky'}
          </span>
          <Icon name="chevron-right" size={10} style={{ color: colors.textMuted, transform: 'rotate(90deg)' }} />
        </button>
      </div>
    </div>
  )
}

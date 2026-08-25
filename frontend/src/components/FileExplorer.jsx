import { useMemo, useRef, useState, useEffect } from 'react'
import { colors, space, typography } from '../lib/theme'
import StarIcon from './StarIcon'
import Icon from './Icon'
import ContextMenu from './ContextMenu'

const wails = window.go?.main

// --- Tree data structure ---

function buildTree(notes, folderList) {
  const root = { folders: {}, notes: [] }

  for (const f of (folderList || [])) {
    // Normalize Windows backslashes to forward slashes
    const parts = f.replace(/\\/g, '/').split('/').filter(Boolean)
    let node = root
    for (const part of parts) {
      if (!node.folders[part]) node.folders[part] = { folders: {}, notes: [] }
      node = node.folders[part]
    }
  }

  for (const n of notes) {
    const parts = (n.folder || '').replace(/\\/g, '/').split('/').filter(Boolean)
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

// --- Inline input ---

function InlineInput({ isFolder, placeholder, initialValue, onSubmit, onCancel }) {
  const [value, setValue] = useState(initialValue || '')
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.focus()
    // Select all text for rename mode
    if (initialValue) ref.current?.select()
  }, [])

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

// --- Folder tree node ---

function FolderNode({ name, node, depth, activeId, sort, collapsed, toggleFolder,
  onOpenNote, creating, setCreating, onCreateFile, onCreateFolder, parentPath,
  renaming, onRename, onStartRename, onDelete, moveItems,
  folderRenaming, setFolderRenaming, onRenameFolder, onDeleteFolder }) {
  const fullPath = parentPath ? `${parentPath}/${name}` : name
  const isCollapsed = collapsed[fullPath]
  const children = sortFolders(node.folders, sort)
  const notes = sortNotes(node.notes, sort)
  const indent = depth * 12
  const isRenamingFolder = folderRenaming && folderRenaming.path === fullPath

  return (
    <div>
      <ContextMenu items={[
        { id: 'open', label: isCollapsed ? 'Expand' : 'Collapse', icon: 'folder-open',
          onSelect: () => toggleFolder(fullPath) },
        { id: 'sep1', type: 'separator' },
        { id: 'new-file', label: 'New note here', icon: 'file-plus',
          onSelect: () => setCreating({ type: 'file', folder: fullPath }) },
        { id: 'new-folder', label: 'New folder here', icon: 'folder-plus',
          onSelect: () => setCreating({ type: 'folder', folder: fullPath }) },
        { id: 'sep2', type: 'separator' },
        { id: 'rename', label: 'Rename', icon: 'pencil',
          onSelect: () => setFolderRenaming({ path: fullPath, name }) },
        { id: 'copy-name', label: 'Copy name', icon: 'copy',
          onSelect: () => navigator.clipboard?.writeText(name).catch(() => {}) },
        { id: 'sep3', type: 'separator' },
        { id: 'delete', label: 'Delete folder', icon: 'trash',
          onSelect: () => onDeleteFolder(fullPath) },
      ]}>
      {isRenamingFolder ? (
        <div style={{ padding: `4px ${8 + indent}px` }}>
          <InlineInput isFolder={true} placeholder="Folder name..." initialValue={name}
            onSubmit={(n) => onRenameFolder(fullPath, n)}
            onCancel={() => setFolderRenaming(null)} />
        </div>
      ) : (
      <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}
        className="folder-row"
        onMouseEnter={(e) => { e.currentTarget.querySelectorAll('.folder-add-btn').forEach(b => b.style.display = 'flex') }}
        onMouseLeave={(e) => { e.currentTarget.querySelectorAll('.folder-add-btn').forEach(b => b.style.display = 'none') }}>
        <button type="button" onClick={() => toggleFolder(fullPath)}
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
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 40 }}>
            {name}
          </span>
        </button>
        <button type="button"
          className="folder-add-btn"
          data-tip="New file"
          style={{ display: 'none', background: 'none', border: 'none', color: colors.textMuted,
            cursor: 'pointer', padding: 3, marginRight: 2, borderRadius: 3,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); setCreating({ type: 'file', folder: fullPath }) }}>
          <Icon name="file-plus" size={12} />
        </button>
        <button type="button"
          className="folder-add-btn"
          data-tip="New folder"
          style={{ display: 'none', background: 'none', border: 'none', color: colors.textMuted,
            cursor: 'pointer', padding: 3, marginRight: 6, borderRadius: 3,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); setCreating({ type: 'folder', folder: fullPath }) }}>
          <Icon name="folder-plus" size={12} />
        </button>
      </div>
      )}
      </ContextMenu>

      {!isCollapsed && (
        <div>
          {sortNotes(node.notes, sort).map(note => (            <NoteRow key={note.id} note={note} depth={depth + 1} activeId={activeId}
              onOpenNote={onOpenNote} renaming={renaming} onRename={onRename}
              onStartRename={onStartRename} onDelete={onDelete}
              moveItems={moveItems} />
          ))}

          {creating && creating.folder === fullPath && creating.type === 'file' && (
            <div style={{ paddingLeft: 8 + (depth + 1) * 16 }}>
              <InlineInput isFolder={false} placeholder="Note name..."
                onSubmit={(n) => onCreateFile(n, fullPath)}
                onCancel={() => setCreating(null)} />
            </div>
          )}

          {creating && creating.folder === fullPath && creating.type === 'folder' && (
            <div style={{ paddingLeft: 8 + (depth + 1) * 16 }}>
              <InlineInput isFolder={true} placeholder="Folder name, or A/B/C for nested"
                onSubmit={(n) => { if (onCreateFolder) onCreateFolder(n, fullPath); setCreating(null) }}
                onCancel={() => setCreating(null)} />
            </div>
          )}

          {sortFolders(node.folders, sort).map(subName => (
            <FolderNode key={subName} name={subName} node={node.folders[subName]}
              depth={depth + 1} activeId={activeId} sort={sort}
              collapsed={collapsed} toggleFolder={toggleFolder}
              onOpenNote={onOpenNote} creating={creating}
              setCreating={setCreating} onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder} parentPath={fullPath}
              renaming={renaming} onRename={onRename}
              onStartRename={onStartRename} onDelete={onDelete}
              folderRenaming={folderRenaming} setFolderRenaming={setFolderRenaming}
              onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder}
              moveItems={moveItems} />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Note row ---

function NoteRow({ note, depth, activeId, onOpenNote, renaming, onRename, onStartRename, onDelete, moveItems }) {
  const active = note.id === activeId
  const indent = depth * 12
  const isRenaming = renaming && renaming.id === note.id

  const items = [
    { id: 'open', label: 'Open', icon: 'file-text', onSelect: () => onOpenNote(note.id) },
    { id: 'rename', label: 'Rename', icon: 'pencil', shortcut: 'F2',
      onSelect: () => onStartRename && onStartRename(note) },
    { id: 'copy-name', label: 'Copy name', icon: 'copy',
      onSelect: () => navigator.clipboard?.writeText(note.title).catch(() => {}) },
  ]
  const moveList = typeof moveItems === 'function' ? (moveItems(note) || []) : []
  if (moveList.length > 0) {
    items.push({ id: 'sep-move', type: 'separator' })
    items.push(...moveList.map((m, i) => ({
      ...m,
      id: `move-${i}`,
      label: `Move to ${m.label}`,
    })))
  }
  items.push({ id: 'sep', type: 'separator' })
  items.push({ id: 'delete', label: 'Delete', icon: 'trash',
    onSelect: () => onDelete && onDelete(note.id) })

  return (
    <ContextMenu items={items} triggerStyle={{ display: 'contents' }}>
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
        flex: 1, minWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontWeight: active ? 500 : 400 }}>
        {note.title}
      </span>
    </button>
    </ContextMenu>
  )
} 

// --- FileExplorer ---

export default function FileExplorer({ notes, activeId, onOpenNote, skyName, skyPath,
  onCreateNote, onCreateFolder, onRefresh, onManageSky, onDelete, folders }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('alpha')
  const [collapsed, setCollapsed] = useState({})
  const [creating, setCreating] = useState(null)
  const [renaming, setRenaming] = useState(null) // { id, title, folder }
  const [folderRenaming, setFolderRenaming] = useState(null) // { path, name }
  const [localFolders, setLocalFolders] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // folder path awaiting delete confirmation
  // Prefer the folder list passed from the parent; fall back to our own scan.
  const folderList = folders || localFolders

  // F2 key to rename selected note
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'F2' && activeId && !creating && !renaming) {
        e.preventDefault()
        const note = notes.find(n => n.id === activeId)
        if (note) setRenaming({ id: note.id, title: note.title, folder: note.folder })
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [activeId, notes, creating, renaming])

  // Fetch folders directly inside this component to bypass stale closures
  const fetchFolders = async () => {
    if (!wails) return
    try {
      const f = await wails.App.ListFolders()
      setLocalFolders(f || [])
    } catch { /* ignore */ }
  }

  // Load folders on mount
  useEffect(() => { fetchFolders() }, [])

  // Re-fetch folders whenever notes change (new file/folder created)
  useEffect(() => { fetchFolders() }, [notes])

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return notes
    return notes.filter(n => n.title.toLowerCase().includes(q))
  }, [notes, q])

  const tree = useMemo(() => buildTree(filtered, localFolders), [filtered, localFolders])

  function toggleFolder(name) {
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }))
  }

  function collapseAll() {
    const all = {}
    function walk(node, prefix) {
      for (const f of Object.keys(node.folders)) {
        const path = prefix ? `${prefix}/${f}` : f
        all[path] = true
        walk(node.folders[f], path)
      }
    }
    walk(tree, '')
    setCollapsed(all)
  }

  function handleCreateFile(name, folder) {
    if (onCreateNote) onCreateNote(name, folder === '_root' ? '' : folder)
    setCreating(null)
  }

  function handleCreateFolder(name, parentPath) {
    if (onCreateFolder) onCreateFolder(name, parentPath || '')
    setCreating(null)
    setTimeout(fetchFolders, 100)
  }

  // Move-to targets for a note: every folder except its current one.
  function moveItemsFor(note) {
    if (!wails) return []
    const current = (note.folder || '').replace(/\\/g, '/')
    return folderList
      .filter(f => f !== current)
      .map(f => ({ label: f, onSelect: () => {
        wails.App.MoveNote(note.id, f)
          .then(() => { if (onRefresh) onRefresh() })
          .catch(err => { if (window.alert) window.alert(String(err)) })
      } }))
  }

  function handleRename(newTitle) {
    if (!renaming || !newTitle || newTitle === renaming.title) { setRenaming(null); return }
    if (wails) {
      wails.App.SaveNote(renaming.id, newTitle, '')
        .then(() => onRefresh && onRefresh())
        .catch(() => {})
    }
    setRenaming(null)
  }

  function handleRenameFolder(path, newName) {
    setFolderRenaming(null)
    if (!wails || !newName || newName === path.split('/').pop()) return
    wails.App.RenameFolder(path, newName)
      .then(async () => { await fetchFolders(); if (onRefresh) onRefresh() })
      .catch((err) => { if (window.confirm && err && err.length) window.alert(String(err)) })
  }

  function handleDeleteFolder(path) {
    setConfirmDelete(path)
  }

  function confirmDeleteFolder() {
    const path = confirmDelete
    setConfirmDelete(null)
    if (!path) return
    if (wails) {
      wails.App.DeleteFolder(path)
        .then(async () => { await fetchFolders(); if (onRefresh) onRefresh() })
        .catch((err) => { if (window.alert) window.alert(String(err)) })
    }
  }

  async function handleRefresh() {
    if (!onRefresh && !wails) return
    setRefreshing(true)
    if (onRefresh) await onRefresh()
    await fetchFolders()
    setTimeout(() => setRefreshing(false), 300)
  }

  const tb = { background: 'none', border: 'none', color: colors.textMuted,
    cursor: 'pointer', padding: 3, display: 'flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: 4 }
  const tbHover = { background: 'rgba(90, 106, 122, 0.15)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: `${space[2]}px ${space[2]}px 0`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.accent,
              letterSpacing: '-0.02em' }}>
              Glean
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6 }}>
          <div style={{ ...typography.sectionLabel, color: colors.textMuted,
            letterSpacing: '0.08em', fontSize: 11, textTransform: 'none' }}>
            {skyName || 'Sky'}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 6, minWidth: 0 }}>
          <button type="button" data-tip="New file" data-tour="new-file" style={tb}
            onMouseEnter={e => Object.assign(e.currentTarget.style, tbHover)}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            onClick={() => setCreating({ type: 'file', folder: '_root' })}>
            <Icon name="file-plus" size={13} />
          </button>
          <button type="button" data-tip="New folder" style={tb}
            onMouseEnter={e => Object.assign(e.currentTarget.style, tbHover)}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            onClick={() => setCreating({ type: 'folder', folder: '_root' })}>
            <Icon name="folder-plus" size={13} />
          </button>
          {onRefresh && (
            <button type="button" data-tip="Refresh" style={{ ...tb, transition: 'transform 0.3s ease', transform: refreshing ? 'rotate(360deg)' : 'none' }}
              onMouseEnter={e => Object.assign(e.currentTarget.style, tbHover)}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              onClick={handleRefresh}>
              <Icon name="refresh-cw" size={13} />
            </button>
          )}
          <button type="button" data-tip="Collapse all" style={tb}
            onMouseEnter={e => Object.assign(e.currentTarget.style, tbHover)}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            onClick={collapseAll}>
            <Icon name="layout-list" size={13} />
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" data-tip={sort === "alpha" ? "Sort by recent" : "Sort A-Z"} style={{ ...tb, padding: 2 }}
            onClick={() => setSort(s => s === 'alpha' ? 'recent' : 'alpha')}>
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
      <ContextMenu triggerStyle={{ display: 'contents' }} items={[
        { id: 'new-file', label: 'New note', icon: 'file-plus',
          onSelect: () => setCreating({ type: 'file', folder: '_root' }) },
        { id: 'new-folder', label: 'New folder', icon: 'folder-plus',
          onSelect: () => setCreating({ type: 'folder', folder: '_root' }) },
        { id: 'sep1', type: 'separator' },
        { id: 'sort-alpha', label: 'Sort A-Z',
          onSelect: () => setSort('alpha'),
          shortcut: sort === 'alpha' ? '\u2022' : '' },
        { id: 'sort-recent', label: 'Sort by recent',
          onSelect: () => setSort('recent'),
          shortcut: sort === 'recent' ? '\u2022' : '' },
        { id: 'sep2', type: 'separator' },
        { id: 'collapse', label: 'Collapse all', icon: 'layout-list',
          onSelect: collapseAll },
        { id: 'refresh', label: 'Refresh', icon: 'refresh-cw',
          onSelect: handleRefresh },
      ]}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `${space[1]}px 0` }}>
        {/* Inline creation at root */}
        {creating && creating.folder === '_root' && creating.type === 'file' && (
          <InlineInput isFolder={false} placeholder="Note name..."
            onSubmit={(n) => handleCreateFile(n, '_root')}
            onCancel={() => setCreating(null)} />
        )}
        {creating && creating.folder === '_root' && creating.type === 'folder' && (
          <InlineInput isFolder={true} placeholder="Folder name, or A/B/C for nested"
            onSubmit={(n) => { if (onCreateFolder) onCreateFolder(n, ''); setCreating(null); setTimeout(fetchFolders, 100) }}
            onCancel={() => setCreating(null)} />
        )}

        {filtered.length === 0 && Object.keys(tree.folders).length === 0 && !creating ? (
          <div style={{ padding: `0 ${space[2]}px`, fontSize: 12, color: colors.textDim }}>
            {q ? 'No matching files.' : 'No notes yet.'}
          </div>
        ) : (
          <>
            {sortNotes(tree.notes, sort).map(note => (
              <NoteRow key={note.id} note={note} depth={0} activeId={activeId}
                onOpenNote={onOpenNote} renaming={renaming} onRename={handleRename}
                onStartRename={(n) => setRenaming({ id: n.id, title: n.title, folder: n.folder })}
                onDelete={onDelete} moveItems={moveItemsFor} />
            ))}

            {sortFolders(tree.folders, sort).map(name => (
              <FolderNode key={name} name={name} node={tree.folders[name]}
                depth={0} activeId={activeId} sort={sort}
                collapsed={collapsed} toggleFolder={toggleFolder}
                onOpenNote={onOpenNote} creating={creating}
                setCreating={setCreating} onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder} parentPath=""
                renaming={renaming} onRename={handleRename}
                onStartRename={(n) => setRenaming({ id: n.id, title: n.title, folder: n.folder })}
                onDelete={onDelete}
                folderRenaming={folderRenaming} setFolderRenaming={setFolderRenaming}
                onRenameFolder={handleRenameFolder} onDeleteFolder={handleDeleteFolder}
                moveItems={moveItemsFor} />
            ))}
          </>
        )}
      </div>
      </ContextMenu>

      {/* Footer */}
      <div style={{ padding: `${space[1]}px ${space[2]}px`,
        borderTop: `1px solid ${colors.border}` }}>
        <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </div>
        <button type="button" data-tour="manage-sky" onClick={onManageSky}
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

      {/* Themed delete-folder confirmation (replaces the native browser dialog) */}
      {confirmDelete && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(5, 8, 14, 0.6)',
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{
              background: colors.bgElevated,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: 10,
              padding: '18px 20px',
              maxWidth: 360,
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
              Delete folder
            </div>
            <div style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.5, marginBottom: 16 }}>
              Delete folder "{confirmDelete.split('/').pop()}" and everything inside it?
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                style={{
                  background: 'none', border: `1px solid ${colors.borderStrong}`,
                  color: colors.textMuted, borderRadius: 6, padding: '6px 12px',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteFolder}
                style={{
                  background: '#b05050', border: 'none', color: '#fff',
                  borderRadius: 6, padding: '6px 14px', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

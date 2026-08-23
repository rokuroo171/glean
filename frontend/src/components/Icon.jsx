import {
  BarChart3, ChevronLeft, ChevronRight, Columns3, Eye, FilePlus, FolderPlus,
  Folder, FolderOpen, LayoutList, Maximize, Moon, Palette,
  PanelRight, Pencil, Plus, RefreshCw, Search, Settings, Sparkle, Sparkles,
  Trash, X, Zap, FileText, Scissors, Copy, ClipboardPaste,
  Bold, Italic, Link, Table, Code, Quote,
} from 'lucide-react'

const iconMap = {
  'bar-chart': BarChart3,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'file-plus': FilePlus,
  'folder-plus': FolderPlus,
  'folder': Folder,
  'folder-open': FolderOpen,
  'layout-list': LayoutList,
  'maximize': Maximize,
  'moon': Moon,
  'palette': Palette,
  'panel-right': PanelRight,
  'plus': Plus,
  'refresh-cw': RefreshCw,
  'search': Search,
  'settings': Settings,
  'sparkle': Sparkle,
  'sparkles': Sparkles,
  'trash': Trash,
  'x': X,
  'zap': Zap,
  'file-text': FileText,
  'scissors': Scissors,
  'copy': Copy,
  'paste': ClipboardPaste,
  'bold': Bold,
  'italic': Italic,
  'link': Link,
  'table': Table,
  'code': Code,
  'quote': Quote,
  'pencil': Pencil,
  'columns': Columns3,
  'eye': Eye,
}

export default function Icon({ name, size = 16, className, style, ...rest }) {
  const Comp = iconMap[name]
  if (!Comp) return null
  return <Comp size={size} className={className} style={style} {...rest} />
}

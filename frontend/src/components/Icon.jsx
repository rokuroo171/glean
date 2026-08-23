/**
 * Centralized icon component. SVG paths sourced from Lucide Icons
 * (https://lucide.dev) -- ISC License, copyright Lucide Contributors.
 *
 * Usage: <Icon name="settings" size={16} />
 *
 * Every icon is a single <svg> with a 24x24 viewBox and stroke-based
 * paths. Only the icons actually used in the app are included here;
 * nothing is tree-shaken out because they are all referenced.
 */

const paths = {
  settings: [
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  x: [
    'M18 6 6 18',
    'M6 6l12 12',
  ],
  plus: [
    'M5 12h14',
    'M12 5v14',
  ],
  search: [
    'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
    'M21 21l-4.35-4.35',
  ],
  sparkle: [
    'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z',
    'M19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z',
  ],
  trash: [
    'M3 6h18',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
    'M10 11v6',
    'M14 11v6',
  ],
  pencil: [
    'M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  ],
  eye: [
    'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
  'chevron-left': [
    'M15 18l-6-6 6-6',
  ],
  'chevron-right': [
    'M9 18l6-6-6-6',
  ],
  'panel-left': [
    'M3 3h7v18H3z',
    'M13 8l5 4-5 4',
  ],
  'panel-right': [
    'M21 3h-7v18h7z',
    'M11 8l-5 4 5 4',
  ],
  'maximize': [
    'M8 3H5a2 2 0 0 0-2 2v3',
    'M21 8V5a2 2 0 0 0-2-2h-3',
    'M3 16v3a2 2 0 0 0 2 2h3',
    'M16 21h3a2 2 0 0 0 2-2v-3',
  ],
  star: [
    'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z',
  ],
  // Lucide sparkles -- stars / sky view icon.
  // https://lucide.dev/icons/sparkles -- ISC License.
  sparkles: [
    'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z',
    'M20 2v4',
    'M22 4h-4',
    'M4 20m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  ],
  // Lucide file-plus -- new file icon.
  // https://lucide.dev/icons/file-plus
  'file-plus': [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M9 15h6',
    'M12 18v-6',
  ],
  // Lucide folder-plus -- new folder icon.
  // https://lucide.dev/icons/folder-plus
  'folder-plus': [
    'M12 10v6',
    'M9 13h6',
    'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
  ],
  // Lucide refresh-cw -- refresh icon.
  // https://lucide.dev/icons/refresh-cw
  'refresh-cw': [
    'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
    'M21 3v5h-5',
    'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
    'M8 16H3v5',
  ],
  // Lucide layout-list -- collapse all / list view.
  // https://lucide.dev/icons/layout-list
  'layout-list': [
    'M3 5h18',
    'M3 12h18',
    'M3 19h18',
  ],
  // Lucide file -- generic file icon.
  // https://lucide.dev/icons/file
  'file': [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
  ],
  // Lucide folder -- generic folder icon.
  // https://lucide.dev/icons/folder
  'folder': [
    'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
  ],
  // Lucide folder-open -- expanded folder icon.
  // https://lucide.dev/icons/folder-open
  'folder-open': [
    'm6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2',
  ],
  // Lucide columns-2 -- split view icon.
  // https://lucide.dev/icons/columns-2
  'columns': [
    'M12 5v14',
    'M18 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
  ],
  // Lucide file-text -- markdown/text file icon.
  // https://lucide.dev/icons/file-text
  'file-text': [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M10 9H8',
    'M16 13H8',
    'M16 17H8',
  ],
  // Lucide palette -- customization / theme icon.
  // https://lucide.dev/icons/palette
  palette: [
    'M13.5 6.5a4.5 4.5 0 0 0-9 0c0 4 4.5 4.5 4.5 9a4.5 4.5 0 0 0 9 0c0-4.5-4.5-4.5-4.5-9z',
    'M12 2a3 3 0 0 0-3 3c0 1.1.9 2 2 2h1a3 3 0 0 0 3-3 3 3 0 0 0-3-3z',
  ],
  // Lucide bar-chart-2 -- stats icon.
  // https://lucide.dev/icons/bar-chart-2
  'bar-chart': [
    'M18 20V10',
    'M12 20V4',
    'M6 20v-6',
  ],
  // Lucide clock -- time display.
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  // Lucide monitor -- layout/display icon.
  monitor: [
    'M2 3h20v14H2z',
    'M8 21h8',
    'M12 17v4',
  ],
  // Lucide type -- font/text icon.
  type: [
    'M4 7V4h16v3',
    'M9 20h6',
    'M12 4v16',
  ],
  // Lucide zap -- cursor trail / effect icon.
  zap: [
    'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  ],
  // Lucide scissors -- cut icon.
  // https://lucide.dev/icons/scissors
  scissors: [
    'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M20 4 8.12 15.88',
    'M14.47 14.48 20 20',
    'M8.12 8.12 12 12',
  ],
  // Lucide copy -- copy icon.
  // https://lucide.dev/icons/copy
  copy: [
    'M8 8h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z',
    'M4 4h10a2 2 0 0 1 2 2v1',
  ],
  // Lucide clipboard -- paste icon.
  // https://lucide.dev/icons/clipboard
  paste: [
    'M9 5h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    'M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2',
  ],
  // Lucide bold -- bold icon.
  // https://lucide.dev/icons/bold
  bold: [
    'M14 12a4 4 0 0 0 0-8H6v8',
    'M15 20a4 4 0 0 0 0-8H6v8',
  ],
  // Lucide italic -- italic icon.
  // https://lucide.dev/icons/italic
  italic: [
    'M19 4h-9',
    'M14 20H5',
    'M15 4 9 20',
  ],
  // Lucide link -- insert link icon.
  // https://lucide.dev/icons/link
  link: [
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ],
  // Lucide table -- insert table icon.
  // https://lucide.dev/icons/table
  table: [
    'M3 3h18v18H3z',
    'M3 12h18',
    'M12 3v18',
  ],
  // Lucide code -- code block icon.
  // https://lucide.dev/icons/code
  code: [
    'M16 18l6-6-6-6',
    'M8 6l-6 6 6 6',
  ],
  // Lucide text-quote -- blockquote icon.
  // https://lucide.dev/icons/text-quote
  quote: [
    'M17 7H3',
    'M21 12H8',
    'M21 18H8',
    'M3 12v6',
  ],
  // Lucide moon -- night/home tab icon.
  moon: [
    'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  ],
}

export default function Icon({ name, size = 16, className, style, ...rest }) {
  const d = paths[name]
  if (!d) return null
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

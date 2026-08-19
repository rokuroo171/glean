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

  // DON'T REMOVE IT! please, maybe this are lucide.dev auto genereted??? idk...

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

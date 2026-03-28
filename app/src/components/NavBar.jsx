import { NavLink } from 'react-router-dom'

const links = [
  { to: '/today',   label: 'Heute',     icon: '⏱' },
  { to: '/week',    label: 'Woche',     icon: '📅' },
  { to: '/month',   label: 'Monat',     icon: '📊' },
  { to: '/history', label: 'Verlauf',   icon: '📋' },
  { to: '/reports', label: 'Export',    icon: '📤' },
  { to: '/settings',label: 'Settings',  icon: '⚙️' },
]

export default function NavBar() {
  return (
    <nav className="bg-white border-t border-gray-200 flex justify-around py-1 shadow-sm">
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center px-2 py-1 text-xs rounded transition-colors ${
              isActive ? 'text-blue-800 font-semibold' : 'text-gray-500'
            }`
          }
        >
          <span className="text-lg leading-none">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

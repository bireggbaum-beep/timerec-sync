import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import SyncIndicator from './SyncIndicator'

export default function Layout() {
  return (
    <div className="flex flex-col h-full">
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between shadow">
        <span className="font-semibold text-lg tracking-wide">TimeRec</span>
        <SyncIndicator />
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>
      <NavBar />
    </div>
  )
}

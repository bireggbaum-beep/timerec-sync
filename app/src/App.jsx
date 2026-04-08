import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Today from './pages/Today'
import Week from './pages/Week'
import Month from './pages/Month'
import History from './pages/History'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Fristenradar from './pages/Fristenradar'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today"    element={<Today />} />
          <Route path="radar"    element={<Fristenradar />} />
          <Route path="week"     element={<Week />} />
          <Route path="month"    element={<Month />} />
          <Route path="history"  element={<History />} />
          <Route path="reports"  element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

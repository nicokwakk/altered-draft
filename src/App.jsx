import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Lobby from './pages/Lobby.jsx'
import Draft from './pages/Draft.jsx'
import Results from './pages/Results.jsx'
import Sealed from './pages/Sealed.jsx'
import AuthCallback from './pages/AuthCallback.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/room/:code" element={<Lobby />} />
      <Route path="/room/:code/draft" element={<Draft />} />
      <Route path="/room/:code/sealed" element={<Sealed />} />
      <Route path="/room/:code/results" element={<Results />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

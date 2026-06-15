import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GrainCanvas from '../components/GrainCanvas'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        localStorage.setItem('adminToken', data.token)
        navigate('/admin')
      } else {
        setError(data.message || 'Login failed')
      }
    } catch (err) {
      setError('Connection to server failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-charcoal flex items-center justify-center p-6">
      <GrainCanvas />
      
      <div className="relative z-10 w-full max-w-md bg-warm-stone/5 backdrop-blur-sm border border-white/10 p-8 md:p-10 shadow-2xl">
        <div className="mb-10 text-center">
          <span className="section-label section-label-dark" style={{ color: '#B8860B' }}>
            ADMIN ACCESS
          </span>
          <h1 className="font-display font-medium text-3xl text-white mt-4 tracking-tight">
            Bestworth Portal
          </h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-body">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-steel font-medium">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 py-3 px-4 text-white focus:outline-none focus:border-brass transition-colors font-body"
              placeholder="Enter username"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-steel font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 py-3 px-4 text-white focus:outline-none focus:border-brass transition-colors font-body"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-brass text-white font-body font-semibold tracking-widest hover:bg-brass/90 transition-all duration-300 mt-4 disabled:opacity-50"
          >
            {loading ? 'AUTHENTICATING...' : 'ENTER DASHBOARD'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => navigate('/')}
            className="text-steel hover:text-white text-xs uppercase tracking-widest transition-colors font-medium"
          >
            ← Back to Public Site
          </button>
        </div>
      </div>
    </div>
  )
}

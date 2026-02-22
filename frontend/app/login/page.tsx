'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { ArrowLeft, Loader2, LogIn } from 'lucide-react'
import { authAPI } from '@/lib/api'
import { saveAuth } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please enter your Host ID.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const response = await authAPI.login({
        email: email.trim(),
        password,
      })

      saveAuth(response.data.access_token, response.data.user)
      localStorage.setItem('hostName', response.data.user.full_name)

      router.push('/host')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to login.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="btn-secondary mb-4 inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="card">
          <h1 className="text-3xl font-bold mb-1">Welcome Back</h1>
          <p className="text-white/60 mb-6">Login to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-white/80">Host ID</label>
              <input
                type="text"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tester01 or admin"
              />
              <p className="text-xs text-white/55 mt-2">
                Allowed Host IDs: tester01 to tester10, and admin.
              </p>
            </div>

            <div>
              <label className="block text-sm mb-2 text-white/80">Password</label>
              <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <button disabled={loading} type="submit" className="btn-primary w-full disabled:opacity-70">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? 'Signing In...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import { authAPI } from '@/lib/api'
import { saveAuth, UserRole } from '@/lib/auth'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('host')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const passwordHint = useMemo(() => {
    if (!password) return ''
    if (password.length < 8) return 'Password must be at least 8 characters.'
    return ''
  }, [password])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (fullName.trim().length < 2) {
      setError('Please enter your full name.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const response = await authAPI.signup({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      })

      saveAuth(response.data.access_token, response.data.user)
      localStorage.setItem('hostName', response.data.user.full_name)

      router.push(role === 'host' ? '/host' : '/join')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to sign up.')
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
          <h1 className="text-3xl font-bold mb-1">Create Account</h1>
          <p className="text-white/60 mb-6">Sign up as host or joiner</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-white/80">Full Name</label>
              <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
            </div>

            <div>
              <label className="block text-sm mb-2 text-white/80">Email</label>
              <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            <div>
              <label className="block text-sm mb-2 text-white/80">Password</label>
              <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" />
              {passwordHint ? <p className="text-xs text-amber-200 mt-2">{passwordHint}</p> : null}
            </div>

            <div>
              <label className="block text-sm mb-2 text-white/80">Role</label>
              <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="host">Host</option>
                <option value="joiner">Joiner</option>
              </select>
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <button disabled={loading} type="submit" className="btn-primary w-full disabled:opacity-70">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Creating Account...' : 'Signup'}
            </button>
          </form>

          <p className="text-sm text-white/60 mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-pink-300 hover:text-pink-200">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

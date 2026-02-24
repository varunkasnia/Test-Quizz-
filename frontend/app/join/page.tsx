'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LogIn } from 'lucide-react'
import Link from 'next/link'
import { gameAPI } from '@/lib/api'
import { getAuthUser } from '@/lib/auth'

export default function JoinPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [pinFromUrl, setPinFromUrl] = useState<string | null>(null) // For direct join via QR/link
  const [name, setName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('pin') || ''
    const normalized = value.toUpperCase()
    if (normalized) {
      setCode(normalized)
      setPinFromUrl(normalized)
    }

    const authUser = getAuthUser()
    if (authUser) {
      setName((prev) => prev || authUser.full_name)
      if (authUser.role === 'host') {
        router.replace('/host')
      }
    }
  }, [router])

  const isDirectJoin = !!pinFromUrl // Direct join via QR/direct link - no code input needed
  const effectivePin = isDirectJoin ? pinFromUrl! : code.trim().toUpperCase()

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isDirectJoin) {
      // Direct Join: only Name + Roll Number required (pin from URL)
      if (!name.trim() || !rollNumber.trim()) {
        alert('Please enter Name and Roll Number')
        return
      }
      if (!effectivePin || !/^[A-Za-z0-9]{6}$/.test(effectivePin)) {
        alert('Invalid join link. Please use the link or QR code shared by the host.')
        return
      }
    } else {
      // Unique Code Join: all three required
      if (!code.trim() || !name.trim() || !rollNumber.trim()) {
        alert('Please enter Name, Roll Number, and Given Code')
        return
      }
      if (!/^[A-Za-z0-9]{6}$/.test(code.trim())) {
        alert('Code must be 6 alphanumeric characters')
        return
      }
    }

    setLoading(true)
    try {
      const normalizedCode = effectivePin
      const payload = { pin: normalizedCode, name: name.trim(), roll_number: rollNumber.trim() }
      const response = await gameAPI.join(payload)
      localStorage.setItem('playerId', response.data.id.toString())
      localStorage.setItem('playerName', name.trim())
      localStorage.setItem('playerRollNumber', rollNumber.trim())
      localStorage.setItem('joinedPin', normalizedCode)
      router.push(`/join/game?pin=${normalizedCode}`)
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Invalid code or failed to join session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="btn-secondary mb-6 inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h1 className="text-3xl font-bold mb-2 text-center">Join a Quiz</h1>
          <p className="text-white/60 text-center mb-7">
            {isDirectJoin
              ? 'Enter your details to join (no code needed)'
              : 'Enter your details and given code'}
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Roll Number</label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="E.g., 2301730326"
                className="input-field"
              />
            </div>

            {!isDirectJoin && (
              <div>
                <label className="block text-sm font-semibold mb-2">Given Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="123456"
                  maxLength={6}
                  className="input-field text-center text-2xl font-mono tracking-[0.35em]"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Joining...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Join
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, History, Play, Trash2, User, LogOut, Clock3, CircleHelp } from 'lucide-react'
import { gameAPI, quizAPI } from '@/lib/api'
import { clearAuth, getAuthUser } from '@/lib/auth'

export default function HostPage() {
  const router = useRouter()
  const [hostName, setHostName] = useState('')
  const [ready, setReady] = useState(false)

  const [quizzes, setQuizzes] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])

  const [loadingQuizzes, setLoadingQuizzes] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.role !== 'host') {
      router.replace('/login?role=host')
      return
    }

    const storedHostName = localStorage.getItem('hostName') || authUser?.full_name || ''
    setHostName(storedHostName)
    if (storedHostName) {
      localStorage.setItem('hostName', storedHostName)
    }
    setReady(true)
  }, [router])

  useEffect(() => {
    if (!ready) return
    loadQuizzes(hostName)
    if (hostName.trim()) {
      loadHistory(hostName)
    } else {
      setHistory([])
    }
  }, [hostName, ready])

  const loadQuizzes = async (name: string) => {
    setLoadingQuizzes(true)
    try {
      const response = await quizAPI.list(name.trim() || undefined)
      setQuizzes(response.data)
    } catch (error) {
      console.error('Failed to load quizzes:', error)
    } finally {
      setLoadingQuizzes(false)
    }
  }

  const loadHistory = async (name: string) => {
    setLoadingHistory(true)
    try {
      const response = await gameAPI.history(name.trim())
      setHistory(response.data)
    } catch (error) {
      console.error('Failed to load hosted history:', error)
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const persistHostName = (value: string) => {
    setHostName(value)
    localStorage.setItem('hostName', value)
  }

  const handleHostQuiz = async (quizId: number) => {
    const normalizedHost = hostName.trim()
    if (!normalizedHost) {
      alert('Enter host name first to host a quiz')
      return
    }

    setActionLoadingId(quizId)
    try {
      const response = await gameAPI.create({ quiz_id: quizId, host_name: normalizedHost })
      router.push(`/host/lobby?pin=${response.data.pin}`)
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to host quiz')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeleteQuiz = async (quizId: number) => {
    if (!window.confirm('Delete this quiz? This cannot be undone.')) return

    try {
      await quizAPI.deleteQuiz(quizId)
      setQuizzes((prev) => prev.filter((quiz) => quiz.id !== quizId))
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete quiz')
    }
  }

  const handleDeleteHostedSession = async (sessionId: number) => {
    const normalizedHost = hostName.trim()
    if (!normalizedHost) {
      alert('Enter host name first')
      return
    }

    if (!window.confirm('Delete this hosted game history entry?')) return

    try {
      await gameAPI.deleteHistory(sessionId, normalizedHost)
      setHistory((prev) => prev.filter((session) => session.id !== sessionId))
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete hosted history')
    }
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/login?role=host')
  }

  return (
    <div className="app-shell py-5 sm:py-8">
      <div className="page-wrap">
        <div className="flex items-center justify-between gap-3 mb-8">
          <Link href="/" className="btn-secondary">
            <ArrowLeft className="w-5 h-5" />
            UnAI Quizz
          </Link>

          <button onClick={handleLogout} className="btn-secondary">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="section-title">My Quizzes</h1>
            <p className="section-subtitle">Create and manage your quizzes</p>
          </div>

          <Link href="/host/create" className="btn-primary w-full md:w-auto">
            <Plus className="w-5 h-5" />
            New Quiz
          </Link>
        </div>

        <div className="card mb-6">
          <label className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Host Name
          </label>
          <input
            value={hostName}
            onChange={(e) => persistHostName(e.target.value)}
            placeholder="Enter your host name"
            className="input-field"
          />
        </div>

        {loadingQuizzes ? (
          <div className="card text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-white/60">Loading quizzes...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="card text-center py-12 mb-8">
            <p className="text-white/60 text-lg">No quizzes found for this host. Create your first one.</p>
          </div>
        ) : (
          <div className="space-y-4 mb-10">
            {quizzes.map((quiz) => (
              <motion.div key={quiz.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-2xl font-semibold truncate">{quiz.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-4 text-white/60">
                      <span className="inline-flex items-center gap-1">
                        <CircleHelp className="w-4 h-4" />
                        {quiz.question_count} questions
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="w-4 h-4" />
                        {new Date(quiz.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleHostQuiz(quiz.id)}
                      disabled={actionLoadingId === quiz.id}
                      className="btn-primary"
                    >
                      <Play className="w-4 h-4" />
                      {actionLoadingId === quiz.id ? 'Hosting...' : 'Host'}
                    </button>
                    <button
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="btn-secondary text-red-300 hover:text-red-200"
                      title="Delete quiz"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mb-4 flex items-center gap-3">
          <History className="w-6 h-6 text-white/60" />
          <h2 className="text-2xl font-bold">Hosted Game History</h2>
        </div>

        {loadingHistory ? (
          <div className="card text-center py-10">
            <p className="text-white/60">Loading hosted game history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-white/60">No hosted game sessions yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {history.map((session) => (
              <div key={session.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold">{session.quiz_title}</h3>
                  <span className="text-xs uppercase tracking-wide text-white/50">{session.status}</span>
                </div>
                <p className="text-sm text-white/60 mb-2">PIN: {session.pin}</p>
                <p className="text-xs text-white/50 mb-4">
                  {session.player_count} players • {new Date(session.created_at).toLocaleString()}
                </p>

                <div className="flex gap-2">
                  <button onClick={() => handleHostQuiz(session.quiz_id)} className="btn-primary flex-1">
                    <Play className="w-4 h-4" />
                    Host Again
                  </button>
                  <button
                    onClick={() => handleDeleteHostedSession(session.id)}
                    className="btn-secondary text-red-300 hover:text-red-200"
                    title="Delete history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

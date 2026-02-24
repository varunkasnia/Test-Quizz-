'use client'
export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getSocket } from '@/lib/socket'
import { gameAPI } from '@/lib/api'

export default function PlayerGamePage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [pinResolved, setPinResolved] = useState(false)
  const [status, setStatus] = useState('waiting') // waiting, playing
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const [question, setQuestion] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  const [answerSubmitted, setAnswerSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [certificateStatus, setCertificateStatus] = useState(null)
  const [loadingCertificate, setLoadingCertificate] = useState(false)

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('pin') || ''
    setPin(value.toUpperCase())
    setPinResolved(true)
  }, [])

  useEffect(() => {
    if (!question || status !== 'playing') return
    if (timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [question, status, timeLeft])

  useEffect(() => {
    if (!pinResolved) return

    const storedName = localStorage.getItem('playerName')
    const storedPlayerId = localStorage.getItem('playerId')

    if (!pin) {
      router.push('/join')
      return
    }

    if (storedName) setPlayerName(storedName)
    if (!storedName || !storedPlayerId) {
      router.push('/join')
      return
    }

    const socket = getSocket()

    const onConnect = () => {
      setConnected(true)
      socket.emit('join_lobby', {
        pin,
        name: storedName,
        player_id: Number(storedPlayerId),
      })
    }

    const onDisconnect = () => setConnected(false)

    const onGameStarted = () => {
      setStatus('playing')
    }

    const onQuestionUpdate = (payload) => {
      setStatus('playing')
      setQuestion(payload)
      setTimeLeft(payload?.time_limit || 30)
      setSelectedOption(null)
      setAnswerSubmitted(false)
      setSubmitting(false)
    }

    const onSocketError = (payload) => {
      setError(payload?.message || 'Socket error')
    }

    const onGameEnded = () => {
      setStatus('ended')
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('game_started', onGameStarted)
    socket.on('question_update', onQuestionUpdate)
    socket.on('game_ended', onGameEnded)
    socket.on('error', onSocketError)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('game_started', onGameStarted)
      socket.off('question_update', onQuestionUpdate)
      socket.off('game_ended', onGameEnded)
      socket.off('error', onSocketError)
    }
  }, [pin, pinResolved, router])

  const handleSubmitAnswer = async () => {
    if (!question || answerSubmitted || submitting || selectedOption === null || timeLeft <= 0) return

    const playerIdRaw = localStorage.getItem('playerId')
    const playerId = Number(playerIdRaw)
    const questionId = question?.question_id

    if (!playerId || !questionId) {
      setError('Missing player or question info')
      return
    }

    const elapsed = Math.max(0, (question.time_limit || 30) - timeLeft)

    setSubmitting(true)
    try {
      const answerValue = String(question.options[selectedOption])
      await gameAPI.submitAnswer({
        player_id: playerId,
        question_id: questionId,
        answer: answerValue,
        time_taken: elapsed,
      })

      setAnswerSubmitted(true)

      const socket = getSocket()
      socket.emit('submit_answer', {
        pin,
        player_id: playerId,
        question_id: questionId,
        answer: answerValue,
        time_taken: elapsed,
      })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (status !== 'ended' || !pin) return

    const playerId = Number(localStorage.getItem('playerId'))
    if (!playerId) return

    let active = true
    setLoadingCertificate(true)

    gameAPI.getCertificateStatus(pin, playerId)
      .then((response) => {
        if (!active) return
        setCertificateStatus(response.data || null)
      })
      .catch(() => {
        if (!active) return
        setCertificateStatus(null)
      })
      .finally(() => {
        if (active) setLoadingCertificate(false)
      })

    return () => {
      active = false
    }
  }, [status, pin])

  if (!pinResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center py-10 max-w-md w-full">
          <p className="text-white/60">Loading game...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="z-10 max-w-2xl w-full card"
      >
        <div className="mb-6 text-center">
          <h2 className="text-white/60 text-sm uppercase tracking-widest mb-2">You are in!</h2>
          <h1 className="text-3xl font-bold text-white mb-2">{playerName}</h1>
          <div className="text-xs text-white/60 font-mono">{pin}</div>
        </div>

        {status === 'ended' ? (
          <div className="bg-white/10 p-5 rounded-lg border border-white/10 text-center">
            <h3 className="text-xl font-semibold mb-1">Game ended</h3>
            <p className="text-white/70">The host has ended the quiz.</p>
            {loadingCertificate ? (
              <p className="text-white/60 text-sm mt-3">Checking certificate eligibility...</p>
            ) : certificateStatus ? (
              <div className="mt-4">
                <p className="text-sm text-white/80">
                  Score: {certificateStatus.accuracy}%
                </p>
                {certificateStatus.game_finished && certificateStatus.template_uploaded && certificateStatus.eligible ? (
                  <a
                    href={gameAPI.downloadCertificateUrl(pin, certificateStatus.player_id)}
                    className="btn-primary inline-block mt-3 px-5 py-2"
                    download
                  >
                    Download Certificate
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : question ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Question {Number(question.index || 0) + 1}</h3>
              <div className="text-sm font-mono px-3 py-1 rounded bg-white/10 border border-white/20">{timeLeft}s</div>
            </div>

            <div className="bg-white text-slate-900 p-5 rounded-xl font-semibold text-lg mb-4">
              {question.question_text}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(question.options || []).map((opt, i) => (
                <button
                  key={`${i}-${String(opt)}`}
                  type="button"
                  onClick={() => {
                    if (answerSubmitted || timeLeft <= 0) return
                    setSelectedOption(i)
                  }}
                  disabled={answerSubmitted || timeLeft <= 0}
                  className={`w-full text-left p-4 rounded-lg border transition ${
                    selectedOption === i
                      ? 'bg-red-500/20 border-red-400'
                      : 'bg-white/10 border-white/20 hover:bg-white/15'
                  } ${(answerSubmitted || timeLeft <= 0) ? 'opacity-80 cursor-not-allowed' : ''}`}
                >
                  <span className="text-red-300 mr-2">{String.fromCharCode(65 + i)}.</span>
                  {String(opt)}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSubmitAnswer}
              disabled={selectedOption === null || answerSubmitted || submitting || timeLeft <= 0}
              className="btn-primary w-full mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : answerSubmitted ? 'Answer Submitted' : 'Submit Answer'}
            </button>

            {answerSubmitted ? (
              <div className="mt-3 text-sm rounded-lg p-3 border bg-white/10 border-white/20 text-white/80">
                Answer submitted. Wait for host to finish this question.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="bg-white/10 p-4 rounded-lg mt-4 border border-white/10 text-center">
            <h3 className="text-xl font-semibold">{status === 'playing' ? 'Game started!' : "You're in!"}</h3>
            <p className="text-white/70 mt-1">
              {status === 'playing' ? 'Waiting for host to send question...' : 'See your name on host screen?'}
            </p>
          </div>
        )}

        <div className="mt-4 text-xs text-white/60 text-center">
          {connected ? 'Connected to lobby' : 'Reconnecting...'}
        </div>

        {error ? <div className="mt-3 text-xs text-red-300 text-center">{error}</div> : null}
      </motion.div>
    </div>
  )
}

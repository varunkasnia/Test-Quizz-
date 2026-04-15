'use client'
export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import Script from 'next/script'
import { getSocket } from '@/lib/socket'
import { gameAPI, codeAPI } from '@/lib/api'

const PISTON_LANGUAGES = {
  python: { language: 'python', version: '3.10.0' },
  cpp: { language: 'c++', version: '10.2.0' },
  java: { language: 'java', version: '15.0.2' },
  javascript: { language: 'javascript', version: '18.15.0' },
  c: { language: 'c', version: '10.2.0' },
  csharp: { language: 'csharp', version: '6.12.0' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.68.2' },
  ruby: { language: 'ruby', version: '3.0.1' },
  swift: { language: 'swift', version: '5.3.3' },
}

function MonacoEditor({ value, onChange, language, readOnly }) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const [monacoReady, setMonacoReady] = useState(false)

  // Initialize editor once monaco is loaded
  const initEditor = () => {
    if (!containerRef.current || editorRef.current) return
    if (typeof window === 'undefined' || !window.monaco) return

    const monacoLang = language === 'cpp' ? 'cpp' : language === 'csharp' ? 'csharp' : language
    editorRef.current = window.monaco.editor.create(containerRef.current, {
      value: value || '',
      language: monacoLang,
      theme: 'vs-dark',
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 4,
      readOnly: readOnly || false,
    })

    editorRef.current.onDidChangeModelContent(() => {
      if (onChange) onChange(editorRef.current.getValue())
    })
    setMonacoReady(true)
  }

  // Re-initialize if container changes
  useEffect(() => {
    if (window.monaco) {
      initEditor()
    }
  }, [containerRef.current])

  // Update language when it changes
  useEffect(() => {
    if (!editorRef.current || !window.monaco) return
    const monacoLang = language === 'cpp' ? 'cpp' : language === 'csharp' ? 'csharp' : language
    window.monaco.editor.setModelLanguage(editorRef.current.getModel(), monacoLang)
  }, [language])

  // Update readOnly
  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.updateOptions({ readOnly: readOnly || false })
  }, [readOnly])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  )
}

export default function PlayerGamePage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [pinResolved, setPinResolved] = useState(false)
  const [status, setStatus] = useState('waiting')
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
  const [monacoLoaded, setMonacoLoaded] = useState(false)

  // Code editor states
  const [codeLanguage, setCodeLanguage] = useState('python')
  const [codeValue, setCodeValue] = useState('')
  const [runResults, setRunResults] = useState(null)
  const [submitResults, setSubmitResults] = useState(null)
  const [runningCode, setRunningCode] = useState(false)
  const [submittingCode, setSubmittingCode] = useState(false)
  const [activeTab, setActiveTab] = useState('problem')
  const startTimeRef = useRef(Date.now())
  const editorInstanceRef = useRef(null)

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

  // Update Monaco editor when code value changes (e.g., new question with boilerplate)
  useEffect(() => {
    if (editorInstanceRef.current && monacoLoaded) {
      const currentValue = editorInstanceRef.current.getValue()
      if (currentValue !== codeValue) {
        editorInstanceRef.current.setValue(codeValue)
      }
    }
  }, [codeValue, monacoLoaded])

  useEffect(() => {
    if (!pinResolved) return
    const storedName = localStorage.getItem('playerName')
    const storedPlayerId = localStorage.getItem('playerId')
    if (!pin) { router.push('/join'); return }
    if (!storedName || !storedPlayerId) { router.push('/join'); return }
    if (storedName) setPlayerName(storedName)

    const socket = getSocket()
    const onConnect = () => {
      setConnected(true)
      socket.emit('join_lobby', { pin, name: storedName, player_id: Number(storedPlayerId) })
    }
    const onDisconnect = () => setConnected(false)
    const onGameStarted = () => setStatus('playing')
    const onQuestionUpdate = (payload) => {
      setStatus('playing')
      setQuestion(payload)
      setTimeLeft(payload?.time_limit || 30)
      setSelectedOption(null)
      setAnswerSubmitted(false)
      setSubmitting(false)
      // Set boilerplate code for code questions, or clear for MCQ
      setCodeValue(payload?.boilerplate_code || '')
      setRunResults(null)
      setSubmitResults(null)
      setActiveTab('problem')
      startTimeRef.current = Date.now()
    }
    const onSocketError = (payload) => setError(payload?.message || 'Socket error')
    const onGameEnded = () => setStatus('ended')

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('game_started', onGameStarted)
    socket.on('question_update', onQuestionUpdate)
    socket.on('game_ended', onGameEnded)
    socket.on('error', onSocketError)
    if (socket.connected) onConnect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('game_started', onGameStarted)
      socket.off('question_update', onQuestionUpdate)
      socket.off('game_ended', onGameEnded)
      socket.off('error', onSocketError)
    }
  }, [pin, pinResolved, router])

  const handleRun = async () => {
    if (!question || runningCode || timeLeft <= 0) return
    const sampleCases = question.sample_test_cases || []
    if (!sampleCases.length) return
    setRunningCode(true)
    setActiveTab('results')
    try {
      const results = []
      for (const tc of sampleCases) {
        const res = await fetch('https://emkc.org/api/v2/piston/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: PISTON_LANGUAGES[codeLanguage]?.language || 'python',
            version: PISTON_LANGUAGES[codeLanguage]?.version || '3.10.0',
            files: [{ content: codeValue }],
            stdin: tc.input || ''
          })
        })
        const data = await res.json()
        const actual = (data.run?.stdout || '').trim()
        const expected = String(tc.expected_output || '').trim()
        results.push({ passed: actual === expected, input: tc.input, expected, actual, stderr: data.run?.stderr || '' })
      }
      setRunResults(results)
    } catch (e) {
      setError('Failed to run code. Check connection.')
    } finally {
      setRunningCode(false)
    }
  }

  const handleCodeSubmit = async () => {
    if (!question || submittingCode || answerSubmitted || timeLeft <= 0) return
    const playerId = Number(localStorage.getItem('playerId'))
    const questionId = question?.question_id
    if (!playerId || !questionId) return
    const timeTaken = Math.max(0, (Date.now() - startTimeRef.current) / 1000)
    setSubmittingCode(true)
    setActiveTab('results')
    try {
      const res = await codeAPI.submit({ player_id: playerId, question_id: questionId, code: codeValue, language: codeLanguage, time_taken: timeTaken })
      setSubmitResults(res.data)
      setAnswerSubmitted(true)
      getSocket().emit('submit_answer', { pin, player_id: playerId, question_id: questionId, answer: `CODE:${codeLanguage}`, time_taken: timeTaken })
    } catch (e) {
      setError(e?.response?.data?.detail || 'Submission failed')
    } finally {
      setSubmittingCode(false)
    }
  }

  const handleSubmitAnswer = async () => {
    if (!question || answerSubmitted || submitting || selectedOption === null || timeLeft <= 0) return
    const playerId = Number(localStorage.getItem('playerId'))
    const questionId = question?.question_id
    if (!playerId || !questionId) return
    const elapsed = Math.max(0, (question.time_limit || 30) - timeLeft)
    setSubmitting(true)
    try {
      await gameAPI.submitAnswer({ player_id: playerId, question_id: questionId, answer: String(question.options[selectedOption]), time_taken: elapsed })
      setAnswerSubmitted(true)
      getSocket().emit('submit_answer', { pin, player_id: playerId, question_id: questionId, answer: String(question.options[selectedOption]), time_taken: elapsed })
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
      .then((r) => { if (active) setCertificateStatus(r.data || null) })
      .catch(() => { if (active) setCertificateStatus(null) })
      .finally(() => { if (active) setLoadingCertificate(false) })
    return () => { active = false }
  }, [status, pin])

  if (!pinResolved) {
    return <div className="min-h-screen flex items-center justify-center"><div className="card text-center py-10 max-w-md w-full"><p className="text-white/60">Loading game...</p></div></div>
  }

  // Detect code questions: check question_type (new backend) OR absence of options (fallback for old backend)
  const isCode = question?.question_type === 'code' || 
                 (!question?.options || question.options.length === 0)
  const sampleCases = question?.sample_test_cases || question?.test_cases?.filter(tc => tc.is_sample) || []
  const totalCases = question?.total_test_cases || question?.test_cases?.length || 0
  const hiddenCount = Math.max(0, totalCases - sampleCases.length)

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      {/* Monaco loader from CDN - no npm package needed */}
      <Script
        src="https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs/loader.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs' } })
          window.require(['vs/editor/editor.main'], () => {
            setMonacoLoaded(true)
          })
        }}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
        <span className="font-bold text-sm font-mono tracking-widest text-white/60">{pin}</span>
        <span className="text-sm font-semibold text-white">{playerName}</span>
        {question && (
          <span className={`text-sm font-mono px-3 py-0.5 rounded border ${timeLeft <= 10 ? 'text-red-400 border-red-400/50 animate-pulse' : 'text-white/70 border-white/20'}`}>
            {timeLeft}s
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 45px)' }}>
        {status === 'ended' ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card max-w-md w-full text-center">
              <h2 className="text-2xl font-bold mb-2">Quiz Ended 🎉</h2>
              <p className="text-white/60 mb-4">The host has ended the quiz.</p>
              {loadingCertificate ? <p className="text-white/60 text-sm">Checking certificate eligibility...</p> : (
                certificateStatus?.game_finished && certificateStatus?.template_uploaded && certificateStatus?.eligible ? (
                  <a href={gameAPI.downloadCertificateUrl(pin, certificateStatus.player_id)} className="btn-primary inline-block mt-3 px-5 py-2" download>Download Certificate</a>
                ) : null
              )}
            </motion.div>
          </div>
        ) : question ? (
          isCode ? (
            <div className="flex flex-1 overflow-hidden">
              {/* Left: Problem + Results */}
              <div className="w-2/5 flex flex-col border-r border-white/10 overflow-hidden bg-[#0d1117]">
                <div className="flex border-b border-white/10 shrink-0">
                  {['problem', 'results'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-5 py-2 text-sm font-medium capitalize transition ${activeTab === tab ? 'text-white border-b-2 border-blue-500' : 'text-white/50 hover:text-white/80'}`}>
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="p-5 flex-1 overflow-y-auto">
                  {activeTab === 'problem' ? (
                    <>
                      <h2 className="text-lg font-bold mb-3">Q{Number(question.index || 0) + 1}. Code Problem</h2>
                      <div className="text-white/85 text-sm leading-relaxed whitespace-pre-wrap mb-5">{question.question_text}</div>
                      {sampleCases.length > 0 && (
                        <div className="mt-4">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-3">Sample Test Cases</h3>
                          {sampleCases.map((tc, i) => (
                            <div key={i} className="mb-4 bg-[#1c2128] rounded-lg p-3 text-xs font-mono">
                              <div className="text-white/50 mb-1">Example {i + 1}</div>
                              <div className="mb-1"><span className="text-white/50">Input: </span><span className="text-green-300">{String(tc.input)}</span></div>
                              <div><span className="text-white/50">Output: </span><span className="text-blue-300">{String(tc.expected_output)}</span></div>
                            </div>
                          ))}
                          {hiddenCount > 0 && <p className="text-xs text-white/40 italic">+ {hiddenCount} hidden test cases evaluated on Submit</p>}
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      {submitResults ? (
                        <>
                          <div className={`rounded-lg p-4 mb-4 border ${submitResults.pass_rate === 1 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            <div className={`text-xl font-bold ${submitResults.pass_rate === 1 ? 'text-green-400' : 'text-red-400'}`}>
                              {submitResults.pass_rate === 1 ? '✓ Accepted' : '✗ Wrong Answer'}
                            </div>
                            <div className="text-sm text-white/60 mt-1">
                              Passed {submitResults.passed}/{submitResults.total} tests · {submitResults.points_earned} pts
                            </div>
                          </div>
                          {submitResults.results.map((r, i) => (
                            <div key={i} className={`mb-3 rounded-lg p-3 text-xs font-mono border-l-2 ${r.passed ? 'border-green-500 bg-green-500/5' : 'border-red-500 bg-red-500/5'}`}>
                              <div className={`font-bold mb-1 ${r.passed ? 'text-green-400' : 'text-red-400'}`}>
                                {r.passed ? '✓' : '✗'} Case {r.index} {r.is_sample ? '(Sample)' : '(Hidden)'}
                              </div>
                              {!r.passed && (
                                <div className="space-y-0.5 text-white/60">
                                  {r.input !== 'Hidden' && <div>Input: {r.input}</div>}
                                  {r.expected !== 'Hidden' && <div>Expected: {r.expected}</div>}
                                  <div>Got: {r.actual || r.error || 'No output'}</div>
                                  {r.stderr && <div className="text-red-400">Error: {r.stderr}</div>}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      ) : runResults ? (
                        <>
                          <h3 className="text-sm font-semibold mb-3">Sample Test Results</h3>
                          {runResults.map((r, i) => (
                            <div key={i} className={`mb-3 rounded-lg p-3 text-xs font-mono border-l-2 ${r.passed ? 'border-green-500 bg-green-500/5' : 'border-red-500 bg-red-500/5'}`}>
                              <div className={`font-bold mb-1 ${r.passed ? 'text-green-400' : 'text-red-400'}`}>{r.passed ? '✓ Passed' : '✗ Failed'} — Case {i + 1}</div>
                              <div className="space-y-0.5 text-white/60">
                                <div>Input: <span className="text-white/80">{r.input}</span></div>
                                <div>Expected: <span className="text-blue-300">{r.expected}</span></div>
                                <div>Got: <span className={r.passed ? 'text-green-300' : 'text-red-300'}>{r.actual || 'No output'}</span></div>
                                {r.stderr && <div className="text-red-400">stderr: {r.stderr}</div>}
                              </div>
                            </div>
                          ))}
                          <p className="text-xs text-white/40 mt-3 italic">Submit to run all {totalCases} test cases.</p>
                        </>
                      ) : (
                        <p className="text-white/40 text-sm italic text-center mt-10">Run or Submit to see results here.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Monaco Editor */}
              <div className="flex-1 flex flex-col bg-[#1e1e1e]">
                <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-white/10 shrink-0">
                  <select
                    className="bg-[#3c3c3c] text-white text-xs px-2 py-1 rounded border border-white/20 outline-none"
                    value={codeLanguage}
                    onChange={(e) => {
                      setCodeLanguage(e.target.value)
                      if (editorInstanceRef.current && window.monaco) {
                        const newLang = e.target.value === 'cpp' ? 'cpp' : e.target.value
                        window.monaco.editor.setModelLanguage(editorInstanceRef.current.getModel(), newLang)
                      }
                    }}
                    disabled={answerSubmitted || timeLeft <= 0}
                  >
                    {Object.keys(PISTON_LANGUAGES).map(lang => (
                      <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
                    ))}
                  </select>
                  <div className="text-xs text-white/40">VS Code Editor</div>
                </div>

                {/* Editor container — Monaco attaches here */}
                <div
                  className="flex-1 min-h-0"
                  ref={(container) => {
                    if (!container || editorInstanceRef.current) return
                    if (!monacoLoaded || !window.monaco) return
                    editorInstanceRef.current = window.monaco.editor.create(container, {
                      value: codeValue || '',
                      language: codeLanguage,
                      theme: 'vs-dark',
                      minimap: { enabled: false },
                      fontSize: 14,
                      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 4,
                    })
                    editorInstanceRef.current.onDidChangeModelContent(() => {
                      setCodeValue(editorInstanceRef.current.getValue())
                    })
                  }}
                />

                {/* Fallback textarea when Monaco isn't loaded */}
                {!monacoLoaded && (
                  <textarea
                    className="flex-1 bg-[#1e1e1e] text-white font-mono text-sm p-4 resize-none outline-none border-none"
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value)}
                    placeholder={`Write your ${codeLanguage} solution here...`}
                    disabled={answerSubmitted || timeLeft <= 0}
                  />
                )}

                <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a2e] border-t border-white/10 shrink-0">
                  <div className="text-xs text-white/40">
                    {sampleCases.length} sample · {hiddenCount} hidden
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleRun} disabled={runningCode || answerSubmitted || timeLeft <= 0 || !codeValue.trim()}
                      className="px-4 py-1.5 text-sm rounded bg-white/10 border border-white/20 hover:bg-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      {runningCode ? '⏳ Running...' : '▶ Run'}
                    </button>
                    <button onClick={handleCodeSubmit} disabled={submittingCode || answerSubmitted || timeLeft <= 0 || !codeValue.trim()}
                      className="px-4 py-1.5 text-sm rounded bg-green-600 hover:bg-green-500 transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                      {submittingCode ? '⏳ Submitting...' : answerSubmitted ? '✓ Submitted' : '↑ Submit'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // MCQ layout
            <div className="flex-1 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="z-10 max-w-2xl w-full card">
                <div className="mb-6 text-center">
                  <h2 className="text-white/60 text-sm uppercase tracking-widest mb-2">You are in!</h2>
                  <h1 className="text-3xl font-bold text-white mb-2">{playerName}</h1>
                  <div className="text-xs text-white/60 font-mono">{pin}</div>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Question {Number(question.index || 0) + 1}</h3>
                  <span className={`text-sm font-mono px-3 py-1 rounded bg-white/10 border border-white/20 ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : ''}`}>{timeLeft}s</span>
                </div>
                <div className="bg-white text-slate-900 p-5 rounded-xl font-semibold text-lg mb-4">{question.question_text}</div>
                <div className="grid grid-cols-1 gap-3">
                  {(question.options || []).map((opt, i) => (
                    <button key={`${i}-${String(opt)}`} type="button"
                      onClick={() => { if (answerSubmitted || timeLeft <= 0) return; setSelectedOption(i) }}
                      disabled={answerSubmitted || timeLeft <= 0}
                      className={`w-full text-left p-4 rounded-lg border transition ${selectedOption === i ? 'bg-red-500/20 border-red-400' : 'bg-white/10 border-white/20 hover:bg-white/15'} ${(answerSubmitted || timeLeft <= 0) ? 'opacity-80 cursor-not-allowed' : ''}`}>
                      <span className="text-red-300 mr-2">{String.fromCharCode(65 + i)}.</span>{String(opt)}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={handleSubmitAnswer}
                  disabled={selectedOption === null || answerSubmitted || submitting || timeLeft <= 0}
                  className="btn-primary w-full mt-4 disabled:opacity-60 disabled:cursor-not-allowed">
                  {submitting ? 'Submitting...' : answerSubmitted ? '✓ Submitted' : 'Submit Answer'}
                </button>
                {answerSubmitted && <div className="mt-3 text-sm rounded-lg p-3 border bg-white/10 border-white/20 text-white/80">Answer submitted. Wait for host.</div>}
                {error && <div className="mt-3 text-xs text-red-300 text-center">{error}</div>}
              </motion.div>
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="z-10 max-w-md w-full card text-center">
              <h2 className="text-white/60 text-sm uppercase tracking-widest mb-2">You are in!</h2>
              <h1 className="text-3xl font-bold text-white mb-2">{playerName}</h1>
              <div className="text-xs text-white/60 font-mono mb-4">{pin}</div>
              <div className="bg-white/10 p-4 rounded-lg border border-white/10">
                <h3 className="text-xl font-semibold">{status === 'playing' ? 'Game started!' : "You're in!"}</h3>
                <p className="text-white/70 mt-1">{status === 'playing' ? 'Waiting for host to send question...' : 'See your name on the host screen?'}</p>
              </div>
              <div className="mt-4 text-xs text-white/60">{connected ? '🟢 Connected' : '🔴 Reconnecting...'}</div>
              {error && <div className="mt-3 text-xs text-red-300">{error}</div>}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Sparkles, Trash2, Edit, Play, X } from 'lucide-react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { quizAPI, gameAPI } from '@/lib/api'
import { getAuthUser } from '@/lib/auth'

interface Question {
  id?: number
  question_text: string
  options: string[]
  correct_answer: string
  time_limit: number
}

export default function CreateQuizPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty] = useState('medium')
  const [defaultTimeLimit, setDefaultTimeLimit] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [quizTitle, setQuizTitle] = useState('')
  const [quizDescription, setQuizDescription] = useState('')
  const [hostName, setHostName] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  useEffect(() => {
    const authUser = getAuthUser()
    if (!authUser || authUser.role !== 'host') {
      router.replace('/login?role=host')
      return
    }

    const storedHostName = localStorage.getItem('hostName')
    if (storedHostName) {
      setHostName(storedHostName)
    }
    setAuthChecked(true)
  }, [router])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setTopic('') // Clear topic when file is selected
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxFiles: 1,
  })

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center py-10 max-w-md w-full">
          <p className="text-white/60">Checking host access...</p>
        </div>
      </div>
    )
  }

  const handleGenerate = async () => {
    setError('')
    
    // Check if either topic or file is provided
    if (!topic.trim() && !file) {
      setError('Please enter a topic or upload a file')
      return
    }

    setLoading(true)
    try {
      let response
      
      if (file) {
        // Use file if uploaded
        const formData = new FormData()
        formData.append('file', file)
        formData.append('num_questions', numQuestions.toString())
        formData.append('difficulty', difficulty)
        response = await quizAPI.generateFromFile(formData)
        setQuizTitle(`${file.name.split('.')[0]} Quiz`)
        setQuizDescription(description)
      } else {
        // Use topic
        response = await quizAPI.generateFromTopic({
          topic,
          num_questions: numQuestions,
          difficulty,
        })
        setQuizTitle(`${topic} Quiz`)
        setQuizDescription(description)
      }

      const generatedQuestions = (response.data.questions || []).map((q: Question) => ({
        ...q,
        time_limit: defaultTimeLimit,
      }))
      setQuestions(generatedQuestions)
      setStep('review')
    } catch (error: any) {
      console.error('Generation error:', error)
      
      // Extract error message properly
      let errorMsg = 'Failed to generate quiz'
      
      if (error.response?.data) {
        // Backend error response
        if (typeof error.response.data.detail === 'string') {
          errorMsg = error.response.data.detail
        } else if (Array.isArray(error.response.data.detail)) {
          // Validation errors from FastAPI
          errorMsg = error.response.data.detail.map((err: any) => 
            `${err.loc?.join(' → ') || 'Error'}: ${err.msg}`
          ).join(', ')
        } else if (error.response.data.detail) {
          errorMsg = JSON.stringify(error.response.data.detail)
        }
      } else if (error.message) {
        errorMsg = error.message
      }
      
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleSaveAndHost = async () => {
    if (!quizTitle.trim() || !hostName.trim()) {
      setError('Please enter quiz title and your name')
      return
    }
    if (questions.length === 0) {
      setError('Please add at least one question')
      return
    }

    setLoading(true)
    setError('')
    try {
      const normalizedHostName = hostName.trim()
      localStorage.setItem('hostName', normalizedHostName)

      // Create quiz
      const quizResponse = await quizAPI.create({
        title: quizTitle,
        description: quizDescription,
        created_by: normalizedHostName,
        questions: questions,
      })

      // Create game session
      const gameResponse = await gameAPI.create({
        quiz_id: quizResponse.data.id,
        host_name: normalizedHostName,
      })

      // Redirect to lobby
      router.push(`/host/lobby?pin=${gameResponse.data.pin}`)
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to create quiz')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'input') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/host">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-secondary flex items-center gap-2 mb-8"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </motion.button>
          </Link>

          <h1 className="text-4xl md:text-5xl font-display font-bold mb-2">Create Quiz</h1>
          <p className="text-white/60 mb-8">Generate questions using AI from a topic or file</p>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 flex items-start gap-3"
            >
              <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-400 mb-1">Error</p>
                <p className="text-sm text-white/80">{error}</p>
              </div>
              <button onClick={() => setError('')} className="text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Main Input Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            {/* Topic Input */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Enter a Topic</h2>
                  <p className="text-sm text-white/60">Let AI generate questions about any subject</p>
                </div>
              </div>
              
              <input
                type="text"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value)
                  if (e.target.value && file) setFile(null) // Clear file if typing
                }}
                placeholder="E.g., World War II, Python Programming, Solar System..."
                className="input-field"
                disabled={!!file}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-white/40 text-sm font-semibold">OR</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            {/* File Upload */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Upload a File</h2>
                  <p className="text-sm text-white/60">PDF, PPT, TXT, DOCX, or images (max 10MB)</p>
                </div>
              </div>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-3 ${
                  isDragActive
                    ? 'border-orange-500 bg-orange-500/10'
                    : file
                    ? 'border-green-500/50 bg-green-500/10'
                    : 'border-white/20 hover:border-white/40'
                } ${topic ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input {...getInputProps()} />
                <Upload className={`w-12 h-12 mx-auto mb-3 ${file ? 'text-green-400' : 'text-white/40'}`} />
                {file ? (
                  <div>
                    <p className="text-lg font-semibold mb-1 text-green-400">✓ {file.name}</p>
                    <p className="text-sm text-white/60">{(file.size / 1024).toFixed(2)} KB</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                      }}
                      className="mt-3 text-sm text-red-400 hover:text-red-300"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg mb-2">
                      {isDragActive ? 'Drop file here' : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-sm text-white/60">
                      PDF, TXT, PPTX, DOCX, PNG, JPG
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Description Field (for both topic and file) */}
            <div className="mb-6 pb-6 border-b border-white/10">
              <label className="block text-sm font-semibold mb-2 text-white/80">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a brief description for this quiz..."
                className="input-field resize-none"
                rows={2}
                disabled={!topic && !file}
              />
              <p className="text-xs text-white/40 mt-1">
                This will be saved with your quiz for future reference
              </p>
            </div>

            {/* Settings */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Number of Questions</label>
                <input
                  type="number"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value) || 1)}
                  min="3"
                  max="50"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Difficulty Level</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="input-field"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Time Per Question (seconds)</label>
              <input
                type="number"
                value={defaultTimeLimit}
                onChange={(e) => setDefaultTimeLimit(Math.max(5, Math.min(120, parseInt(e.target.value) || 30)))}
                min="5"
                max="120"
                className="input-field"
              />
              <p className="text-xs text-white/50 mt-1">
                Applied to all generated questions. You can still edit each question later.
              </p>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || (!topic.trim() && !file)}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Generating Questions...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Quiz
                </>
              )}
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  // Review step
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => setStep('input')}
          className="btn-secondary flex items-center gap-2 mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Input
        </button>

        <h1 className="text-4xl font-display font-bold mb-8">Review & Edit Quiz</h1>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 flex items-start gap-3"
          >
            <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-400 mb-1">Error</p>
              <p className="text-sm text-white/80">{error}</p>
            </div>
            <button onClick={() => setError('')} className="text-white/60 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Quiz Meta */}
        <div className="card mb-6">
          <input
            type="text"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="Quiz Title"
            className="input-field mb-4 text-2xl font-bold"
          />
          <textarea
            value={quizDescription}
            onChange={(e) => setQuizDescription(e.target.value)}
            placeholder="Quiz Description (optional)"
            className="input-field mb-4"
            rows={2}
          />
          <input
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Your Name"
            className="input-field"
          />
        </div>

        {/* Questions */}
        <div className="space-y-4 mb-6">
          {questions.map((q, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm font-mono text-white/60">Question {index + 1}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                    className="p-2 hover:bg-white/10 rounded-lg transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(index)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              {editingIndex === index ? (
                <div className="space-y-3">
                  <textarea
                    value={q.question_text}
                    onChange={(e) => handleUpdateQuestion(index, 'question_text', e.target.value)}
                    className="input-field"
                    rows={2}
                  />
                  {q.options.map((opt, optIndex) => (
                    <input
                      key={optIndex}
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...q.options]
                        newOptions[optIndex] = e.target.value
                        handleUpdateQuestion(index, 'options', newOptions)
                      }}
                      className="input-field"
                      placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                    />
                  ))}
                  <select
                    value={q.correct_answer}
                    onChange={(e) => handleUpdateQuestion(index, 'correct_answer', e.target.value)}
                    className="input-field"
                  >
                    {q.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={q.time_limit}
                    onChange={(e) => handleUpdateQuestion(index, 'time_limit', parseInt(e.target.value))}
                    className="input-field"
                    min="5"
                    max="120"
                    placeholder="Time limit (seconds)"
                  />
                </div>
              ) : (
                <div>
                  <p className="text-lg font-semibold mb-3">{q.question_text}</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {q.options.map((opt, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg ${
                          opt === q.correct_answer
                            ? 'bg-green-500/20 border border-green-500/50'
                            : 'bg-white/5'
                        }`}
                      >
                        <span className="font-mono text-sm mr-2">{String.fromCharCode(65 + i)}</span>
                        {opt}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-white/60">Time: {q.time_limit}s</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="card">
          <button
            onClick={handleSaveAndHost}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                Creating...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Save & Host Game
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

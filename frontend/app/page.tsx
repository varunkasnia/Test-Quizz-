'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Crown, LogIn, Users, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="app-shell">
      <main className="page-wrap py-10 sm:py-14 md:py-20">
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="brand-logo justify-center mb-3"
          >
            <Zap className="w-7 h-7 text-pink-400" />
            <span>UnAI Quizz</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="section-subtitle"
          >
            Create, host, and join adaptive quizzes in real time
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto space-y-4"
        >
          <Link href="/login?role=host" className="block card group hover:border-pink-300/40 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-pink-500/25 border border-pink-400/30 flex items-center justify-center shrink-0">
                <Crown className="w-7 h-7 text-pink-200" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold">Host a Quiz</h2>
                <p className="text-sm sm:text-base text-white/65">Create and manage your quizzes</p>
              </div>
              <ArrowRight className="w-6 h-6 text-white/55 group-hover:text-white transition-colors" />
            </div>
          </Link>

          <Link href="/join" className="block card group hover:border-pink-300/30 transition-all bg-white/5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <Users className="w-7 h-7 text-rose-100" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold">Join a Quiz</h2>
                <p className="text-sm sm:text-base text-white/65">Enter your code and participate instantly</p>
              </div>
              <ArrowRight className="w-6 h-6 text-white/55 group-hover:text-white transition-colors" />
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto mt-8"
        >
          <Link href="/login" className="btn-secondary w-full">
            <LogIn className="w-4 h-4" />
            Login
          </Link>
        </motion.div>
      </main>

      <footer className="border-t border-white/10 py-6 sm:py-8 mt-8">
        <div className="page-wrap flex flex-col items-center gap-3 text-center">
          <Image
            src="/varun-kumar.jpg"
            alt="Varun Kumar"
            width={96}
            height={96}
            className="h-24 w-24 rounded-full object-cover border border-white/20"
            priority
          />
          <div className="text-sm text-white/70 leading-relaxed">
            <p>Created by Varun Kumar.</p>
            <p>Turning traditional quizzes into intelligent learning engines — fast, adaptive, and future-ready.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

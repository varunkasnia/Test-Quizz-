"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { exportAPI, gameAPI, quizAPI } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { getAuthUser } from "@/lib/auth";

export default function HostGamePage() {
  const params = useParams();
  const router = useRouter();
  const pin = String(params.pin || "").toUpperCase();
  const [authChecked, setAuthChecked] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [questionResults, setQuestionResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [finalResultsLoading, setFinalResultsLoading] = useState(false);

  const lastBroadcastedIndex = useRef(-1);
  const fetchingResultsRef = useRef(false);
  const firstResultsLoadedRef = useRef(false);

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  useEffect(() => {
    const authUser = getAuthUser();
    if (!authUser || authUser.role !== "host") {
      router.replace("/login?role=host");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    if (!pin) {
      router.push("/host");
      return;
    }

    let active = true;

    async function loadGame() {
      setLoading(true);
      setError("");

      try {
        const statusRes = await gameAPI.getStatus(pin);
        const quizId = statusRes?.data?.quiz_id;

        if (!quizId) {
          throw new Error("Quiz not found for this game");
        }

        const quizRes = await quizAPI.get(quizId);
        const loadedQuestions = quizRes?.data?.questions || [];

        if (!active) return;

        if (!loadedQuestions.length) {
          setError("This quiz has no questions.");
          setQuestions([]);
          return;
        }

        setQuizTitle(quizRes?.data?.title || "Quiz");
        setQuestions(loadedQuestions);

        const initialIndex = Math.max(0, Math.min(statusRes?.data?.current_question_index || 0, loadedQuestions.length - 1));
        setCurrentIndex(initialIndex);
        setTimeLeft(loadedQuestions[initialIndex].time_limit || 30);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.detail || err?.message || "Could not load game");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadGame();

    return () => {
      active = false;
    };
  }, [pin, router, authChecked]);

  useEffect(() => {
    if (loading || error || questions.length === 0 || gameEnded) return;

    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit("host_join", { pin });
      // Ensure the current question is broadcast again after reconnect.
      lastBroadcastedIndex.current = -1;
    };

    const onDisconnect = () => setConnected(false);

    const onSocketError = (payload) => {
      setError(payload?.message || "Socket error");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("error", onSocketError);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("error", onSocketError);
    };
  }, [pin, loading, error, questions.length, gameEnded]);

  useEffect(() => {
    if (!connected || !currentQuestion || gameEnded) return;

    if (lastBroadcastedIndex.current === currentIndex) return;

    const socket = getSocket();
    socket.emit("next_question", {
      pin,
      question_index: currentIndex,
      question_data: {
        id: currentQuestion.id,
        question_text: currentQuestion.question_text,
        options: currentQuestion.options,
        time_limit: currentQuestion.time_limit || 30,
      },
    });

    lastBroadcastedIndex.current = currentIndex;
    firstResultsLoadedRef.current = false;
    setQuestionResults(null);
    setTimeLeft(currentQuestion.time_limit || 30);
  }, [connected, pin, currentIndex, currentQuestion, gameEnded]);

  useEffect(() => {
    if (!currentQuestion || gameEnded) return;
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, currentQuestion, gameEnded]);

  useEffect(() => {
    if (!currentQuestion || gameEnded) return;
    if (timeLeft > 0) return;

    let mounted = true;

    const fetchResults = async () => {
      if (!mounted || fetchingResultsRef.current) return;
      fetchingResultsRef.current = true;

      if (!firstResultsLoadedRef.current) {
        setResultsLoading(true);
      }

      try {
        const res = await gameAPI.getQuestionResults(pin, currentQuestion.id);
        if (!mounted) return;
        setQuestionResults(res?.data || null);
      } catch (err) {
        if (mounted) {
          setError(err?.response?.data?.detail || "Failed to load question results");
        }
      } finally {
        fetchingResultsRef.current = false;
        firstResultsLoadedRef.current = true;
        if (mounted) {
          setResultsLoading(false);
        }
      }
    };

    // Small grace delay lets near-timeout submissions reach backend first.
    const initialTimer = setTimeout(() => {
      fetchResults();
    }, 700);

    // Keep refreshing results while host is on this question's results screen.
    const pollTimer = setInterval(() => {
      fetchResults();
    }, 1500);

    return () => {
      mounted = false;
      clearTimeout(initialTimer);
      clearInterval(pollTimer);
    };
  }, [timeLeft, currentQuestion, pin, gameEnded]);

  const handleNextQuestion = async () => {
    if (timeLeft > 0) return;

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    try {
      await gameAPI.end(pin);
    } catch (_) {
      // End-game API failure should not block realtime end signal.
    }

    setFinalResultsLoading(true);
    try {
      const finalResultsRes = await gameAPI.getResults(pin);
      setFinalLeaderboard(finalResultsRes?.data?.players || []);
    } catch (_) {
      setFinalLeaderboard([]);
    } finally {
      setFinalResultsLoading(false);
    }

    const socket = getSocket();
    socket.emit("end_game", { pin, final_results: [] });
    setGameEnded(true);
  };

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center py-10 max-w-md w-full">
          <p className="text-white/60">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center py-10 max-w-md w-full">
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center py-10 max-w-md w-full">
          <p className="text-white/60">No question found.</p>
        </div>
      </div>
    );
  }

  if (gameEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center py-10 max-w-xl w-full">
          <h1 className="text-3xl font-bold mb-3">Game Ended</h1>
          <p className="text-white/70 mb-6">Final leaderboard and exports are ready.</p>

          <div className="mb-6 text-left">
            <h3 className="text-xl font-semibold mb-3 text-center">Leaderboard</h3>
            {finalResultsLoading ? (
              <p className="text-white/60 text-center">Loading leaderboard...</p>
            ) : finalLeaderboard.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/60 border-b border-white/10">
                      <th className="py-2 pr-3">Rank</th>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Roll No.</th>
                      <th className="py-2 pr-0">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalLeaderboard.map((player, idx) => (
                      <tr key={player.id || `${player.name}-${idx}`} className="border-b border-white/5">
                        <td className="py-2 pr-3">#{idx + 1}</td>
                        <td className="py-2 pr-3">{player.name}</td>
                        <td className="py-2 pr-3">{player.roll_number || "-"}</td>
                        <td className="py-2 pr-0">{player.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-white/60 text-center">No leaderboard data found.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <a href={exportAPI.csv(pin)} className="btn-primary px-6 py-3 text-sm" download>
              Download CSV
            </a>
            <a href={exportAPI.excel(pin)} className="btn-secondary px-6 py-3 text-sm" download>
              Download Excel
            </a>
          </div>

          <Button className="btn-primary" onClick={() => router.push("/host")}>Back to Host</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="card mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Game PIN</p>
            <p className="text-2xl font-mono font-bold text-red-300">{pin}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-white/50 mb-1">Quiz</p>
            <p className="text-sm md:text-base text-white/90">{quizTitle}</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-mono font-bold px-4 py-2 rounded-lg bg-white/10 border border-white/20">{timeLeft}s</div>
            <div className={`text-xs mt-1 ${connected ? "text-green-300" : "text-yellow-300"}`}>
              {connected ? "Live" : "Reconnecting"}
            </div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="bg-white !text-slate-900 p-8 rounded-2xl text-center text-2xl md:text-3xl font-bold mb-6 shadow-xl">
            {currentQuestion.question_text}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(currentQuestion.options || []).map((opt, idx) => (
              <div
                key={`${idx}-${String(opt)}`}
                className="bg-white/10 border border-white/20 p-5 rounded-xl text-white text-lg font-semibold"
              >
                <span className="text-red-300 mr-2">{String.fromCharCode(65 + idx)}.</span>
                {String(opt)}
              </div>
            ))}
          </div>
        </motion.div>

        {timeLeft === 0 ? (
          <div className="card mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Question Results</h3>
              {questionResults?.summary ? (
                <div className="text-sm text-white/70">
                  Answered {questionResults.summary.answered_count}/{questionResults.summary.total_players} · Correct {questionResults.summary.correct_count}
                </div>
              ) : null}
            </div>

            {resultsLoading ? (
              <p className="text-white/60">Loading results...</p>
            ) : questionResults?.players?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/60 border-b border-white/10">
                      <th className="py-2 pr-3">Player</th>
                      <th className="py-2 pr-3">Answer</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-0">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questionResults.players.map((row) => (
                      <tr key={row.player_id} className="border-b border-white/5">
                        <td className="py-2 pr-3">{row.name}</td>
                        <td className="py-2 pr-3">{row.answered ? row.answer : "No answer"}</td>
                        <td className="py-2 pr-3">
                          {row.answered ? (row.is_correct ? "Correct" : "Wrong") : "Unanswered"}
                        </td>
                        <td className="py-2 pr-3">{row.time_taken !== null ? `${Number(row.time_taken).toFixed(1)}s` : "-"}</td>
                        <td className="py-2 pr-0">{row.points_earned || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-white/60">No player data for this question.</p>
            )}

            {questionResults?.correct_answer ? (
              <p className="text-sm text-white/70 mt-4">
                Correct answer: <span className="text-green-300 font-semibold">{questionResults.correct_answer}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-white/70">
            Question {currentIndex + 1} of {questions.length}
          </div>
          <Button
            onClick={handleNextQuestion}
            disabled={timeLeft > 0}
            className="btn-primary px-8 py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {currentIndex < questions.length - 1 ? "Next Question" : "End Game"}
          </Button>
        </div>
      </div>
    </div>
  );
}

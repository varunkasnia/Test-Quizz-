"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket";
import { gameAPI } from "@/lib/api";

export default function LobbyPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [pinResolved, setPinResolved] = useState(false);

  const [players, setPlayers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [certificateThreshold, setCertificateThreshold] = useState(75);
  const [templateFile, setTemplateFile] = useState(null);
  const [templateUploaded, setTemplateUploaded] = useState(false);
  const [savingCertificate, setSavingCertificate] = useState(false);
  const [certificateMessage, setCertificateMessage] = useState("");

  const playerCount = useMemo(() => players.length, [players]);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("pin") || "";
    setPin(value.toUpperCase());
    setPinResolved(true);
  }, []);

  useEffect(() => {
    if (!pinResolved) return;

    if (!pin) {
      router.push("/host/create");
      return;
    }

    let mounted = true;

    gameAPI
      .getStatus(pin)
      .then((response) => {
        if (!mounted) return;
        setPlayers(response.data?.players || []);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Could not load lobby status");
      });

    gameAPI
      .getCertificateSettings(pin)
      .then((response) => {
        if (!mounted) return;
        setCertificateThreshold(response.data?.certificate_threshold || 75);
        setTemplateUploaded(Boolean(response.data?.certificate_template_uploaded));
      })
      .catch(() => {
        if (!mounted) return;
        // Keep default values if no settings fetched.
      });

    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit("host_join", { pin });
    };

    const onDisconnect = () => setConnected(false);

    const onLobbyUpdated = (payload) => {
      setPlayers(payload?.players || []);
    };

    const onGameStarted = () => {
      router.push(`/host/game/${pin}`);
    };

    const onSocketError = (payload) => {
      setError(payload?.message || "Socket error");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("lobby_updated", onLobbyUpdated);
    socket.on("game_started", onGameStarted);
    socket.on("error", onSocketError);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      mounted = false;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("lobby_updated", onLobbyUpdated);
      socket.off("game_started", onGameStarted);
      socket.off("error", onSocketError);
    };
  }, [pin, pinResolved, router]);

  const handleStartGame = async () => {
    if (!pin || playerCount === 0 || starting) return;

    setStarting(true);
    setError("");

    try {
      await gameAPI.start(pin);
      const socket = getSocket();
      socket.emit("start_game", { pin });
      router.push(`/host/game/${pin}`);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to start game");
    } finally {
      setStarting(false);
    }
  };

  const handleSaveCertificateSettings = async () => {
    if (!pin || savingCertificate) return;
    setSavingCertificate(true);
    setError("");
    setCertificateMessage("");

    try {
      const formData = new FormData();
      formData.append("certificate_threshold", String(certificateThreshold));
      if (templateFile) {
        formData.append("template_pdf", templateFile);
      }

      const response = await gameAPI.updateCertificateSettings(pin, formData);
      setTemplateUploaded(Boolean(response.data?.certificate_template_uploaded));
      setCertificateMessage("Certificate settings saved");
      setTemplateFile(null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save certificate settings");
    } finally {
      setSavingCertificate(false);
    }
  };

  if (!pinResolved) {
    return (
      <div className="min-h-screen p-4 md:p-8 relative overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/15 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        <div className="max-w-6xl mx-auto">
          <div className="card text-center py-12">
            <p className="text-white/60">Loading lobby...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/host">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </motion.button>
          </Link>
          <h1 className="text-3xl md:text-5xl font-display font-bold">Lobby</h1>
          <div className="w-24" />
        </div>

        <div className="card mb-6">
          <div className="text-center">
            <p className="text-white/60 text-sm uppercase tracking-widest mb-2">Game PIN</p>
            <h2 className="text-5xl md:text-7xl font-mono font-bold tracking-wider text-red-300">{pin}</h2>
            <p className="text-white/60 mt-3">Share this PIN with players to join</p>
          </div>
        </div>

        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-display font-bold">Certificate Criteria</h3>
            {templateUploaded ? <span className="text-xs text-green-300">Template uploaded</span> : null}
          </div>

          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm text-white/70 mb-2">Minimum Correct (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={certificateThreshold}
                onChange={(e) => setCertificateThreshold(Math.max(1, Math.min(100, Number(e.target.value) || 75)))}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Template PDF</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                className="input-field file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-red-500/20 file:text-red-100"
              />
            </div>

            <Button
              onClick={handleSaveCertificateSettings}
              disabled={savingCertificate}
              className="btn-secondary"
            >
              {savingCertificate ? "Saving..." : "Save Certificate Settings"}
            </Button>
          </div>

          <p className="text-xs text-white/60 mt-3">
            Joiners can download a certificate if their score meets this threshold and a template PDF is uploaded.
          </p>

          {certificateMessage ? (
            <div className="mt-3 text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg p-3">{certificateMessage}</div>
          ) : null}
        </div>

        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-display font-bold">Players ({playerCount})</h3>
            <div className={connected ? "text-green-300 text-sm" : "text-yellow-300 text-sm"}>
              {connected ? "Connected" : "Connecting..."}
            </div>
          </div>

          {playerCount === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-lg text-center py-10 text-white/60">
              No players joined yet
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {players.map((player, i) => (
                <div key={`${player.player_id || player.name}-${i}`} className="bg-white/10 border border-white/20 rounded-lg p-4 text-center">
                  <span className="font-semibold">{player.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <div className="mb-6 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{error}</div>
        ) : null}

        <div className="flex justify-end">
          <Button
            onClick={handleStartGame}
            disabled={playerCount === 0 || starting}
            className="btn-primary flex items-center gap-2 px-8 py-6 text-lg"
          >
            <Play className="w-5 h-5" />
            {starting ? "Starting..." : "Start Game"}
          </Button>
        </div>
      </div>
    </div>
  );
}

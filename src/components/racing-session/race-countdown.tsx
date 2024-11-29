// src/components/racing-session/race-countdown.tsx
import React, { useEffect, useCallback } from "react";
import { motion } from "framer-motion";

interface RaceCountdownProps {
  timeLeft: number;
  playBeeps: boolean;
  voiceAnnouncements: boolean;
}

export const RaceCountdown: React.FC<RaceCountdownProps> = ({ timeLeft, playBeeps, voiceAnnouncements }) => {
  // Sound effects for countdown
  const playCountdownBeep = useCallback(
    async (type: "count" | "start") => {
      if (!playBeeps) return;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      if (type === "count") {
        oscillator.frequency.value = 440; // Standard A4 note
        gainNode.gain.value = 0.5;
        oscillator.type = "square";
      } else {
        oscillator.frequency.value = 880; // One octave higher
        gainNode.gain.value = 0.7;
        oscillator.type = "sawtooth";
      }

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      setTimeout(
        () => {
          oscillator.stop();
          audioContext.close();
        },
        type === "count" ? 100 : 400
      );
    },
    [playBeeps]
  );

  // Voice announcements
  const announce = useCallback(
    (text: string) => {
      if (!voiceAnnouncements) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.2;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = "en-US"; // Force English language

      // Wait for voices to be loaded
      const setVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        // First try to find Google US English voice
        let preferredVoice = voices.find((voice) => voice.name.includes("Google US English") || voice.name.includes("en-US"));

        // If no Google US voice, try any English voice
        if (!preferredVoice) {
          preferredVoice = voices.find((voice) => voice.lang.startsWith("en"));
        }

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      };

      // Check if voices are already loaded
      if (window.speechSynthesis.getVoices().length) {
        setVoice();
      } else {
        // Wait for voices to be loaded
        window.speechSynthesis.onvoiceschanged = setVoice;
      }

      window.speechSynthesis.speak(utterance);
    },
    [voiceAnnouncements]
  );

  // Handle countdown effects
  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0) {
      playCountdownBeep("count");
      announce(timeLeft.toString());
    } else if (timeLeft === 0) {
      playCountdownBeep("start");
      announce("Race start!");
    }
  }, [timeLeft, playCountdownBeep, announce]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      <motion.div key={timeLeft} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.3 }} className="text-center">
        {timeLeft > 0 ? (
          <>
            <h2 className="text-2xl font-semibold mb-2">Race Starting In</h2>
            <div className="text-6xl font-bold font-mono">{timeLeft}</div>
          </>
        ) : (
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.2, opacity: 1 }} transition={{ duration: 0.5 }} className="text-5xl font-bold text-green-600">
            GO!
          </motion.div>
        )}
      </motion.div>

      {/* Countdown Progress Ring */}
      <motion.div className="relative w-64 h-64 mt-8" style={{ transform: "rotate(-90deg)" }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="6" />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ pathLength: 1 }}
            animate={{ pathLength: timeLeft / 10 }} // TODO: Assuming 10 second countdown
            transition={{ duration: 1, ease: "linear" }}
            style={{
              strokeDasharray: "283",
              strokeDashoffset: "0",
            }}
          />
        </svg>
      </motion.div>

      <div className="text-sm text-gray-500 mt-4">
        {playBeeps && <span>🔊 Sound Effects On</span>}
        {voiceAnnouncements && <span className="ml-4">🎤 Voice Announcements On</span>}
      </div>
    </div>
  );
};

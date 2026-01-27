"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loginWithEmail } from "@/lib/magic";
import { authenticate } from "@/lib/flow";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<"magic" | "fcl">("magic");

  const handleMagicLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loginWithEmail(email);
      onSuccess();
      onClose();
    } catch (err) {
      setError("Login failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFCLLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      await authenticate();
      onSuccess();
      onClose();
    } catch (err) {
      setError("Wallet connection failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Connect Wallet</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Auth Method Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  authMethod === "magic"
                    ? "bg-[#d946ef] text-white"
                    : "bg-[#2d1f3d] text-gray-400 hover:text-white"
                }`}
                onClick={() => setAuthMethod("magic")}
              >
                Magic.link
              </button>
              <button
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  authMethod === "fcl"
                    ? "bg-[#d946ef] text-white"
                    : "bg-[#2d1f3d] text-gray-400 hover:text-white"
                }`}
                onClick={() => setAuthMethod("fcl")}
              >
                Flow Wallet
              </button>
            </div>

            {/* Magic.link Auth */}
            {authMethod === "magic" && (
              <form onSubmit={handleMagicLogin}>
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 bg-[#1a0a20] border border-[#3d2a50] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#d946ef] transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm mb-4">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="loading-spinner w-5 h-5" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      Continue with Email
                    </>
                  )}
                </button>

                <p className="text-center text-gray-500 text-sm mt-4">
                  Powered by Magic.link with Flow Cadence
                </p>
              </form>
            )}

            {/* FCL Wallet Auth */}
            {authMethod === "fcl" && (
              <div>
                <p className="text-gray-400 text-sm mb-4">
                  Connect your Flow wallet to start playing. Supports Blocto, Lilico, and more.
                </p>

                {error && (
                  <p className="text-red-400 text-sm mb-4">{error}</p>
                )}

                <button
                  onClick={handleFCLLogin}
                  disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="loading-spinner w-5 h-5" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                      </svg>
                      Connect Flow Wallet
                    </>
                  )}
                </button>

                {/* Wallet Options */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button className="flex items-center gap-2 p-3 bg-[#1a0a20] border border-[#3d2a50] rounded-lg hover:border-[#d946ef] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                    <span className="text-sm text-white">Blocto</span>
                  </button>
                  <button className="flex items-center gap-2 p-3 bg-[#1a0a20] border border-[#3d2a50] rounded-lg hover:border-[#d946ef] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500" />
                    <span className="text-sm text-white">Lilico</span>
                  </button>
                  <button className="flex items-center gap-2 p-3 bg-[#1a0a20] border border-[#3d2a50] rounded-lg hover:border-[#d946ef] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500" />
                    <span className="text-sm text-white">Dapper</span>
                  </button>
                  <button className="flex items-center gap-2 p-3 bg-[#1a0a20] border border-[#3d2a50] rounded-lg hover:border-[#d946ef] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-red-500" />
                    <span className="text-sm text-white">Flow Wallet</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

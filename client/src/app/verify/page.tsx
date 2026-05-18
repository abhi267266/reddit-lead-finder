"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmSignUp, resendSignUpCode } from "aws-amplify/auth";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const otpString = code.join("");
    if (otpString.length !== 6) {
      setError("Please enter all 6 digits");
      setLoading(false);
      return;
    }

    try {
      await confirmSignUp({
        username: email,
        confirmationCode: otpString,
      });
      router.push("/login?verified=true");
    } catch (err: any) {
      setError(err.message || "Invalid verification code.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setMessage("");
    try {
      await resendSignUpCode({ username: email });
      setMessage("Verification code resent! Check your email.");
    } catch (err: any) {
      setError(err.message || "Failed to resend code.");
    }
  };

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow 1 character per input
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-dark">
      {/* Dynamic Background Blurs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="glass-panel w-full max-w-md p-8 rounded-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">
            Verify Email
          </h1>
          <p className="text-slate-400 mt-2">
            We sent a 6-digit code to <span className="text-slate-200 font-medium">{email}</span>.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm">
              {message}
            </div>
          )}
          
          <div className="flex justify-between gap-2">
            {code.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="glass-input w-12 h-14 text-center text-xl font-bold rounded-lg focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || code.join("").length !== 6}
            className="w-full py-3 px-4 bg-gradient-to-r from-secondary to-pink-500 text-white font-medium rounded-lg hover:from-pink-500 hover:to-secondary transition-all duration-300 shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:opacity-70"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Didn&apos;t receive the code?{" "}
          <button 
            onClick={handleResend}
            type="button"
            className="text-secondary hover:text-pink-400 font-medium transition-colors"
          >
            Resend
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Verify() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-dark text-slate-400">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}

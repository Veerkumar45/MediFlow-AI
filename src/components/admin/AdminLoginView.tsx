import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  KeyRound
} from 'lucide-react';
import { ClinicProfile } from '../../types/index.ts';

interface AdminLoginViewProps {
  clinic: ClinicProfile;
  onLoginSuccess: () => void;
  onBackToGateway: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  clinic,
  onLoginSuccess,
  onBackToGateway
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFillCredentials = () => {
    setUsername('admin');
    setPassword('admin123');
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Validate credentials
      if (
        (cleanUser === 'admin' || cleanUser === 'admin@harmonyclinic.com') &&
        (cleanPass === 'admin123' || cleanPass === 'mediflow2026')
      ) {
        setIsLoading(false);
        onLoginSuccess();
      } else {
        setIsLoading(false);
        setErrorMessage('Invalid username or password. Please use admin / admin123.');
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-slate-900 to-slate-950 pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">
        {/* Top Back Button */}
        <button
          onClick={onBackToGateway}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Portal Selection</span>
        </button>

        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Admin Console Login</h1>
          <p className="text-xs text-slate-400 mt-1">{clinic.name} · Authorized Practice Personnel Only</p>
        </div>

        {/* Demo Credentials Quick Fill Banner */}
        <div className="bg-slate-700/50 border border-slate-600/60 rounded-xl p-3 mb-5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <KeyRound className="w-4 h-4 text-teal-400 shrink-0" />
            <div>
              <span className="font-semibold text-white">admin</span> / <span className="font-semibold text-white">admin123</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFillCredentials}
            className="px-2.5 py-1 text-[11px] font-semibold bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 rounded-lg transition-colors"
          >
            Fill Demo
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 rounded-xl p-3 mb-4 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-900/80 border border-slate-700 focus:border-teal-500 rounded-xl text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-900/80 border border-slate-700 focus:border-teal-500 rounded-xl text-white placeholder-slate-500 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-teal-900/20 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>Verifying credentials...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In to Admin Console</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
          <p className="text-[11px] text-slate-500">
            MediFlow AI Security Boundary: Administrative privileges are required to configure autonomous scheduling automations, adjust clinical rules, and export patient reports.
          </p>
        </div>
      </div>
    </div>
  );
};

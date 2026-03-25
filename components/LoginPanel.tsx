import React, { useState } from 'react';
import { authService } from '../authService';

export const LoginPanel: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await authService.loginWithEmail(email, password);
      else await authService.registerWithEmail(email, password);
    } catch (err: any) {
      setError(err?.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[120] bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">IdeaTasks Board</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Entre para carregar seu workspace.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          onClick={async () => {
            setLoading(true);
            try {
              await authService.loginWithGoogle();
            } catch (err: any) {
              setError(err?.message || 'Falha no login com Google.');
            } finally {
              setLoading(false);
            }
          }}
          className="w-full mt-3 border border-gray-300 dark:border-gray-600 py-2 rounded-lg text-sm"
        >
          Entrar com Google
        </button>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-3 text-xs text-blue-600 dark:text-blue-400"
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  );
};

import { FormEvent, useState } from 'react';
import { Building2, Lock, User } from 'lucide-react';
import { login } from '../services/api';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username.trim(), password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-outline-variant/30 bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold text-primary">Gestión de Propiedades</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Ingresa para administrar reservas, huéspedes y finanzas.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-bold text-on-surface">Usuario</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-lg border border-outline-variant/30 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-on-surface">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-outline-variant/30 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

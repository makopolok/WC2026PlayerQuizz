import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function Share() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [startingChallenge, setStartingChallenge] = useState(true);

  async function startChallenge() {
    setStartingChallenge(true);
    setError(null);
    try {
      const res = await fetch(`/api/game/${id}/rematch`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start challenge.');
      navigate('/play', { state: { sessionId: data.sessionId, players: data.players } });
    } catch (err) {
      setError(err.message);
      setStartingChallenge(false);
    }
  }

  useEffect(() => {
    startChallenge();
  }, [id]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold text-yellow-400">⚽ Loading challenge…</h1>
      <p className="text-gray-400 text-center max-w-md">
        You are getting the same quiz set.
      </p>
      {error && (
        <>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={startChallenge}
            disabled={startingChallenge}
            className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-900 font-bold py-2 px-8 rounded-full transition"
          >
            {startingChallenge ? 'Starting…' : 'Try again'}
          </button>
        </>
      )}
    </div>
  );
}

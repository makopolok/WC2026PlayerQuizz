import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [leaderboardError, setLeaderboardError] = useState(null);

  useEffect(() => {
    fetch('/api/leaderboard?limit=10')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load leaderboard');
        setLeaders(data);
      })
      .catch((err) => {
        setLeaderboardError(err.message);
      });
  }, []);

  async function startGame() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/game');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start game');
      navigate('/play', { state: { sessionId: data.sessionId, players: data.players } });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <img
        src="/8bit-trophy-transparent.png"
        alt=""
        className="absolute pointer-events-none"
        style={{
          width: '380px',
          height: 'auto',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -68%)',
          opacity: 0.12,
          zIndex: 0,
        }}
      />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-6 px-4">

        <h1 className="text-5xl font-bold text-yellow-400">WC2026 Players Names Quizz</h1>
        <p className="text-gray-400 text-lg text-center max-w-md">
          Can you guess the nationality of 10 World Cup 2026 players?
        </p>
        <div className="text-sm text-gray-500 flex gap-6">
          <span>🥇 1st try = 3 pts</span>
          <span>🥈 2nd try = 2 pts</span>
          <span>🥉 3rd try = 1 pt</span>
        </div>
        {error && <p className="text-red-400 text-sm">❌ {error}</p>}
        <button
          onClick={startGame}
          disabled={loading}
          autoFocus
          className="mt-4 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-900 font-bold py-3 px-10 rounded-full text-xl transition"
        >
          {loading ? 'Loading…' : 'Play Now'}
        </button>

        <div className="mt-8 w-full max-w-md bg-gray-900 rounded-2xl p-5">
          <h2 className="text-xl font-bold text-yellow-400 mb-3">🏅 Leaderboard</h2>
          {leaderboardError ? (
            <p className="text-sm text-gray-400">Leaderboard unavailable right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {leaders.length === 0 ? (
                <p className="text-sm text-gray-400">No scores yet. Be the first!</p>
              ) : (
                leaders.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-300">#{entry.rank} {entry.name}</span>
                    <span className="font-bold text-yellow-400">{entry.score}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center">
          Beta 1.2
        </p>
      </div>
    </div>
  );
}

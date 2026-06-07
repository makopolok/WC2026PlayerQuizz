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
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-10" style={{ background: '#0a0e1a' }}>

      {/* 8-bit terminal screen card */}
      <div className="w-full max-w-md rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl" style={{ background: '#0d1117' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ background: '#111827' }}>
          <div className="font-retro flex flex-col gap-2">
            <span className="text-base tracking-widest uppercase" style={{ color: '#c9d1d9', letterSpacing: '0.15em' }}>
              GUESS 7 NATIONALITIES
            </span>
            <span className="text-2xl font-bold tracking-widest uppercase" style={{ color: '#39d353', letterSpacing: '0.15em' }}>
              WORLD CUP 2026
            </span>
          </div>
          <img
            src="/8bit-trophy-transparent.png"
            alt="trophy"
            className="w-20 h-auto"
          />
        </div>
        {/* scanline effect strip */}
        <div className="h-1" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(57,211,83,0.05) 2px, rgba(57,211,83,0.05) 4px)' }} />
      </div>

      {/* Subtitle */}
      <p className="font-retro text-xs tracking-widest text-center max-w-xs" style={{ color: '#39d353', opacity: 0.7 }}>
        3 TRIES PER PLAYER &bull; CHALLENGE YOUR FRIENDS
      </p>

      {/* Score legend */}
      <div className="font-retro text-xs flex gap-6" style={{ color: '#8b949e' }}>
        <span>1ST TRY = 3 PTS</span>
        <span>2ND = 2 PTS</span>
        <span>3RD = 1 PT</span>
      </div>

      {error && <p className="text-red-400 text-sm">❌ {error}</p>}

      {/* Play button */}
      <button
        onClick={startGame}
        disabled={loading}
        autoFocus
        className="font-retro tracking-widest text-sm px-10 py-3 rounded border-2 transition-all"
        style={{
          background: loading ? '#1a2e1a' : '#39d353',
          color: loading ? '#39d353' : '#0a0e1a',
          borderColor: '#39d353',
          opacity: loading ? 0.6 : 1,
          boxShadow: loading ? 'none' : '0 0 16px rgba(57,211,83,0.4)',
        }}
      >
        {loading ? 'LOADING...' : '▶  PLAY NOW'}
      </button>

      {/* Leaderboard */}
      <div className="w-full max-w-md rounded-xl border border-gray-800 p-5" style={{ background: '#0d1117' }}>
        <h2 className="font-retro text-sm tracking-widest mb-4" style={{ color: '#39d353' }}>🏅 LEADERBOARD</h2>
        {leaderboardError ? (
          <p className="font-retro text-xs" style={{ color: '#8b949e' }}>UNAVAILABLE RIGHT NOW.</p>
        ) : leaders.length === 0 ? (
          <p className="font-retro text-xs" style={{ color: '#8b949e' }}>NO SCORES YET. BE THE FIRST!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {leaders.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded px-3 py-2" style={{ background: '#161b22' }}>
                <span className="font-retro text-xs" style={{ color: '#c9d1d9' }}>#{entry.rank} {entry.name.toUpperCase()}</span>
                <span className="font-retro text-xs font-bold" style={{ color: '#39d353' }}>{entry.score} PTS</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="font-retro text-xs" style={{ color: '#30363d' }}>BETA 1.2</p>
    </div>
  );
}

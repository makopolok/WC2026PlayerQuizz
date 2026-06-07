import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [playerLoading, setPlayerLoading] = useState(false);
  const [uniformLoading, setUniformLoading] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [uniformError, setUniformError] = useState(null);
  const [playerLeaders, setPlayerLeaders] = useState([]);
  const [uniformLeaders, setUniformLeaders] = useState([]);
  const [playerLeaderboardError, setPlayerLeaderboardError] = useState(null);
  const [uniformLeaderboardError, setUniformLeaderboardError] = useState(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    fetch('/api/leaderboard?limit=5')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load leaderboard');
        setPlayerLeaders(data);
      })
      .catch((err) => setPlayerLeaderboardError(err.message));

    fetch('/api/uniforms/leaderboard?limit=5')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load uniforms leaderboard');
        setUniformLeaders(data);
      })
      .catch((err) => setUniformLeaderboardError(err.message));
  }, []);

  async function startPlayerGame() {
    setPlayerLoading(true);
    setPlayerError(null);
    try {
      const res = await fetch('/api/game');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start game');
      navigate('/play', { state: { sessionId: data.sessionId, players: data.players } });
    } catch (err) {
      setPlayerError(err.message);
      setPlayerLoading(false);
    }
  }

  async function startUniformGame() {
    setUniformLoading(true);
    setUniformError(null);
    try {
      const res = await fetch('/api/uniforms/game');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start game');
      navigate('/uniform-play', { state: { sessionId: data.sessionId, uniforms: data.uniforms } });
    } catch (err) {
      setUniformError(err.message);
      setUniformLoading(false);
    }
  }

  async function shareHome() {
    const shareUrl = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        throw new Error('No share support');
      }
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-10 gap-6" style={{ background: '#0a0e1a' }}>
      <div className="w-full max-w-3xl rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl" style={{ background: '#0d1117' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ background: '#111827' }}>
          <div className="font-retro flex flex-col gap-2">
            <span className="text-base tracking-widest uppercase" style={{ color: '#c9d1d9', letterSpacing: '0.15em' }}>
              WC2026 QUIZ ARCADE
            </span>
            <span className="text-2xl font-bold tracking-widest uppercase" style={{ color: '#39d353', letterSpacing: '0.15em' }}>
              CHOOSE YOUR GAME
            </span>
          </div>
          <img src="/8bit-trophy-transparent.png" alt="trophy" className="w-20 h-auto" />
        </div>
      </div>

      <div className="w-full max-w-3xl grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-800 p-5 flex flex-col gap-4" style={{ background: '#0d1117' }}>
          <h2 className="font-retro text-sm tracking-widest" style={{ color: '#39d353' }}>⚽ PLAYERS QUIZ</h2>
          <p className="text-sm text-gray-400">Guess the country of 7 players. 3 tries each.</p>
          {playerError && <p className="text-red-400 text-sm">❌ {playerError}</p>}
          <button
            onClick={startPlayerGame}
            disabled={playerLoading}
            className="font-retro tracking-widest text-sm px-6 py-3 rounded border-2 transition-all"
            style={{
              background: playerLoading ? '#1a2e1a' : '#39d353',
              color: playerLoading ? '#39d353' : '#0a0e1a',
              borderColor: '#39d353',
              opacity: playerLoading ? 0.6 : 1,
            }}
          >
            {playerLoading ? 'LOADING...' : '▶ PLAY PLAYERS QUIZ'}
          </button>
          <div className="flex flex-col gap-2">
            <p className="text-yellow-400 font-semibold text-sm">🏅 Leaderboard</p>
            {playerLeaderboardError ? (
              <p className="text-xs text-gray-500">Unavailable right now.</p>
            ) : playerLeaders.length === 0 ? (
              <p className="text-xs text-gray-500">No scores yet.</p>
            ) : (
              playerLeaders.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded px-3 py-2 text-sm" style={{ background: '#161b22' }}>
                  <span className="text-gray-300">#{entry.rank} {entry.name}</span>
                  <span className="font-bold text-yellow-400">{entry.score}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 p-5 flex flex-col gap-4" style={{ background: '#0d1117' }}>
          <h2 className="font-retro text-sm tracking-widest" style={{ color: '#39d353' }}>👕 UNIFORMS QUIZ</h2>
          <p className="text-sm text-gray-400">Guess 5 national teams by their uniforms.</p>
          {uniformError && <p className="text-red-400 text-sm">❌ {uniformError}</p>}
          <button
            onClick={startUniformGame}
            disabled={uniformLoading}
            className="font-retro tracking-widest text-sm px-6 py-3 rounded border-2 transition-all"
            style={{
              background: uniformLoading ? '#1a2e1a' : '#39d353',
              color: uniformLoading ? '#39d353' : '#0a0e1a',
              borderColor: '#39d353',
              opacity: uniformLoading ? 0.6 : 1,
            }}
          >
            {uniformLoading ? 'LOADING...' : '▶ PLAY UNIFORMS QUIZ'}
          </button>
          <div className="flex flex-col gap-2">
            <p className="text-yellow-400 font-semibold text-sm">🏅 Uniforms Leaderboard</p>
            {uniformLeaderboardError ? (
              <p className="text-xs text-gray-500">Unavailable right now.</p>
            ) : uniformLeaders.length === 0 ? (
              <p className="text-xs text-gray-500">No scores yet.</p>
            ) : (
              uniformLeaders.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded px-3 py-2 text-sm" style={{ background: '#161b22' }}>
                  <span className="text-gray-300">#{entry.rank} {entry.name}</span>
                  <span className="font-bold text-yellow-400">{entry.score}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={shareHome}
        className="text-xs underline transition-opacity"
        style={{ color: '#6b7280', opacity: 0.9 }}
      >
        {shared ? '✓ Shared' : 'Share wc2026quiz.com'}
      </button>

      <p className="font-retro text-xs" style={{ color: '#30363d' }}>BETA 2.1</p>
    </div>
  );
}

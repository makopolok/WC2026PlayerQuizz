import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const MAX_SCORE = 30; // 10 players × 3 pts

export default function Results() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state) { navigate('/'); return null; }

  const { shareId, totalScore, players, guesses } = state;
  const shareUrl = `${window.location.origin}/share/${shareId}`;
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [savedScore, setSavedScore] = useState(false);
  const [leaderboardMessage, setLeaderboardMessage] = useState(null);

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    alert('Link copied!');
  }

  async function submitLeaderboardScore() {
    setSubmitError(null);
    setLeaderboardMessage(null);
    if (!playerName.trim()) {
      setSubmitError('Please enter a name.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName.trim(), score: totalScore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save score.');
      if (data.saved) {
        setSavedScore(true);
        setLeaderboardMessage(
          data.firstTime
            ? `✅ Saved! You're on the leaderboard with ${data.bestScore} pts.`
            : `✅ New best score saved: ${data.bestScore} pts.`
        );
      } else {
        setLeaderboardMessage(
          `💡 Your best score is ${data.bestScore} pts. Try again to beat your own best score.`
        );
      }
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const emoji = totalScore >= 25 ? '🏆' : totalScore >= 15 ? '⭐' : '⚽';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-10">
      <h1 className="text-4xl font-bold text-yellow-400">{emoji} Game Over!</h1>
      <p className="text-2xl">
        Your score: <strong className="text-yellow-400">{totalScore}</strong> / {MAX_SCORE}
      </p>

      {/* Per-player summary */}
      <div className="w-full max-w-md flex flex-col gap-2">
        {players.map((player, i) => {
          const g = guesses[i];
          return (
            <div key={player.id} className="bg-gray-900 rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="font-semibold">{player.name}</span>
              <span className="text-sm text-gray-400">{player.country}</span>
              <span className={`font-bold ${g?.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {g?.points > 0 ? `+${g.points}` : '0'} pts
              </span>
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-md bg-gray-900 rounded-xl px-4 py-4 flex flex-col gap-3">
        <p className="text-gray-300 font-semibold">Submit your score to leaderboard</p>
        <input
          type="text"
          value={playerName}
          maxLength={24}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Your name"
          disabled={savedScore || submitting}
          className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
        />
        {submitError && <p className="text-red-400 text-sm">❌ {submitError}</p>}
        {leaderboardMessage && (
          <p className={savedScore ? 'text-green-400 text-sm' : 'text-yellow-400 text-sm'}>
            {leaderboardMessage}
          </p>
        )}
        {!savedScore && (
          <button
            onClick={submitLeaderboardScore}
            disabled={submitting}
            className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-900 font-bold py-2 px-6 rounded-full transition"
          >
            {submitting ? 'Saving…' : 'Save score'}
          </button>
        )}
      </div>

      {/* Share */}
      <div className="flex flex-col items-center gap-3 mt-4">
        <p className="text-gray-400 text-sm">Challenge your friends!</p>
        <button
          onClick={copyLink}
          className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-2 px-8 rounded-full transition"
        >
          📋 Copy Share Link
        </button>
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-gray-300 text-sm underline"
        >
          Play again
        </button>
      </div>
    </div>
  );
}

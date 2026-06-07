import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const MAX_SCORE = 15; // 5 uniforms × 3 pts

export default function UniformResults() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state) { navigate('/'); return null; }

  const { shareId, totalScore, uniforms, guesses } = state;
  const shareUrl = `${window.location.origin}/uniform-share/${shareId}`;
  const [playerName, setPlayerName] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [savedScore, setSavedScore] = useState(false);
  const [leaderboardMessage, setLeaderboardMessage] = useState(null);
  const [leaders, setLeaders] = useState(null);

  const TAUNTS = [
    `I scored ${totalScore}/${MAX_SCORE} on the WC 2026 uniforms quiz. Can you beat it?`,
    `${totalScore}/${MAX_SCORE} in the uniforms challenge. Your turn.`,
    `I got ${totalScore}/${MAX_SCORE} guessing kits on WC 2026 Quiz. Beat that.`,
    `Score to beat: ${totalScore}/${MAX_SCORE}. Same uniforms, same rules.`,
  ];
  const taunt = TAUNTS[totalScore % TAUNTS.length];
  const shareText = `${taunt}\n\n${shareUrl}`;

  async function share() {
    const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent || '');
    try {
      if (isMobile && navigator.share) {
        await navigator.share({
          title: 'WC 2026 Quiz',
          text: taunt,
          url: shareUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        throw new Error('Clipboard unavailable');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
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
      const res = await fetch('/api/uniforms/leaderboard', {
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
            ? `✅ Saved! You're on the uniforms leaderboard with ${data.bestScore} pts.`
            : `✅ New best score saved: ${data.bestScore} pts.`
        );
      } else {
        setLeaderboardMessage(`💡 Your best uniforms score is ${data.bestScore} pts.`);
      }
      const lb = await fetch('/api/uniforms/leaderboard?limit=10');
      if (lb.ok) setLeaders(await lb.json());
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const emoji = totalScore >= 12 ? '🏆' : totalScore >= 7 ? '⭐' : '⚽';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-10">
      <h1 className="text-4xl font-bold text-yellow-400">{emoji} Uniform Challenge Over!</h1>
      <p className="text-2xl">
        Your score: <strong className="text-yellow-400">{totalScore}</strong> / {MAX_SCORE}
      </p>

      <div className="w-full max-w-md flex flex-col gap-2">
        {uniforms.map((uniform, i) => {
          const g = guesses[i];
          return (
            <div key={uniform.id} className="bg-gray-900 rounded-xl px-4 py-3 flex justify-between items-center">
              <div className="min-w-0 pr-3 flex items-center gap-3">
                <img src={uniform.imageUrl.replace(/\.png$/i, '.webp')} alt={uniform.country} className="w-10 h-10 rounded object-cover border border-gray-700" />
                <p className="font-semibold truncate">{uniform.country}</p>
              </div>
              <span className={`font-bold ${g?.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {g?.points > 0 ? `+${g.points}` : '0'} pts
              </span>
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-md bg-gray-900 rounded-xl px-4 py-4 flex flex-col gap-3">
        <p className="text-gray-300 font-semibold">Submit your score to uniforms leaderboard</p>
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

        {leaders && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-yellow-400 font-semibold text-sm">🏅 Uniforms Leaderboard</p>
            {leaders.map((entry) => (
              <div
                key={entry.id}
                className={`flex justify-between items-center rounded-lg px-3 py-2 text-sm ${entry.name.toLowerCase() === playerName.trim().toLowerCase() ? 'bg-yellow-400/20 text-yellow-300 font-bold' : 'bg-gray-800 text-gray-300'}`}
              >
                <span>#{entry.rank} {entry.name}</span>
                <span>{entry.score} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 mt-4">
        <p className="text-gray-400 text-sm">Share your score and invite friends to play.</p>
        <button
          onClick={share}
          className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-2 px-8 rounded-full transition"
        >
          {copied ? '✅ Shared!' : '📲 Share Quiz'}
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

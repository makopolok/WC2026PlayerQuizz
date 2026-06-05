import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CountryInput from '../components/CountryInput';

const POINTS_MAP = { 1: 3, 2: 2, 3: 1 };

export default function Play() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const { sessionId, players } = state || {};
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | 'out'
  const [revealed, setRevealed] = useState(false); // photo + info shown after guess resolves
  const [revealedCountry, setRevealedCountry] = useState(null);

  useEffect(() => {
    if (!players) navigate('/');
  }, [players, navigate]);

  if (!players) return null;

  const currentPlayer = players[currentIndex];
  const isLastPlayer = currentIndex === players.length - 1;

  async function handleGuess(guess) {
    const res = await fetch('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, playerId: currentPlayer.id, guess, attemptNumber }),
    });
    const data = await res.json();

    if (data.correct) {
      const pts = POINTS_MAP[attemptNumber];
      setTotalScore(s => s + pts);
      setFeedback('correct');
      setRevealedCountry(data.country);
      setRevealed(true);

      const newGuess = { playerId: currentPlayer.id, attempts: attemptNumber, points: pts };
      const updatedGuesses = [...guesses, newGuess];
      setGuesses(updatedGuesses);

      setTimeout(() => advance(updatedGuesses), 2000);
    } else {
      if (attemptNumber === 3) {
        setFeedback('out');
        setRevealedCountry(data.country); // API now returns country on final attempt
        setRevealed(true);

        const newGuess = { playerId: currentPlayer.id, attempts: 3, points: 0 };
        const updatedGuesses = [...guesses, newGuess];
        setGuesses(updatedGuesses);

        setTimeout(() => advance(updatedGuesses), 2500);
      } else {
        setFeedback('wrong');
        setAttemptNumber(a => a + 1);
        setTimeout(() => setFeedback(null), 800);
      }
    }
  }

  function advance(updatedGuesses) {
    setFeedback(null);
    setRevealedCountry(null);
    setRevealed(false);
    setAttemptNumber(1);

    if (isLastPlayer) {
      completeGame(updatedGuesses);
    } else {
      setCurrentIndex(i => i + 1);
    }
  }

  async function completeGame(finalGuesses) {
    const score = finalGuesses.reduce((sum, g) => sum + g.points, 0);
    const res = await fetch('/api/game/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, guesses: finalGuesses, totalScore: score }),
    });
    const data = await res.json();
    navigate('/results', { state: { shareId: data.shareId, totalScore: score, players, guesses: finalGuesses } });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
      {/* Progress + score */}
      <div className="flex justify-between w-full max-w-md text-sm text-gray-400">
        <span>Player {currentIndex + 1} / {players.length}</span>
        <span>Score: <strong className="text-yellow-400">{totalScore}</strong></span>
      </div>

      {/* Player card */}
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md flex flex-col items-center gap-4 shadow-xl">
        {/* Photo — hidden during guessing, revealed after */}
        {revealed ? (
          currentPlayer.photo_url ? (
            <img
              src={currentPlayer.photo_url}
              alt={currentPlayer.name}
              className="w-40 h-40 object-cover rounded-full border-4 border-yellow-400"
            />
          ) : (
            <div className="w-40 h-40 rounded-full bg-gray-700 flex items-center justify-center text-5xl">⚽</div>
          )
        ) : (
          <div className="w-40 h-40 rounded-full bg-gray-800 border-4 border-gray-600 flex items-center justify-center text-5xl select-none">
            ❓
          </div>
        )}

        <h2 className="text-2xl font-bold">{currentPlayer.name}</h2>
        {currentPlayer.position && (
          <span className="text-sm text-gray-400">{currentPlayer.position}</span>
        )}

        {/* Revealed country */}
        {revealed && (
          <div className={`text-lg font-semibold ${feedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
            {feedback === 'correct'
              ? `✅ ${revealedCountry} — +${POINTS_MAP[attemptNumber]} pts`
              : `❌ The answer was: ${revealedCountry}`}
          </div>
        )}

        {/* Attempt dots + input — only visible while guessing */}
        {!revealed && (
          <>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className={`w-3 h-3 rounded-full ${
                    n < attemptNumber ? 'bg-red-500' : n === attemptNumber ? 'bg-yellow-400' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            {feedback === 'wrong' && (
              <p className="text-red-400 font-semibold text-sm">❌ Wrong! Try again…</p>
            )}

            <CountryInput onSubmit={handleGuess} disabled={feedback === 'wrong'} />
          </>
        )}
      </div>
    </div>
  );
}

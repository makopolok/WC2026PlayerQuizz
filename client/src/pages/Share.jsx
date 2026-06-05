import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const MAX_SCORE = 30;

export default function Share() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/game/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setGame(data);
      })
      .catch(() => setError('Failed to load game.'));
  }, [id]);

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-red-400">{error}</p>
      <button onClick={() => navigate('/')} className="text-yellow-400 underline">Play yourself</button>
    </div>
  );

  if (!game) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">Loading…</div>
  );

  const emoji = game.totalScore >= 25 ? '🏆' : game.totalScore >= 15 ? '⭐' : '⚽';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold text-yellow-400">{emoji} A friend's result</h1>
      <p className="text-xl">
        Score: <strong className="text-yellow-400">{game.totalScore}</strong> / {MAX_SCORE}
      </p>

      <div className="w-full max-w-md flex flex-col gap-2">
        {game.players.map((player, i) => {
          const g = game.guesses[i];
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

      <button
        onClick={() => navigate('/')}
        className="mt-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-2 px-8 rounded-full transition"
      >
        Play yourself!
      </button>
    </div>
  );
}

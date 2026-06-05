import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  async function startGame() {
    const res = await fetch('/api/game');
    const data = await res.json();
    navigate('/play', { state: { sessionId: data.sessionId, players: data.players } });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
      <h1 className="text-5xl font-bold text-yellow-400">⚽ WC2026 Player Quiz</h1>
      <p className="text-gray-400 text-lg text-center max-w-md">
        Can you guess the nationality of 10 World Cup 2026 players?
        You get 3 tries per player — the faster you guess, the more points you earn!
      </p>
      <div className="text-sm text-gray-500 flex gap-6">
        <span>🥇 1st try = 3 pts</span>
        <span>🥈 2nd try = 2 pts</span>
        <span>🥉 3rd try = 1 pt</span>
      </div>
      <button
        onClick={startGame}
        className="mt-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-3 px-10 rounded-full text-xl transition"
      >
        Play Now
      </button>
    </div>
  );
}

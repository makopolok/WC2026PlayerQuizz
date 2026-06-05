import { useState, useEffect, useRef } from 'react';

export default function CountryInput({ onSubmit, disabled, excludedCountries = [] }) {
  const [typed, setTyped] = useState('');
  const [countries, setCountries] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    fetch('/api/countries')
      .then(r => r.json())
      .then(setCountries);
  }, []);

  useEffect(() => {
    if (!disabled) {
      setTyped('');
      setSuggestions([]);
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [disabled]);

  useEffect(() => {
    if (typed.trim()) {
      setSuggestions(getMatches(typed));
      setActiveIndex(0);
    }
  }, [excludedCountries]);

  function getMatches(v) {
    const query = v.trim();
    if (!query) return [];
    const matches = query === '+'
      ? countries
      : countries.filter(c => c.toLowerCase().startsWith(query.toLowerCase()));
    return matches.filter(country => !excludedCountries.some(excluded => excluded.toLowerCase() === country.toLowerCase())).slice(0, 8);
  }

  const topSuggestion = suggestions[activeIndex] || suggestions[0] || null;

  function handleChange(e) {
    const v = e.target.value;
    setTyped(v);
    setActiveIndex(0);
    setSuggestions(getMatches(v));
  }

  function handleSelect(country) {
    setTyped(country);
    setSuggestions([]);
    setActiveIndex(0);
    onSubmit(country);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!suggestions.length) return;
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!suggestions.length) return;
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
      // Accept top suggestion
      if (topSuggestion && typed.toLowerCase() !== topSuggestion.toLowerCase()) {
        e.preventDefault();
        setTyped(topSuggestion);
        setSuggestions(getMatches(topSuggestion));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = suggestions[activeIndex] || topSuggestion;
      if (selected) {
        handleSelect(selected);
      } else if (typed.trim()) {
        setSuggestions([]);
        onSubmit(typed.trim());
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setActiveIndex(0);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[activeIndex];
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={typed}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a country (or + for all)…"
        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 disabled:opacity-40"
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-xl mt-1 overflow-y-auto shadow-lg max-h-52"
        >
          {suggestions.map((c, i) => (
            <li
              key={c}
              onClick={() => handleSelect(c)}
              className={`px-4 py-2 cursor-pointer text-sm ${
                i === activeIndex ? 'bg-yellow-400 text-gray-900 font-semibold' : 'hover:bg-gray-700'
              }`}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

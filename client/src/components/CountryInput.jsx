import { useState, useEffect, useRef } from 'react';

export default function CountryInput({ onSubmit, disabled }) {
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

  function getMatches(v) {
    if (!v) return [];
    return countries.filter(c => c.toLowerCase().startsWith(v.toLowerCase())).slice(0, 8);
  }

  // The value shown in the input: typed + inline completion suffix
  const topSuggestion = suggestions[activeIndex] || suggestions[0] || null;
  const inlineCompletion = topSuggestion && topSuggestion.toLowerCase().startsWith(typed.toLowerCase())
    ? topSuggestion
    : typed;

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
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
      // Accept inline completion
      if (topSuggestion && typed.length < topSuggestion.length) {
        e.preventDefault();
        setTyped(topSuggestion);
        setSuggestions([]);
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

  // After render, select the inline-completed suffix so typing replaces it
  useEffect(() => {
    const input = inputRef.current;
    if (!input || !topSuggestion || typed.length === 0) return;
    if (document.activeElement !== input) return;
    // Set selection: typed portion is unselected, completion is selected
    if (topSuggestion.toLowerCase().startsWith(typed.toLowerCase())) {
      input.setSelectionRange(typed.length, topSuggestion.length);
    }
  });

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
        value={inlineCompletion}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a country…"
        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 disabled:opacity-40"
        autoComplete="off"
      />
      {suggestions.length > 1 && (
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

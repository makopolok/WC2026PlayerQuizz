import { useState, useEffect, useMemo, useRef } from 'react';

export default function CountryInput({ onSubmit, onInvalid, disabled, excludedCountries = [] }) {
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
      setSuggestions(getMatches(''));
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [disabled]);

  useEffect(() => {
    setSuggestions(getMatches(typed));
    setActiveIndex(0);
  }, [excludedCountries]);

  const countryLookup = useMemo(() => {
    return new Map(countries.map(country => [country.toLowerCase(), country]));
  }, [countries]);

  function isExcluded(country) {
    return excludedCountries.some(excluded => excluded.toLowerCase() === country.toLowerCase());
  }

  function getMatches(v) {
    const query = v.trim();
    const availableCountries = countries.filter(
      country => !excludedCountries.some(excluded => excluded.toLowerCase() === country.toLowerCase())
    );
    if (!query || query === '+') return availableCountries.slice(0, 48);
    return countries
      .filter(c => c.toLowerCase().startsWith(query.toLowerCase()))
      .filter(country => !excludedCountries.some(excluded => excluded.toLowerCase() === country.toLowerCase()))
      .slice(0, 8);
  }

  const topSuggestion = suggestions[activeIndex] || suggestions[0] || null;

  function handleChange(e) {
    const v = e.target.value;
    setTyped(v);
    setActiveIndex(0);
    setSuggestions(getMatches(v));
  }

  useEffect(() => {
    if (!typed.trim()) {
      setSuggestions(getMatches(''));
      setActiveIndex(0);
    }
  }, [countries, excludedCountries]);

  function handleSelect(country) {
    if (isExcluded(country)) {
      onInvalid?.('You already tried that country.');
      setSuggestions([]);
      return;
    }
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
        const exactMatch = countryLookup.get(typed.trim().toLowerCase());
        if (exactMatch) {
          handleSelect(exactMatch);
        } else {
          setSuggestions([]);
          onInvalid?.('Please choose a country from the list.');
        }
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
        placeholder="Type a country…"
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

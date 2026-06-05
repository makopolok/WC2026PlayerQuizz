import { useState, useEffect, useRef } from 'react';

export default function CountryInput({ onSubmit, disabled }) {
  const [value, setValue] = useState('');
  const [countries, setCountries] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    fetch('/api/countries')
      .then(r => r.json())
      .then(setCountries);
  }, []);

  useEffect(() => {
    if (!disabled) {
      setValue('');
      setSuggestions([]);
      setActiveIndex(-1);
      inputRef.current?.focus();
    }
  }, [disabled]);

  function handleChange(e) {
    const v = e.target.value;
    setValue(v);
    setActiveIndex(-1);
    if (v.length < 1) { setSuggestions([]); return; }
    setSuggestions(
      countries.filter(c => c.toLowerCase().startsWith(v.toLowerCase())).slice(0, 8)
    );
  }

  function handleSelect(country) {
    setValue(country);
    setSuggestions([]);
    setActiveIndex(-1);
    onSubmit(country);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        handleSelect(suggestions[activeIndex]);
      } else if (value.trim()) {
        setSuggestions([]);
        onSubmit(value.trim());
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex];
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={activeIndex >= 0 ? suggestions[activeIndex] : value}
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

import { useState, useEffect, useRef } from 'react';

export default function CountryInput({ onSubmit, disabled }) {
  const [value, setValue] = useState('');
  const [countries, setCountries] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch('/api/countries')
      .then(r => r.json())
      .then(setCountries);
  }, []);

  useEffect(() => {
    if (!disabled) {
      setValue('');
      inputRef.current?.focus();
    }
  }, [disabled]);

  function handleChange(e) {
    const v = e.target.value;
    setValue(v);
    if (v.length < 1) { setSuggestions([]); return; }
    setSuggestions(
      countries.filter(c => c.toLowerCase().startsWith(v.toLowerCase())).slice(0, 6)
    );
  }

  function handleSelect(country) {
    setValue(country);
    setSuggestions([]);
    onSubmit(country);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && value.trim()) {
      setSuggestions([]);
      onSubmit(value.trim());
    }
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a country…"
        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 disabled:opacity-40"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-xl mt-1 overflow-hidden shadow-lg">
          {suggestions.map(c => (
            <li
              key={c}
              onClick={() => handleSelect(c)}
              className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm"
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

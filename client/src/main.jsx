import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import Home from './pages/Home';
import Play from './pages/Play';
import Results from './pages/Results';
import Share from './pages/Share';
import UniformPlay from './pages/UniformPlay';
import UniformResults from './pages/UniformResults';
import UniformShare from './pages/UniformShare';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<Play />} />
        <Route path="/results" element={<Results />} />
        <Route path="/share/:id" element={<Share />} />
        <Route path="/uniform-play" element={<UniformPlay />} />
        <Route path="/uniform-results" element={<UniformResults />} />
        <Route path="/uniform-share/:id" element={<UniformShare />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const gameRoutes = require('./routes/game');
const uniformRoutes = require('./routes/uniforms');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// API routes
app.use('/api', gameRoutes);
app.use('/api', uniformRoutes);
app.use('/uniforms', express.static(path.join(__dirname, '../../data/48_uniforms')));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

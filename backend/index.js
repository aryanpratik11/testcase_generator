import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import testGenRoutes from './routes/testGenRoutes.js';
import githubRoutes from './routes/githubRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/generate', testGenRoutes);
app.use('/api/github', githubRoutes);

app.get('/', (req, res) => {
  res.send('🚀 Test Case Generator API is running...');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

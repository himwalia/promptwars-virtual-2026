const express = require('express');

const app = express();
app.use(express.json());

// Hybrid Quota Architecture: Check for 'x-api-key' header (BYOK pattern)
app.use((req, res, next) => {
  const customApiKey = req.headers['x-api-key'];
  req.geminiApiKey = customApiKey || process.env.GEMINI_API_KEY;
  next();
});

// Hello World baseline endpoint
app.get('/', (req, res) => {
  res.status(200).send('Hello World - Civic-Flow Functional Baseline Active');
});

// Health check endpoint for Cloud Run
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Port and Host binding strictly adhering to Cloud Run constraints
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Civic-Flow server listening on http://${HOST}:${PORT}`);
});

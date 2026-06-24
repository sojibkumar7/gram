const bot = require('./bot');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'MCJ Bot is running' });
});

// Webhook endpoint (if using webhooks instead of polling)
app.post('/webhook', (req, res) => {
  // Implement webhook logic if needed
  res.status(200).send('OK');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
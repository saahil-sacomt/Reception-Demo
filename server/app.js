// server/app.js
const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());

// Import routes
const authRoutes = require('./routes/authRoutes');
const privilegeRoutes = require('./routes/privilegeRoutes');
const billingRoutes = require('./routes/billingRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/privileges', privilegeRoutes);
app.use('/api/billing', billingRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

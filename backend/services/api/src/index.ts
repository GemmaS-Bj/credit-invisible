import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';

// Load environment variables from your .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Mount your auth routes at the base path specified in docs/API.md
app.use('/auth', authRoutes);

// Simple health check route
app.get('/', (req, res) => {
  res.json({ success: true, message: "API is running smoothly" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
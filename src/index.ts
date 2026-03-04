import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

import { requireAuth } from './middlewares/authMiddleware';

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// A protected route
app.get('/api/protected', requireAuth, (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the protected route!', user: req.user });
});

// Example route to test the connection
app.get('/api/test-db', async (req: Request, res: Response) => {

  if (!supabaseUrl || !process.env.SUPABASE_ANON_KEY) {
     // Return 500 when the backend doesn't have the keys.
     // In Express 5, we must return the response. But actually res.status().json() is fine.
     res.status(500).json({ error: 'Supabase credentials not configured in backend .env' });
     return;
  }

  try {
    // You can replace 'your_table_name' with an actual table you have in Supabase
    // const { data, error } = await supabase.from('your_table_name').select('*').limit(5);
    
    // if (error) throw error;
    
    res.json({ 
      message: 'Supabase credentials detected! Backend is ready to query tables.',
      // data 
    });
  } catch (error) {
    res.status(500).json({ error: 'Database query failed', details: error });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

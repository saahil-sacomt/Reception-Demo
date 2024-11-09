// server/controllers/authController.js
import supabase from '../services/supabaseClient.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Register a new user
export const register = async (req, res) => {
  const { username, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert([{ username, email, password: hashedPassword, role }]);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'User registered successfully', user: data });
};

// Login
export const login = async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) return res.status(400).json({ error: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, data.password);
  if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: data.id, role: data.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
};

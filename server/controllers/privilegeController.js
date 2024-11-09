// server/controllers/privilegeController.js
import supabase from '../services/supabaseClient.js';

export const createPrivilegeCard = async (req, res) => {
  const { customerId, points } = req.body;
  const { data, error } = await supabase
    .from('privilege_cards')
    .insert([{ customer_id: customerId, points }]);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Privilege card created successfully', card: data });
};

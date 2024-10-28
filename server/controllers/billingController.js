// server/controllers/billingController.js
const supabase = require('../supabaseClient');

exports.createBillingRecord = async (req, res) => {
  const { customerId, totalAmount, paymentMethod } = req.body;
  const { data, error } = await supabase
    .from('billing')
    .insert([{ customer_id: customerId, total_amount: totalAmount, payment_method: paymentMethod }]);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Billing record created successfully', billing: data });
};

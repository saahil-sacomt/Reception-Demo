import supabase from '../services/supabaseClient.js';

// Utility function to get the current financial year
const getFinancialYear = () => {
  const currentYear = new Date().getFullYear();
  const nextYear = (currentYear + 1) % 100;
  return `${currentYear % 100}-${nextYear}`;
};

// Calculate the total amount for the work order
const calculateTotalAmount = (productEntries) => {
  return productEntries.reduce((total, product) => {
    const price = parseFloat(product.price) || 0;
    const quantity = parseInt(product.quantity) || 0;
    return total + (price * quantity);
  }, 0);
};

// Determine tax rate based on the category of products
const determineTaxRate = (productEntries) => {
  const hasSunglasses = productEntries.some(product => product.category === 'sunglasses');
  return hasSunglasses ? 18 : 12; // 18% for sunglasses, 12% for other products
};

export const getInitialWorkOrderCount = async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id', { count: 'exact' });
  
      if (error) throw error;
      
      const initialCount = data.length;
      res.status(200).json({ initialCount });
    } catch (error) {
      console.error('Error fetching initial work order count:', error);
      res.status(500).json({ error: 'Error fetching initial count' });
    }
  };
  

// Save a new work order to the database
export const createWorkOrder = async (req, res) => {
  const {
    workOrderId,
    productEntries,
    description,
    advanceDetails,
    dueDate,
    mrNumber,
    patientDetails,
    employee,
    paymentMethod,
    isB2B
  } = req.body;

  try {
    // Validate required fields
    if (!workOrderId || !productEntries.length || !employee) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    // Calculate total amount and tax rate
    const totalAmount = calculateTotalAmount(productEntries);
    const taxRate = determineTaxRate(productEntries);

    // Insert the new work order into the database
    const { data, error } = await supabase.from('work_orders').insert([{
      work_order_id: workOrderId,
      product_entries: JSON.stringify(productEntries),
      description,
      advance_details: parseFloat(advanceDetails) || 0,
      due_date: dueDate,
      mr_number: mrNumber,
      patient_details: JSON.stringify(patientDetails),
      employee,
      payment_method: paymentMethod,
      total_amount: totalAmount,
      tax_rate: taxRate,
      is_b2b: isB2B || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);

    if (error) throw error;

    res.status(201).json({ message: 'Work Order saved successfully', data });
  } catch (error) {
    console.error('Error saving Work Order:', error.message);
    res.status(500).json({ error: 'Failed to save Work Order' });
  }
};

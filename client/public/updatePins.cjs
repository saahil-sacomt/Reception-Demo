// updatePins.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const updatePins = async () => {
  // Fetch all employees
  const { data: employees, error: fetchError } = await supabase
    .from('employees')
    .select('id, pin_plaintext'); // Assume you have a 'pin_plaintext' field temporarily

  if (fetchError) {
    console.error('Error fetching employees:', fetchError);
    return;
  }

  for (const employee of employees) {
    const { id, pin_plaintext } = employee;

    if (!pin_plaintext) {
      console.warn(`No plaintext PIN for employee ID ${id}. Skipping.`);
      continue;
    }

    try {
      const hashedPin = await bcrypt.hash(pin_plaintext, 10);
      const { error: updateError } = await supabase
        .from('employees')
        .update({ pin: hashedPin })
        .eq('id', id);

      if (updateError) {
        console.error(`Error updating PIN for employee ID ${id}:`, updateError);
      } else {
        console.log(`Successfully updated PIN for employee ID ${id}.`);
      }
    } catch (err) {
      console.error(`Error hashing PIN for employee ID ${id}:`, err);
    }
  }

  console.log('PIN update process completed.');
};

updatePins();

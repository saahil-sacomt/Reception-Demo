// client/src/services/authService.js
import supabase from '../supabaseClient';

export const signUp = async (name, email, password, role, address, phoneNumber, emergencyContact) => {
  // Sign up the user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (authError) return { data: null, error: authError };

  // Add additional employee details to the 'employees' table
  const { data: employeeData, error: employeeError } = await supabase
    .from('employees')
    .insert([
      {
        auth_user_id: authData.user.id,
        name,
        email,
        role,
        address,
        phone_number: phoneNumber,             // Ensure this matches your database column name
        emergency_contact: emergencyContact, // Ensure this matches your database column name
      },
    ]);

  return { data: employeeData, error: employeeError };
};

export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    localStorage.setItem('authToken', data.session.access_token); // Store the token
    return { data };
  } catch (error) {
    return { error };
  }
};


export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem('authToken'); // Clear local storage if token is stored here
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

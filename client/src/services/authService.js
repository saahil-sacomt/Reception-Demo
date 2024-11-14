// client/src/services/authService.js
import supabase from '../supabaseClient';

export const signUp = async (name, email, password, role, address, phoneNumber, emergencyContact) => {
  try {
    // Step 1: Sign up the user using Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData?.user) {
      return { data: null, error: authError || new Error('Failed to create user') };
    }

    const userId = authData.user.id;

    // Step 2: Insert additional details into the 'employees' table
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .insert([{
        auth_user_id: userId,
        name,
        email,
        role,
        address,
        phone_number: phoneNumber,
        emergency_contact: emergencyContact,
        emp_id: `emp${Math.floor(1000 + Math.random() * 9000)}`, // Generate emp_id
      }]);

    // If the employee insertion fails, delete the user from Auth
    if (employeeError) {
      await supabase.auth.admin.deleteUser(userId);
      return { data: null, error: employeeError };
    }

    return { data: employeeData, error: null };
  } catch (err) {
    console.error("Error during sign-up:", err);
    return { data: null, error: err };
  }
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

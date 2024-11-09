// client/src/supabaseClient.js
// client/src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
export async function fetchCustomerDetails(mrNumber) {
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('mr_number', mrNumber);

    if (error) {
        console.error('Error fetching customer details:', error);
        return null;
    }
    return data[0];
}

export async function fetchPrivilegeCardByPhone(phoneNumber) {
    const { data, error } = await supabase
        .from('privilegecards')
        .select('*')
        .eq('phone_number', phoneNumber);

    if (error) {
        console.error('Error fetching privilege card:', error);
        return null;
    }
    return data[0];
}

export default supabase;



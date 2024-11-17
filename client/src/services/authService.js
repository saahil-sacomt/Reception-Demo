// client/src/services/authService.js

import supabase from '../supabaseClient';
import Papa from 'papaparse'; // For CSV parsing
import xml2js from 'xml2js'; // For XML parsing

// Function to sign up a new user and add to 'employees' table
export const signUp = async (
  name,
  email,
  password,
  role,
  address,
  phoneNumber,
  emergencyContact,
  branch
) => {
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
    const { data: existingUser } = await supabase
      .from('employees')
      .select('id')
      .eq('email', email);

    if (existingUser && existingUser.length > 0) {
      return { data: null, error: new Error('Email already exists') };
    }

    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .insert([
        {
          auth_user_id: userId,
          name,
          email,
          role,
          address,
          phone_number: phoneNumber,
          emergency_contact: emergencyContact,
          emp_id: `emp${Math.floor(1000 + Math.random() * 9000)}`, // Generate emp_id
          branch,
        },
      ]);

    // If the employee insertion fails, delete the user from Auth
    if (employeeError) {
      await supabase.auth.admin.deleteUser(userId);
      return { data: null, error: employeeError };
    }

    return { data: employeeData, error: null };
  } catch (err) {
    console.error('Error during sign-up:', err);
    return { data: null, error: err };
  }
};

// Function to sign in a user
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

// Function to sign out a user
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem('authToken'); // Clear local storage if token is stored here
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

// Function to add or update stock for a specific branch
export const addOrUpdateStock = async (productId, branchCode, quantity, rate = null, mrp = null) => {
  try {
    // Check if the product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    // If rate or mrp is provided, update the product details
    if (rate !== null || mrp !== null) {
      const { error: updateProductError } = await supabase
        .from('products')
        .update({
          rate: rate !== null ? rate : product.rate,
          mrp: mrp !== null ? mrp : product.mrp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (updateProductError) throw updateProductError;
    }

    // Insert or update stock
    const { error: stockError } = await supabase
      .from('stock')
      .upsert(
        {
          product_id: productId,
          branch_code: branchCode,
          quantity: quantity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: ['product_id', 'branch_code'] }
      );

    if (stockError) throw stockError;

    return { success: true };
  } catch (error) {
    console.error('Error adding/updating stock:', error);
    return { success: false, error: error.message };
  }
};

// Function to parse CSV file
const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });
};

// Function to parse XML file
const parseXML = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      xml2js.parseString(
        reader.result,
        { explicitArray: false },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

// Function to handle bulk stock upload (CSV and XML)
export const bulkUploadStock = async (file, format, branchCode) => {
  try {
    let parsedData = [];

    // Step 1: Parse the file based on the selected format
    if (format === 'csv') {
      parsedData = await parseCSV(file);
    } else if (format === 'xml') {
      const xmlResult = await parseXML(file);
      // Adjust this based on your actual XML structure
      // Example assumes XML has <stocks><stock>...</stock></stocks>
      parsedData = xmlResult?.stocks?.stock || [];
      // If your XML structure differs, adjust the parsing accordingly
    } else {
      throw new Error('Unsupported file format.');
    }

    console.log('Parsed Data:', parsedData); // Logging parsed data for debugging

    // Step 2: Validate required fields
    const requiredFields = ['product_id', 'quantity'];
    for (let field of requiredFields) {
      if (!parsedData[0]?.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Step 3: Normalize product_id to uppercase and trim whitespace
    parsedData = parsedData.map((item) => ({
      ...item,
      product_id: item.product_id.trim().toUpperCase(),
      name: item.name ? item.name.trim() : '', // Ensure name is handled
    }));

    // Step 4: Extract unique products based on product_id
    const uniqueProductsMap = {};
    parsedData.forEach((item) => {
      const pid = item.product_id;
      if (!uniqueProductsMap[pid] && item.name) { // Ensure name is present
        uniqueProductsMap[pid] = {
          product_id: pid,
          product_name: item.name,
          hsn_code: item.hsn_code || '9001', // Default HSN code if not provided
          mrp: parseFloat(item.mrp) || 0,     // Assuming mrp is present and valid
          rate: parseFloat(item.rate) || 0,   // Assuming rate is present and valid
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    });

    const uniqueProducts = Object.values(uniqueProductsMap);
    console.log('Unique Products to Insert:', uniqueProducts);

    // Step 5: Insert unique products into the 'products' table
    if (uniqueProducts.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert(uniqueProducts)
        .select();

      if (insertError) {
        // Handle duplicate key errors gracefully
        if (insertError.code === '23505') { // Unique violation
          console.warn('Some products already exist. Attempting to fetch existing products.');
          // Fetch existing products that caused the conflict
          const existingPIDs = uniqueProducts.map((p) => p.product_id);
          const { data: existingProducts, error: fetchError } = await supabase
            .from('products')
            .select('*')
            .in('product_id', existingPIDs);

          if (fetchError) throw fetchError;

          // Merge existing products with inserted products
          const allProducts = existingProducts; // Only existingProducts are available in case of conflict
          console.log('All Products (Existing):', allProducts);
          allProducts.forEach((product) => {
            uniqueProductsMap[product.product_id.toUpperCase()] = product.id;
          });
        } else {
          throw insertError;
        }
      } else {
        console.log('Inserted Products:', inserted);
        inserted.forEach((product) => {
          uniqueProductsMap[product.product_id.toUpperCase()] = product.id;
        });
      }
    }

    // Step 6: Map product_ids to internal IDs
    const pids = uniqueProducts.map((p) => p.product_id);
    const { data: existingProductsFinal, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('product_id', pids);

    if (productsError) throw productsError;

    const existingProductMap = {};
    existingProductsFinal.forEach((product) => {
      existingProductMap[product.product_id.toUpperCase()] = product.id;
    });

    console.log('Existing Product Map:', existingProductMap);

    // Step 7: Prepare stock entries by aggregating quantities
    const stockEntriesMap = {}; // Key: `${product_id}-${branch_code}`, Value: aggregated data

    parsedData.forEach((row) => {
      const pid = row.product_id;
      const internalProductId = existingProductMap[pid];
      if (!internalProductId) {
        console.warn(`Product ID ${pid} not found. Skipping stock entry.`);
        return;
      }

      const key = `${internalProductId}-${branchCode}`;
      const qty = parseInt(row.quantity, 10) || 0;

      if (stockEntriesMap[key]) {
        stockEntriesMap[key].quantity += qty;
      } else {
        stockEntriesMap[key] = {
          product_id: internalProductId,
          branch_code: branchCode,
          quantity: qty,
          updated_at: new Date().toISOString(),
        };
      }
    });

    const stockEntries = Object.values(stockEntriesMap);
    console.log(`Prepared ${stockEntries.length} stock entries from bulk upload.`);

    // Step 8: Insert or upsert stock entries
    if (stockEntries.length > 0) {
      const { error: stockErrorBulk } = await supabase
        .from('stock')
        .upsert(stockEntries, { onConflict: ['product_id', 'branch_code'] });

      if (stockErrorBulk) throw stockErrorBulk;
    } else {
      console.warn('No stock entries to upsert.');
    }

    return { success: true };
  } catch (error) {
    console.error('Error during bulk stock upload:', error);
    return { success: false, error: error.message };
  }
};

// Function to edit stock (if needed)
export const editStock = async (productId, branchCode, newQuantity) => {
  try {
    const { data, error } = await supabase
      .from('stock')
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('product_id', productId)
      .eq('branch_code', branchCode)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error editing stock:', error);
    return { success: false, error: error.message };
  }
};

// Function to deduct stock upon purchase
export const deductStock = async (productId, branchCode, purchaseQuantity) => {
  try {
    // Start a transaction-like sequence
    // Note: Supabase doesn't support multi-operation transactions via API,
    // but you can use RPC (Stored Procedures)

    const { data, error } = await supabase.rpc('deduct_stock', {
      p_product_id: productId,
      p_branch_code: branchCode,
      p_purchase_quantity: purchaseQuantity,
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deducting stock:', error);
    return { success: false, error: error.message };
  }
};

// Function to deduct multiple stocks
export const deductMultipleStocks = async (deductions) => {
  try {
    const { data, error } = await supabase.rpc('deduct_multiple_stock', {
      p_deductions: deductions,
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deducting multiple stocks:', error);
    return { success: false, error: error.message };
  }
};

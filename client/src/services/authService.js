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

export const addOrUpdateStock = async (productIdentifier, branchCode, quantity, rate = null, mrp = null) => {
  try {
    // Normalize input and log
    const normalizedInput = String(productIdentifier).trim().toUpperCase();
    console.log('Normalized Input:', normalizedInput);

    let internalProductId = null;

    // Determine if input is an internal ID (numeric) or external product_id
    if (!isNaN(normalizedInput)) {
      // Treat as internal product ID
      internalProductId = parseInt(normalizedInput, 10);
    } else {
      // Fetch internal product ID using external product_id
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id') // Fetch only the `id` field
        .eq('product_id', normalizedInput)
        .maybeSingle();

      if (productError) {
        console.error('Error fetching product:', productError);
        throw new Error('Error fetching product from the database');
      }
      if (!product) {
        console.warn(`Product with external ID '${normalizedInput}' not found.`);
        throw new Error('Product not found');
      }

      internalProductId = product.id;
    }

    // Log the internal product ID for debugging
    console.log('Internal Product ID:', internalProductId);

    // Fetch existing stock details for this product and branch
    const { data: stock, error: stockError } = await supabase
      .from('stock')
      .select('quantity')
      .eq('product_id', internalProductId)
      .eq('branch_code', branchCode)
      .maybeSingle();

    if (stockError) {
      console.error('Error fetching stock:', stockError);
      throw new Error('Error fetching stock data');
    }

    // Calculate new quantity (default existingQuantity to 0 if no record exists)
    const existingQuantity = stock?.quantity || 0;
    const newQuantity = existingQuantity + quantity;

    console.log(
      `Updating stock for product ${internalProductId} at branch ${branchCode}. New quantity: ${newQuantity}`
    );

    // Upsert the stock entry
    const { error: upsertError } = await supabase
      .from('stock')
      .upsert(
        {
          product_id: internalProductId,
          branch_code: branchCode,
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: ['product_id', 'branch_code'] }
      );

    if (upsertError) {
      console.error('Error during upsert:', upsertError);
      throw new Error('Error adding/updating stock');
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding/updating stock:', error.message);
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

    // Step 1: Parse the file
    if (format === 'csv') {
      parsedData = await parseCSV(file);
    } else if (format === 'xml') {
      const xmlResult = await parseXML(file);
      parsedData = xmlResult?.stocks?.stock || [];
    } else {
      throw new Error('Unsupported file format.');
    }

    console.log('Parsed Data:', parsedData);

    // Step 2: Validate and normalize data
    const requiredFields = ['product_id', 'quantity'];
    for (let field of requiredFields) {
      if (!parsedData[0]?.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    parsedData = parsedData.map((item) => ({
      ...item,
      product_id: item.product_id.trim().toUpperCase(),
      quantity: parseInt(item.quantity, 10) || 0,
      rate: parseFloat(item.rate) || null,
      mrp: parseFloat(item.mrp) || null,
    }));

    // Step 3: Resolve duplicates within the uploaded data
    const consolidatedData = parsedData.reduce((acc, item) => {
      if (!item.product_id) return acc;

      if (!acc[item.product_id]) {
        acc[item.product_id] = { ...item };
      } else {
        acc[item.product_id].quantity += item.quantity;
        acc[item.product_id].rate = item.rate || acc[item.product_id].rate;
        acc[item.product_id].mrp = item.mrp || acc[item.product_id].mrp;
      }
      return acc;
    }, {});

    const uniqueProducts = Object.values(consolidatedData);

    // Step 4: Fetch existing products
    const productIds = uniqueProducts.map((p) => p.product_id);
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, product_id, rate, mrp')
      .in('product_id', productIds);

    if (fetchError) throw fetchError;

    const existingProductMap = existingProducts.reduce((acc, product) => {
      acc[product.product_id] = product;
      return acc;
    }, {});

    // Step 5: Update or insert products and stock
    const newProducts = [];
    const stockUpdates = [];

    for (const item of uniqueProducts) {
      const existingProduct = existingProductMap[item.product_id];

      if (existingProduct) {
        // Update stock for existing product
        stockUpdates.push({
          product_id: existingProduct.id,
          branch_code: branchCode,
          quantity: item.quantity,
        });

        // Update product details if they have changed
        if (item.rate !== existingProduct.rate || item.mrp !== existingProduct.mrp) {
          await supabase
            .from('products')
            .update({
              rate: item.rate,
              mrp: item.mrp,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingProduct.id);
        }
      } else {
        // Insert new product
        newProducts.push({
          product_id: item.product_id,
          product_name: item.name,
          hsn_code: item.hsn_code || '9001',
          rate: item.rate,
          mrp: item.mrp,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Step 6: Insert new products
    if (newProducts.length > 0) {
      const { data: insertedProducts, error: insertError } = await supabase
        .from('products')
        .insert(newProducts)
        .select();

      if (insertError) throw insertError;

      // Add stock entries for newly inserted products
      insertedProducts.forEach((product) => {
        const item = uniqueProducts.find((p) => p.product_id === product.product_id);
        stockUpdates.push({
          product_id: product.id,
          branch_code: branchCode,
          quantity: item.quantity,
        });
      });
    }

    // Step 7: Upsert stock entries
    for (const update of stockUpdates) {
      const { data: stock, error: stockError } = await supabase
        .from('stock')
        .select('quantity')
        .eq('product_id', update.product_id)
        .eq('branch_code', update.branch_code)
        .single();

      const newQuantity = stock ? stock.quantity + update.quantity : update.quantity;

      const { error: upsertError } = await supabase
        .from('stock')
        .upsert(
          {
            product_id: update.product_id,
            branch_code: update.branch_code,
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          },
          { onConflict: ['product_id', 'branch_code'] }
        );

      if (upsertError) throw upsertError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error during bulk stock upload:', error);
    return { success: false, error: error.message };
  }
};



export const editStock = async (
  productId, // Alphanumeric product_id (e.g., "22T32")
  branchCode,
  newQuantity,
  newRate = null,
  newMrp = null
) => {
  try {
    // Validate inputs
    if (!productId || !branchCode) {
      throw new Error('Product ID or Branch Code is missing.');
    }

    // Fetch the internal numeric product ID from the products table
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, mrp, rate')
      .eq('product_id', productId)
      .maybeSingle();

    if (productError || !product) {
      throw new Error(`Product with ID ${productId} not found.`);
    }

    const internalProductId = product.id;

    // Replace stock quantity in the `stock` table
    const { error: stockUpdateError } = await supabase
      .from('stock')
      .upsert(
        {
          product_id: internalProductId, // Use numeric ID here
          branch_code: branchCode,
          quantity: newQuantity, // Replace with new quantity
          updated_at: new Date().toISOString(),
        },
        { onConflict: ['product_id', 'branch_code'] }
      );

    if (stockUpdateError) throw stockUpdateError;

    // Update `mrp` and `rate` in the `products` table if provided
    if (newRate !== null || newMrp !== null) {
      const productUpdate = {};
      if (newRate !== null) productUpdate.rate = newRate;
      if (newMrp !== null) productUpdate.mrp = newMrp;

      const { error: productUpdateError } = await supabase
        .from('products')
        .update(productUpdate)
        .eq('id', internalProductId);

      if (productUpdateError) throw productUpdateError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error editing stock:', error.message);
    return { success: false, error: error.message };
  }
};


export async function deductStockForMultipleProducts(products, branchCode) {
  try {
    // Step 1: Filter out invalid products
    const validProducts = products.filter(
      (product) => product.product_id && product.purchase_quantity > 0
    );

    if (validProducts.length === 0) {
      console.error("No valid products to process for stock deduction");
      return { success: false, error: "No valid products to process" };
    }

    // Step 2: Fetch internal IDs for the external product_ids
    const productIds = validProducts.map((product) => product.product_id);
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id, product_id")
      .in("product_id", productIds);

    if (productError || !productData) {
      console.error("Error fetching product IDs:", productError);
      return { success: false, error: "Failed to fetch product data" };
    }

    // Create a map of external product_id to internal id
    const productMap = productData.reduce((acc, product) => {
      acc[product.product_id] = product.id;
      return acc;
    }, {});

    // Step 3: Prepare stock updates using internal IDs
    const updates = validProducts.map((product) => {
      const internalProductId = productMap[product.product_id];
      if (!internalProductId) {
        console.error(`Product ID ${product.product_id} not found`);
        return null;
      }
      return {
        product_id: internalProductId,
        branch_code: branchCode,
        quantity: -product.purchase_quantity,
      };
    }).filter(update => update !== null);

    if (updates.length === 0) {
      console.error("No valid stock updates to process");
      return { success: false, error: "No valid stock updates" };
    }

    // Step 4: Perform the batch update
    const { error: updateError } = await supabase
      .from("stock")
      .upsert(updates, { onConflict: ["product_id", "branch_code"] });

    if (updateError) {
      console.error("Error updating stock:", updateError);
      return { success: false, error: "Failed to update stock" };
    }

    return { success: true };
  } catch (err) {
    console.error("Unexpected error during stock deduction:", err);
    return { success: false, error: err.message };
  }
}



// Function to fetch stock by external product_id and branch_code
export const fetchStockByProductCode = async (internalProductId, branchCode) => {
  try {
    console.log('Fetching stock for Product ID:', internalProductId, 'Branch:', branchCode);

    if (!internalProductId) {
      console.error("Internal Product ID is missing");
      return { success: false, error: "Internal Product ID is missing" };
    }

    const { data, error } = await supabase.rpc('get_stock_by_product_code', {
      p_product_code: internalProductId,
      p_branch_code: branchCode,
    });

    if (error) {
      console.error('get_stock_by_product_code error:', error);
      return { success: false, error: error.message };
    }

    console.log('Stock Data:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching stock by product code:', error);
    return { success: false, error: error.message };
  }
};


// client/src/services/authService.js

export const deductMultipleStocks = async (deductions) => {
  try {
    console.log('Sending deductions to RPC:', deductions); // Log the deductions array

    const { data, error } = await supabase.rpc('deduct_multiple_stock', {
      p_deductions: deductions,
    });

    if (error) {
      console.error('deduct_multiple_stock error:', error);
      return { success: false, error: error.message };
    }

    console.log('deduct_multiple_stock response:', data);
    return { success: true };
  } catch (error) {
    console.error('Error deducting multiple stocks:', error);
    return { success: false, error: error.message };
  }
};



import bcrypt from 'bcryptjs';

const hashPin = async (plainTextPin) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainTextPin, salt);
};

export const verifyEmployeePin = async (phoneNumber, enteredPin) => {
  const { data, error } = await supabase
    .from("employees")
    .select("pin")
    .eq("phone_number", phoneNumber)
    .single();

  if (error || !data) {
    return { success: false, message: "Employee not found" };
  }

  const isMatch = await bcrypt.compare(enteredPin, data.pin);
  return isMatch ? { success: true } : { success: false, message: "Invalid PIN" };
};
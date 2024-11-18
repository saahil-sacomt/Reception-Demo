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
export const addOrUpdateStock = async (externalProductId, branchCode, quantity, rate = null, mrp = null) => {
  try {
    // Step 1: Fetch internal product ID
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, rate, mrp")
      .eq("product_id", externalProductId)
      .single();

    if (productError || !product) throw productError;

    const internalProductId = product.id;

    // Step 2: Insert or update stock
    const { error: stockError } = await supabase
      .from("stock")
      .upsert(
        {
          product_id: internalProductId,
          branch_code: branchCode,
          quantity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: ["product_id", "branch_code"] }
      );

    if (stockError) throw stockError;

    return { success: true };
  } catch (error) {
    console.error("Error adding/updating stock:", error);
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
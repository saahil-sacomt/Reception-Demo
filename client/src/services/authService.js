// client/src/services/authService.js

import supabase from '../supabaseClient';
import Papa from 'papaparse'; // For CSV parsing
import xml2js from 'xml2js'; // For XML parsing
import bcrypt from 'bcryptjs';

/**
 * Parses a CSV file and returns the data as an array of objects.
 * @param {File} file - The CSV file to parse.
 * @returns {Promise<Array<Object>>} - Parsed CSV data.
 */
const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

/**
 * Parses an XML file and returns the data as an array of objects.
 * Assumes the XML has a root <stocks> element with multiple <stock> children.
 * @param {File} file - The XML file to parse.
 * @returns {Promise<Array<Object>>} - Parsed XML data.
 */
const parseXML = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const xmlText = event.target.result;
      const parser = new xml2js.Parser({ explicitArray: false });
      try {
        const parsedResult = await parser.parseStringPromise(xmlText);
        // Adjust the path based on your XML structure
        resolve(parsedResult.stocks.stock);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read the XML file."));
    };
    reader.readAsText(file);
  });
};

/**
 * Bulk uploads stock data from a CSV or XML file.
 * @param {File} file - The uploaded file (CSV or XML).
 * @param {string} format - The file format ('csv' or 'xml').
 * @param {string} branchCode - The branch code to which the stock belongs.
 * @returns {Object} - Success status and any error messages.
 */
export const bulkUploadStock = async (file, format, branchCode) => {
  try {
    let parsedData = [];

    // Step 1: Parse the file
    if (format === "csv") {
      parsedData = await parseCSV(file);
    } else if (format === "xml") {
      parsedData = await parseXML(file);
    } else {
      throw new Error("Unsupported file format.");
    }

    console.log("Parsed Data:", parsedData);

    // Step 2: Validate and normalize data
    const requiredFields = ["product_id", "quantity"];
    if (!parsedData.length) {
      throw new Error("The uploaded file contains no data.");
    }

    // Check for required fields in each row
    for (let i = 0; i < parsedData.length; i++) {
      for (let field of requiredFields) {
        if (
          !parsedData[i].hasOwnProperty(field) ||
          !parsedData[i][field] ||
          parsedData[i][field].toString().trim() === ""
        ) {
          throw new Error(`Missing required field "${field}" in row ${i + 1}.`);
        }
      }
    }

    // Normalize data
    parsedData = parsedData.map((item) => ({
      product_id: item.product_id.trim().toUpperCase(),
      quantity: parseInt(item.quantity, 10) || 0,
      // 'rate' and 'mrp' are optional
      rate: item.rate ? parseFloat(item.rate) : null,
      mrp: item.mrp ? parseFloat(item.mrp) : null,
      // Map 'name' to 'product_name'
      product_name: item.name ? item.name.trim() : "Unnamed Product",
      hsn_code: item.hsn_code ? item.hsn_code.trim() : "9001",
      // Calculate total_value if needed
      total_value: item.rate && !isNaN(item.rate) && !isNaN(item.quantity)
        ? parseFloat(item.rate) * parseInt(item.quantity, 10)
        : null,
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
        acc[item.product_id].total_value =
          acc[item.product_id].rate && acc[item.product_id].quantity
            ? acc[item.product_id].rate * acc[item.product_id].quantity
            : acc[item.product_id].total_value;
      }
      return acc;
    }, {});

    const uniqueProducts = Object.values(consolidatedData);

    // Step 4: Fetch existing products
    const productIds = uniqueProducts.map((p) => p.product_id);
    const { data: existingProducts, error: fetchError } = await supabase
      .from("products")
      .select("id, product_id, rate, mrp")
      .in("product_id", productIds);

    if (fetchError) throw fetchError;

    const existingProductMap = existingProducts.reduce((acc, product) => {
      acc[product.product_id] = product;
      return acc;
    }, {});

    // Step 5: Prepare bulk upsert data for products
    const productsToUpsert = uniqueProducts.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      hsn_code: item.hsn_code,
      rate: item.rate,
      mrp: item.mrp,
      total_value: item.total_value,
      // Additional fields can be added here
      // Assuming 'product_id' is a unique constraint
    }));

    // Step 6: Bulk upsert products (insert new and update existing)
    const { data: upsertedProducts, error: upsertProductsError } = await supabase
      .from("products")
      .upsert(productsToUpsert, { onConflict: ["product_id"] })
      .select();

    if (upsertProductsError) throw upsertProductsError;

    // Step 7: Create a mapping from product_id to product's database ID
    const allProductsMap = upsertedProducts.reduce((acc, product) => {
      acc[product.product_id] = product.id;
      return acc;
    }, {});

    // Step 8: Fetch existing stock entries for these products and branch
    const internalProductIds = uniqueProducts.map(
      (item) => allProductsMap[item.product_id]
    );

    const { data: existingStocks, error: fetchStockError } = await supabase
      .from("stock")
      .select("product_id, quantity")
      .in("product_id", internalProductIds)
      .eq("branch_code", branchCode);

    if (fetchStockError) throw fetchStockError;

    // Create a map from product_id to existing quantity
    const existingStockMap = existingStocks.reduce((acc, stock) => {
      acc[stock.product_id] = stock.quantity;
      return acc;
    }, {});

    // Step 9: Prepare stock entries with updated quantities
    const stockEntries = uniqueProducts.map((item) => ({
      product_id: allProductsMap[item.product_id],
      branch_code: branchCode,
      quantity: (existingStockMap[allProductsMap[item.product_id]] || 0) + item.quantity,
      updated_at: new Date().toISOString(),
    }));

    // Step 10: Bulk upsert stock entries
    const { error: upsertStockError } = await supabase
      .from("stock")
      .upsert(stockEntries, { onConflict: ["product_id", "branch_code"] });

    if (upsertStockError) throw upsertStockError;

    return { success: true };
  } catch (error) {
    console.error("Error during bulk stock upload:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Function to sign up a new user and add to 'employees' table
 */
export const signUp = async (
  name,
  email,
  password,
  role,
  address,
  phoneNumber,
  emergencyContact,
  branch,
  pin
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
    const hashedPin = await bcrypt.hash(pin, 10);

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
          pin: hashedPin,
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

/**
 * Function to sign in a user
 */
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

/**
 * Function to sign out a user
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem('authToken'); // Clear local storage if token is stored here
  } catch (error) {
    console.error('Error signing out:', error);
  }
};



/**
 * Adds a new product to the 'products' table.
 * @param {Object} productData - The product details.
 * @returns {Object} - Success status and any error message.
 */
export const addNewProduct = async (productData) => {
  const { product_name, product_id, mrp, rate, hsn_code, purchase_from } = productData;

  try {
    // Check if product_id already exists
    const { data: existingProduct, error: fetchError } = await supabase
      .from("products")
      .select("id")
      .eq("product_id", product_id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116: No rows found, which is acceptable
      throw fetchError;
    }

    if (existingProduct) {
      return { success: false, error: "Product ID already exists." };
    }

    // Insert new product
    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          product_name,
          product_id,
          mrp,
          rate,
          hsn_code: hsn_code || "9001",
          purchase_from, // Include the new purchase_from field
        },
      ],
        
      )
      .select("id"); // Select the inserted product's ID

    if (error) {
      console.error("Error adding new product:", error.message);
      return { success: false, error: error.message };
    }

    console.log("Inserted product data:", data);

    return { success: true, data: data[0] }; // Return the inserted product
  } catch (error) {
    console.error("Error in addNewProduct:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Updates the stock quantity and optionally Rate and MRP for an existing product in a specific branch.
 * @param {number} productId - The internal ID of the product.
 * @param {string} branchCode - The branch code.
 * @param {number} quantity - The quantity to add.
 * @param {number} rate - The new rate (optional).
 * @param {number} mrp - The new MRP (optional).
 * @param {string} purchaseFrom - The source of purchase (optional).
 * @returns {Object} - Success status and any error message.
 */
export const updateExistingProduct = async (productId, branchCode, quantity, rate, mrp, purchaseFrom) => {
  try {
    // Log inputs to verify correctness
    console.log(`Updating product ID: ${productId} for branch: ${branchCode} with quantity: ${quantity}, rate: ${rate}, mrp: ${mrp}, purchaseFrom: ${purchaseFrom}`);

    // Fetch existing stock for the product and branch
    const { data: existingStock, error: stockError } = await supabase
      .from("stock")
      .select("id, quantity")
      .eq("product_id", productId)
      .eq("branch_code", branchCode)
      .single();

    if (stockError && stockError.code !== "PGRST116") {
      // PGRST116: No stock entry found, which is acceptable
      throw stockError;
    }

    if (existingStock) {
      // Update existing stock
      const { error: updateError } = await supabase
        .from("stock")
        .update({
          quantity: existingStock.quantity + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingStock.id);

      if (updateError) {
        console.error("Error updating stock:", updateError.message);
        return { success: false, error: updateError.message };
      }
    } else {
      // Insert new stock entry
      const { error: insertError } = await supabase
        .from("stock")
        .insert([
          {
            product_id: productId,
            branch_code: branchCode,
            quantity: quantity,
          },
        ]);

      if (insertError) {
        console.error("Error inserting new stock:", insertError.message);
        return { success: false, error: insertError.message };
      }
    }

    // Optionally, update Rate and MRP if provided
    if (rate !== null && mrp !== null) {
      const productUpdateData = {
        rate: rate,
        mrp: mrp,
        updated_at: new Date().toISOString(),
      };

      // Include purchase_from if provided
      if (purchaseFrom) {
        productUpdateData.purchase_from = purchaseFrom;
      }

      const { error: productUpdateError } = await supabase
        .from("products")
        .update(productUpdateData)
        .eq("id", productId);

      if (productUpdateError) {
        console.error("Error updating product rate, MRP, and purchase_from:", productUpdateError.message);
        return { success: false, error: productUpdateError.message };
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error in updateExistingProduct:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Function to add or update stock manually
 */
export const addOrUpdateStock = async (productId, branchCode, quantity, rate = null, mrp = null) => {
  try {
    // Normalize input and log
    const normalizedProductId = String(productId).trim().toUpperCase();
    console.log('Normalized Product ID:', normalizedProductId);

    // Fetch the internal numeric product ID from the products table
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', normalizedProductId)
      .maybeSingle();

    if (productError || !product) {
      console.error('Error fetching product:', productError);
      throw new Error('Error fetching product from the database');
    }

    const internalProductId = product.id;

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

/**
 * Function to edit stock details
 */
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
          product_id: internalProductId,
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

/**
 * Function to deduct stock for multiple products
 */
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

/**
 * Function to fetch stock by external product_id and branch_code
 */
export const fetchStockByProductCode = async (productId, branchCode) => {
  try {
    console.log('Fetching stock for Product ID:', productId, 'Branch:', branchCode);

    if (!productId) {
      console.error("Product ID is missing");
      return { success: false, error: "Product ID is missing" };
    }

    const { data, error } = await supabase.rpc('get_stock_by_product_code', {
      p_product_code: productId,
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

/**
 * Function to deduct multiple stocks via RPC
 */
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

/**
 * Helper function to hash PIN
 */
const hashPin = async (plainTextPin) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainTextPin, salt);
};

/**
 * Function to verify PIN
 */
const verifyPin = async () => {
  setError(""); // Reset error message
  setSuccessMessage(""); // Reset success message

  if (pin.length !== 4) {
    setError("PIN must be exactly 4 digits.");
    return;
  }

  try {
    // Fetch the employee's hashed PIN from the database
    const { data, error } = await supabase
      .from("employees")
      .select("pin")
      .eq("name", employee)
      .single(); // Ensure we fetch a single matching record

    if (error || !data || !data.pin) {
      setError("Employee not found or no PIN set.");
      onVerify(false);
      return;
    }

    // Verify the entered PIN against the stored hashed PIN
    const isValidPin = await bcrypt.compare(pin, data.pin);
    if (isValidPin) {
      setSuccessMessage("PIN Verified Successfully!");
      setError("");
      onVerify(true);
    } else {
      setError("Incorrect PIN. Please try again.");
      onVerify(false);
    }
  } catch (err) {
    console.error("Error verifying PIN:", err);
    setError("Failed to verify PIN. Please try again.");
    onVerify(false);
  }
};

export const addPurchase = async (purchaseData) => {
  try {
      const { data, error } = await supabase
          .from("purchases")
          .insert([
              {
                  product_id: purchaseData.product_id,
                  branch_code: purchaseData.branch_code,
                  quantity: purchaseData.quantity,
                  rate: purchaseData.rate,
                  mrp: purchaseData.mrp,
                  purchase_from: purchaseData.purchase_from,
                  bill_number: purchaseData.bill_number,
                  bill_date: purchaseData.bill_date,
                  employee_id: purchaseData.employee_id,
                  employee_name: purchaseData.employee_name,
              },
          ]);

      if (error) {
          console.error("Error adding purchase:", error);
          return { success: false, error: error.message };
      }

      return { success: true, data };
  } catch (err) {
      console.error("Unexpected error adding purchase:", err);
      return { success: false, error: "An unexpected error occurred." };
  }
};
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
 * Adds or updates a single stock entry.
 * @param {number} productId - Internal product ID.
 * @param {string} branchCode - Branch code.
 * @param {number} quantity - Quantity to add.
 * @param {number|null} rate - Rate (optional).
 * @param {number|null} mrp - MRP (optional).
 * @returns {Object} - { success: boolean, error: string | null }
 */
export const addOrUpdateStock = async (productId, branchCode, quantity, rate = null, mrp = null) => {
  try {
    // Fetch existing stock entry
    const { data: existingStock, error: stockError } = await supabase
      .from("stock")
      .select("quantity")
      .eq("branch_code", branchCode)
      .eq("product_id", productId)
      .single();

    if (stockError && stockError.code !== "PGRST116") { // PGRST116: No rows found
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
        .eq("branch_code", branchCode)
        .eq("product_id", productId);

      if (updateError) throw updateError;
    } else {
      // Insert new stock entry
      const { error: insertError } = await supabase.from("stock").insert([
        {
          product_id: productId,
          branch_code: branchCode,
          quantity: quantity,
          // Removed hsn_code as it doesn't exist in stock table
        },
      ]);

      if (insertError) throw insertError;
    }

    // Optionally, update rate and mrp in products table if provided
    if (rate !== null || mrp !== null) {
      const updateData = {};
      if (rate !== null) updateData.rate = rate;
      if (mrp !== null) updateData.mrp = mrp;

      const { error: productUpdateError } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", productId);

      if (productUpdateError) throw productUpdateError;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Error in addOrUpdateStock:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Assign stock from one branch to another.
 * @param {Array<Object>} assignments - Array of assignment objects.
 * Each object should contain product_id (integer), from_branch_code, to_branch_code, quantity, notes (optional).
 * @returns {Object} - { success: boolean, error: string | null }
 */
export const assignStock = async (assignments) => {
  try {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new Error("No assignments provided.");
    }

    // Step 0: Validate and fetch all involved product IDs
    const productIds = assignments.map(a => a.product_id);
    const uniqueProductIds = [...new Set(productIds)];

    // Fetch products to ensure they exist
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("id")
      .in("id", uniqueProductIds);

    if (productsError) {
      throw new Error(`Error fetching products: ${productsError.message}`);
    }

    const existingProductIds = productsData.map(p => p.id);
    const missingProductIds = uniqueProductIds.filter(id => !existingProductIds.includes(id));

    if (missingProductIds.length > 0) {
      throw new Error(`Products not found: ${missingProductIds.join(", ")}`);
    }

    // Step 1: Validate assignments
    for (let [index, assignment] of assignments.entries()) {
      const { product_id, from_branch_code, to_branch_code, quantity } = assignment;

      if (!product_id || !from_branch_code || !to_branch_code || !quantity) {
        throw new Error(`Invalid assignment data at index ${index + 1}. Ensure all fields are provided.`);
      }

      if (from_branch_code === to_branch_code) {
        throw new Error(`Source and destination branches cannot be the same for assignment at index ${index + 1}.`);
      }

      if (quantity <= 0) {
        throw new Error(`Quantity must be greater than zero for assignment at index ${index + 1}.`);
      }
    }

    // Step 2: Fetch all source stock entries in bulk
    const fromBranchCodes = [...new Set(assignments.map(a => a.from_branch_code))];
    const { data: sourceStocks, error: sourceStocksError } = await supabase
      .from("stock")
      .select("product_id, branch_code, quantity")
      .in("product_id", uniqueProductIds)
      .in("branch_code", fromBranchCodes);

    if (sourceStocksError) {
      throw new Error(`Error fetching source stocks: ${sourceStocksError.message}`);
    }

    // Create a map for quick lookup
    const sourceStockMap = {};
    sourceStocks.forEach(stock => {
      sourceStockMap[`${stock.product_id}_${stock.branch_code}`] = stock.quantity;
    });

    // Step 3: Verify sufficient stock for each assignment
    for (let [index, assignment] of assignments.entries()) {
      const { product_id, from_branch_code, quantity } = assignment;
      const availableQuantity = sourceStockMap[`${product_id}_${from_branch_code}`] || 0;

      if (availableQuantity < quantity) {
        throw new Error(`Insufficient stock for product ID ${product_id} in branch ${from_branch_code} at assignment index ${index + 1}. Available: ${availableQuantity}, Requested: ${quantity}.`);
      }
    }

    // Step 4: Prepare bulk updates for source branches (deduct stock)
    const stockEntriesFrom = assignments.map(assignment => ({
      product_id: assignment.product_id,
      branch_code: assignment.from_branch_code,
      quantity: sourceStockMap[`${assignment.product_id}_${assignment.from_branch_code}`] - assignment.quantity,
      updated_at: new Date().toISOString(),
    }));

    // Step 5: Perform bulk upsert to deduct stock from source branches
    const { error: upsertStockFromError } = await supabase
      .from("stock")
      .upsert(stockEntriesFrom, { onConflict: ["product_id", "branch_code"] });

    if (upsertStockFromError) {
      throw new Error(`Failed to deduct stock from source branches: ${upsertStockFromError.message}`);
    }

    // Step 6: Fetch existing stock entries for destination branches in bulk
    const toBranchCodes = [...new Set(assignments.map(a => a.to_branch_code))];
    const { data: destStocks, error: destStocksError } = await supabase
      .from("stock")
      .select("product_id, branch_code, quantity")
      .in("product_id", uniqueProductIds)
      .in("branch_code", toBranchCodes);

    if (destStocksError) {
      throw new Error(`Error fetching destination stocks: ${destStocksError.message}`);
    }

    // Create a map for quick lookup
    const destStockMap = {};
    destStocks.forEach(stock => {
      destStockMap[`${stock.product_id}_${stock.branch_code}`] = stock.quantity;
    });

    // Step 7: Prepare bulk updates for destination branches (add stock)
    const stockEntriesTo = assignments.map(assignment => ({
      product_id: assignment.product_id,
      branch_code: assignment.to_branch_code,
      quantity: (destStockMap[`${assignment.product_id}_${assignment.to_branch_code}`] || 0) + assignment.quantity,
      updated_at: new Date().toISOString(),
    }));

    // Step 8: Perform bulk upsert to add stock to destination branches
    const { error: upsertStockToError } = await supabase
      .from("stock")
      .upsert(stockEntriesTo, { onConflict: ["product_id", "branch_code"] });

    if (upsertStockToError) {
      throw new Error(`Failed to add stock to destination branches: ${upsertStockToError.message}`);
    }

    // Step 9: Prepare bulk inserts for stock_assignments
    // Fetch product details (rate, mrp) for all products involved
    const { data: productsDetails, error: productsDetailsError } = await supabase
      .from("products")
      .select("id, rate, mrp")
      .in("id", uniqueProductIds);

    if (productsDetailsError) {
      throw new Error(`Error fetching product details: ${productsDetailsError.message}`);
    }

    // Create a map for product details
    const productDetailsMap = {};
    productsDetails.forEach(product => {
      productDetailsMap[product.id] = {
        rate: product.rate,
        mrp: product.mrp,
      };
    });

    // Prepare stock_assignments entries
    const assignmentsToRecord = assignments.map(assignment => ({
      product_id: assignment.product_id,
      from_branch_code: assignment.from_branch_code,
      to_branch_code: assignment.to_branch_code,
      quantity: assignment.quantity,
      notes: assignment.notes || '',
      rate: productDetailsMap[assignment.product_id]?.rate || null,
      mrp: productDetailsMap[assignment.product_id]?.mrp || null,
      // assigned_at is automatically set by default
    }));

    // Step 10: Perform bulk insert into stock_assignments
    const { error: recordAssignmentsError } = await supabase
      .from("stock_assignments")
      .insert(assignmentsToRecord);

    if (recordAssignmentsError) {
      throw new Error(`Failed to record stock assignments: ${recordAssignmentsError.message}`);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in assignStock:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk uploads stock data from a CSV or XML file.
 * @param {File} file - The uploaded file (CSV or XML).
 * @param {string} format - The file format ('csv' or 'xml').
 * @param {string} fromBranchCode - The branch code from which the stock is being assigned.
 * @param {string|null} toBranchCode - The branch code to which the stock is being assigned (optional for single branch uploads).
 * @returns {Object} - Success status and any error messages.
 */
export const bulkUploadStock = async (file, format, fromBranchCode, toBranchCode = null) => {
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
      hsn_code: item.hsn_code ? item.hsn_code.trim() : "9003",
      // Calculate total_value if needed
      total_value:
        item.rate && !isNaN(item.rate) && !isNaN(item.quantity)
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
            ? parseFloat(acc[item.product_id].rate) * parseInt(acc[item.product_id].quantity, 10)
            : acc[item.product_id].total_value;
      }
      return acc;
    }, {});

    const uniqueProducts = Object.values(consolidatedData);

    // Step 4: Fetch existing products
    const productIds = uniqueProducts.map((p) => p.product_id);
    const { data: existingProducts, error: fetchError } = await supabase
      .from("products")
      .select("id, product_id, rate, mrp, hsn_code")
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

    if (toBranchCode) {
      // === Bulk Assign Logic ===

      // Step 8: Validate all assignments exist and prepare assignment objects
      const assignments = uniqueProducts.map((item) => ({
        product_id: allProductsMap[item.product_id],
        from_branch_code: fromBranchCode,
        to_branch_code: toBranchCode,
        quantity: item.quantity,
        notes: "", // Optional, can be customized
      }));

      // Step 9: Use assignStock function to process all assignments
      const assignResponse = await assignStock(assignments);

      if (!assignResponse.success) {
        throw new Error(assignResponse.error || "Bulk assign failed.");
      }
    } else {
      // === Bulk Upload Logic ===

      // Step 8: Fetch existing stock entries for these products in fromBranchCode
      const internalProductIds = uniqueProducts.map(
        (item) => allProductsMap[item.product_id]
      );

      const { data: existingStocks, error: fetchStockError } = await supabase
        .from("stock")
        .select("product_id, quantity")
        .in("product_id", internalProductIds)
        .eq("branch_code", fromBranchCode);

      if (fetchStockError) throw fetchStockError;

      // Create a map from product_id to existing quantity
      const existingStockMap = existingStocks.reduce((acc, stock) => {
        acc[stock.product_id] = stock.quantity;
        return acc;
      }, {});

      // Step 9: Prepare stock entries - add to fromBranchCode
      const stockEntries = uniqueProducts.map((item) => ({
        product_id: allProductsMap[item.product_id],
        branch_code: fromBranchCode,
        quantity:
          (existingStockMap[allProductsMap[item.product_id]] || 0) + item.quantity,
        updated_at: new Date().toISOString(),
      }));

      // Step 10: Bulk upsert stock entries
      const { error: upsertStockError } = await supabase
        .from("stock")
        .upsert(stockEntries, { onConflict: ["product_id", "branch_code"] });

      if (upsertStockError) throw upsertStockError;
    }

    return { success: true, error: null, insertedProducts: upsertedProducts };
  } catch (error) {
    console.error("Error during bulk stock upload:", error.message);
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

    // Step 2: Check if employee already exists
    const { data: existingUser, error: existingUserError } = await supabase
      .from('employees')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      // If employee already exists, delete the created Auth user
      await supabase.auth.admin.deleteUser(userId);
      return { data: null, error: new Error('Email already exists') };
    }

    // Step 3: Insert additional details into the 'employees' table
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
      ])
      .select(); // Select the inserted employee data

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
    // Assuming you're using session-based authentication
    return { data };
  } catch (error) {
    console.error("Error signing in:", error.message);
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
    // If you're managing tokens manually, clear them here
    // localStorage.removeItem('authToken'); // Example
  } catch (error) {
    console.error('Error signing out:', error.message);
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

    if (fetchError && fetchError.code !== "PGRST116") { // PGRST116: No rows found
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
      ])
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
 * @returns {Object} - { success: boolean, error: string | null }
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
 * Edit a stock entry.
 * @param {number} productId - The integer ID of the product.
 * @param {string} branchCode - The branch code.
 * @param {number} quantity - The updated quantity.
 * @param {number|null} rate - The updated rate (optional).
 * @param {number|null} mrp - The updated MRP (optional).
 * @returns {Object} - { success: boolean, error: string | null }
 */
export const editStock = async (productId, branchCode, quantity, rate, mrp) => {
  try {
    // Update the stock quantity
    const { data, error } = await supabase
      .from("stock")
      .update({
        quantity: quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId)
      .eq("branch_code", branchCode);
    
    if (error) throw error;

    // Optionally, update rate and MRP in the products table if provided
    if (rate !== null || mrp !== null) {
      const updateFields = {};
      if (rate !== null) updateFields.rate = rate;
      if (mrp !== null) updateFields.mrp = mrp;

      const { data: productData, error: productError } = await supabase
        .from("products")
        .update(updateFields)
        .eq("id", productId);

      if (productError) throw productError;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Error in editStock:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Function to fetch stock by external product_id and branch_code using RPC
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
      console.error('get_stock_by_product_code error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('Stock Data:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching stock by product code:', error.message);
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
      console.error('deduct_multiple_stock error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('deduct_multiple_stock response:', data);
    return { success: true };
  } catch (error) {
    console.error('Error deducting multiple stocks:', error.message);
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
export const verifyPin = async (employee, pin, onVerify) => {
  try {
    // Reset error and success messages
    // Assuming setError and setSuccessMessage are managed in the component

    if (pin.length !== 4) {
      // setError("PIN must be exactly 4 digits.");
      onVerify(false, "PIN must be exactly 4 digits.");
      return;
    }

    // Fetch the employee's hashed PIN from the database
    const { data, error } = await supabase
      .from("employees")
      .select("pin")
      .eq("name", employee)
      .single(); // Ensure we fetch a single matching record

    if (error || !data || !data.pin) {
      // setError("Employee not found or no PIN set.");
      onVerify(false, "Employee not found or no PIN set.");
      return;
    }

    // Verify the entered PIN against the stored hashed PIN
    const isValidPin = await bcrypt.compare(pin, data.pin);
    if (isValidPin) {
      // setSuccessMessage("PIN Verified Successfully!");
      onVerify(true, "PIN Verified Successfully!");
    } else {
      // setError("Incorrect PIN. Please try again.");
      onVerify(false, "Incorrect PIN. Please try again.");
    }
  } catch (err) {
    console.error("Error verifying PIN:", err.message);
    // setError("Failed to verify PIN. Please try again.");
    onVerify(false, "Failed to verify PIN. Please try again.");
  }
};

/**
 * Function to add a purchase
 */
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
      ])
      .select(); // Select the inserted purchase data

    if (error) {
      console.error("Error adding purchase:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Unexpected error adding purchase:", err.message);
    return { success: false, error: "An unexpected error occurred." };
  }
};

/**
 * Function to deduct stock for multiple products
 * @param {Array<Object>} products - Array of products to deduct.
 * Each object should have product_id and purchase_quantity.
 * @param {string} branchCode - The branch code from which to deduct stock.
 * @returns {Object} - { success: boolean, error: string | null }
 */
export const deductStockForMultipleProducts = async (products, branchCode) => {
  try {
    // Filter out invalid products
    const validProducts = products.filter(
      (product) => product.product_id && product.purchase_quantity > 0
    );

    if (validProducts.length === 0) {
      console.error("No valid products to process for stock deduction");
      return { success: false, error: "No valid products to process" };
    }

    // Fetch internal IDs for the external product_ids
    const productIds = validProducts.map((product) => product.product_id);
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id, product_id")
      .in("product_id", productIds);

    if (productError || !productData) {
      console.error("Error fetching product IDs:", productError?.message || "No product data");
      return { success: false, error: "Failed to fetch product data" };
    }

    // Create a map of external product_id to internal id
    const productMap = productData.reduce((acc, product) => {
      acc[product.product_id] = product.id;
      return acc;
    }, {});

    // Prepare stock deductions
    const deductions = validProducts.map((product) => {
      const internalProductId = productMap[product.product_id];
      if (!internalProductId) {
        console.error(`Product ID ${product.product_id} not found`);
        return null;
      }
      return {
        product_id: internalProductId,
        branch_code: branchCode,
        quantity: -product.purchase_quantity, // Negative for deduction
      };
    }).filter(deduction => deduction !== null);

    if (deductions.length === 0) {
      console.error("No valid stock deductions to process");
      return { success: false, error: "No valid stock deductions" };
    }

    // Perform the deductions
    const { error: updateError } = await supabase
      .from("stock")
      .upsert(deductions, { onConflict: ["product_id", "branch_code"] });

    if (updateError) {
      console.error("Error updating stock:", updateError.message);
      return { success: false, error: "Failed to update stock" };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error during stock deduction:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Function to bulk upload stock for a single branch
 * @param {File} file - The uploaded file (CSV or XML).
 * @param {string} format - The file format ('csv' or 'xml').
 * @param {string} branchCode - The branch code to which the stock is being uploaded.
 * @returns {Object} - Success status and any error messages.
 */
export const bulkUploadStockForBranch = async (file, format, branchCode) => {
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

    if (!parsedData.length) {
      throw new Error("The uploaded file contains no data.");
    }

    // Step 2: Normalize and validate data
    parsedData = parsedData.map((item) => ({
      product_id: item.product_id.trim().toUpperCase(),
      quantity: parseInt(item.quantity, 10) || 0,
    }));

    // Step 3: Fetch existing stock for the branch
    const productIds = parsedData.map((item) => item.product_id);
    const { data: existingStock, error: stockError } = await supabase
      .from("stock")
      .select("product_id, quantity")
      .in("product_id", productIds)
      .eq("branch_code", branchCode);

    if (stockError) throw stockError;

    // Create a map from product_id to existing quantity
    const stockMap = existingStock.reduce((acc, stock) => {
      acc[stock.product_id] = stock.quantity;
      return acc;
    }, {});

    // Step 4: Prepare upsert data
    const stockEntries = parsedData.map((item) => ({
      product_id: item.product_id,
      branch_code: branchCode,
      quantity: (stockMap[item.product_id] || 0) + item.quantity,
      updated_at: new Date().toISOString(),
    }));

    // Step 5: Upsert stock entries
    const { error: upsertError } = await supabase
      .from("stock")
      .upsert(stockEntries, { onConflict: ["product_id", "branch_code"] });

    if (upsertError) throw upsertError;

    return { success: true, error: null };
  } catch (error) {
    console.error("Error in bulkUploadStockForBranch:", error.message);
    return { success: false, error: error.message };
  }
};

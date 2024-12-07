// src/pages/Notes.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { debounce } from 'lodash';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ClipLoader } from 'react-spinners';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useGlobalState } from '../context/GlobalStateContext'; // Import the custom hook

const Notes = () => {
  // Access global state and dispatch
  const { state, dispatch } = useGlobalState();

  // Destructure notesForm from global state
  const {
    order_id,
    order_type,
    product_search,
    selected_product,
    branch_code,
    quantity,
    client_name,
    client_address,
    date,
    reason,
    note_type, // Ensure 'note_type' is part of notesForm in GlobalStateContext
    // Add any additional fields if necessary
  } = state.notesForm;

  const [productSuggestions, setProductSuggestions] = React.useState([]);
  const [showProductSuggestions, setShowProductSuggestions] = React.useState(false);

  const searchProductRef = useRef(null);

  // Fetch products and branches on component mount
  useEffect(() => {
    fetchProducts();
    fetchBranches();
  }, []);

  // Fetch all products
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, product_name, product_id, rate, mrp, hsn_code');

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Error fetching products.');
    } else {
      // You can store products in global state if needed
    }
  };

  // Fetch all branches
  const fetchBranches = async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('*');

    if (error) {
      console.error('Error fetching branches:', error);
      toast.error('Error fetching branches.');
    } else {
      // Store branches in global state
      dispatch({ type: 'SET_BRANCHES', payload: data });
    }
  };

  // Debounced function to fetch product suggestions
  const fetchProductSuggestions = useCallback(
    debounce(async (query) => {
      if (!query) {
        setProductSuggestions([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, product_name, product_id, rate, mrp, hsn_code')
          .or(`product_name.ilike.%${query}%,product_id.ilike.%${query}%`)
          .limit(20);

        if (error) {
          console.error('Error fetching product suggestions:', error);
          setProductSuggestions([]);
        } else {
          setProductSuggestions(data || []);
        }
      } catch (err) {
        console.error('Error fetching product suggestions:', err);
        setProductSuggestions([]);
      }
    }, 300),
    []
  );

  // Handle product search input change
  const handleProductSearchChange = (e) => {
    const query = e.target.value;
    dispatch({ type: 'SET_NOTES_FORM', payload: { product_search: query, selected_product: null } });
    fetchProductSuggestions(query);
    setShowProductSuggestions(true);
  };

  // Handle product selection from suggestions
  const handleProductSelect = (product) => {
    dispatch({
      type: 'SET_NOTES_FORM',
      payload: {
        selected_product: product,
        product_search: `${product.product_name} (${product.product_id})`,
      },
    });
    setProductSuggestions([]);
    setShowProductSuggestions(false);
  };

  // Handle input changes for other form fields
  const handleChange = (e) => {
    dispatch({ type: 'SET_NOTES_FORM', payload: { [e.target.name]: e.target.value } });
  };

  // Reset form to initial state
  const resetForm = () => {
    dispatch({ type: 'RESET_NOTES_FORM' });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (
      !order_id || // Ensure Order ID is entered
      !branch_code ||
      !quantity ||
      !client_name ||
      !date ||
      !selected_product ||
      !note_type
    ) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be a positive number.');
      return;
    }

    dispatch({ type: 'SET_IS_UPLOADING', payload: true });

    try {
      // Insert into 'notes' table
      const insertData = {
        note_type: note_type, // 'debit' or 'credit'
        product_id: selected_product.id,
        branch_code: branch_code,
        quantity: qty,
        client_name: client_name,
        client_address: client_address || null,
        date: new Date(date).toISOString(),
        reason: reason || null,
      };

      if (order_id) {
        insertData.order_id = order_id;
      }

      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .insert([insertData]);

      if (noteError) {
        throw noteError;
      }

      // Update 'stock' table based on note type
      if (note_type === 'debit') {
        // Previously 'Debit' text, now we display as 'Credit' in UI
        // Increase stock
        const { data: stockData, error: stockError } = await supabase
          .from('stock')
          .select('id, quantity')
          .eq('product_id', selected_product.id)
          .eq('branch_code', branch_code)
          .single();

        if (stockError && stockError.code !== 'PGRST116') { // PGRST116: No rows found
          throw stockError;
        }

        if (stockData) {
          // Update existing stock
          const { error: updateError } = await supabase
            .from('stock')
            .update({
              quantity: stockData.quantity + qty,
              updated_at: new Date().toISOString(),
            })
            .eq('id', stockData.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          // Insert new stock record
          const { error: insertError } = await supabase
            .from('stock')
            .insert([
              {
                product_id: selected_product.id,
                branch_code: branch_code,
                quantity: qty,
              },
            ]);

          if (insertError) {
            throw insertError;
          }
        }

        // Show swapped text: originally "Debit Note created", now show "Credit Note created"
        toast.success('Credit Note created and stock updated successfully!');
      } else if (note_type === 'credit') {
        // Previously 'Credit' text, now displayed as 'Debit' in UI
        // Decrease stock
        const { data: stockData, error: stockError } = await supabase
          .from('stock')
          .select('id, quantity')
          .eq('product_id', selected_product.id)
          .eq('branch_code', branch_code)
          .single();

        if (stockError) {
          if (stockError.code === 'PGRST116') { // No rows found
            throw new Error('Stock record not found for the selected product and branch.');
          } else {
            throw stockError;
          }
        }

        if (stockData.quantity < qty) {
          throw new Error('Insufficient stock to create a Debit Note.');
        }

        // Update stock
        const { error: updateError } = await supabase
          .from('stock')
          .update({
            quantity: stockData.quantity - qty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stockData.id);

        if (updateError) {
          throw updateError;
        }

        // Show swapped text: originally "Credit Note created", now show "Debit Note created"
        toast.success('Debit Note created and stock updated successfully!');
      }

      resetForm();
    } catch (error) {
      console.error('Error creating note:', error);
      const errorMessage = error.message || 'An error occurred while creating the note.';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      dispatch({ type: 'SET_IS_UPLOADING', payload: false });
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div
        className={`transition-all duration-300 justify-center my-12 p-8 rounded-xl mx-auto bg-green-50`}
      >
        <h1 className="text-3xl font-semibold mb-6 text-center">Manage Credit and Debit Notes</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order ID Field */}
          <div>
            <label htmlFor="orderSearch" className="block mb-2 font-medium">
              Order ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="orderSearch"
              name="order_id"
              value={order_id}
              onChange={handleChange}
              placeholder="Enter Order ID"
              className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>

          <div className="flex flex-col md:flex-row md:space-x-6">
            {/* Left Column */}
            <div className="flex-1 space-y-4">
              {/* Note Type Selection */}
              <div>
                <label className="block mb-2 font-medium">Note Type <span className="text-red-500">*</span></label>
                <div className="flex space-x-4">
                  {/* Swapped texts: the button that sets note_type='debit' now displays "Credit" */}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SET_NOTES_FORM', payload: { note_type: 'debit' } })}
                    className={`px-4 py-2 rounded-md border ${
                      note_type === 'debit' ? 'bg-green-500 text-white shadow-xl' : 'bg-white text-gray-700'
                    } focus:outline-none focus:ring-2 focus:ring-green-400`}
                  >
                    Credit
                  </button>
                  {/* The button that sets note_type='credit' now displays "Debit" */}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SET_NOTES_FORM', payload: { note_type: 'credit' } })}
                    className={`px-4 py-2 rounded-md border ${
                      note_type === 'credit' ? 'bg-green-500 text-white shadow-xl' : 'bg-white text-gray-700'
                    } focus:outline-none focus:ring-2 focus:ring-green-400`}
                  >
                    Debit
                  </button>
                </div>
              </div>

              {/* Product Search with Suggestions */}
              <div className="relative">
                <label htmlFor="productSearch" className="block mb-2 font-medium">
                  Product <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="productSearch"
                  name="product_search"
                  value={product_search}
                  onChange={handleProductSearchChange}
                  onFocus={() => setShowProductSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)} // Delay to allow click
                  placeholder="Search by product name or ID"
                  className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                  required
                  ref={searchProductRef}
                />

                {/* Product Suggestions Dropdown */}
                {showProductSuggestions && productSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {productSuggestions.map((product) => (
                      <li
                        key={product.id}
                        onClick={() => handleProductSelect(product)}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        {product.product_name} ({product.product_id})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Branch Selection */}
              <div>
                <label htmlFor="branch" className="block mb-2 font-medium">
                  Branch <span className="text-red-500">*</span>
                </label>
                <select
                  id="branch"
                  name="branch_code"
                  value={branch_code}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                  required
                >
                  <option value="" disabled>
                    {state.branches && state.branches.length > 0 ? "Select Branch" : "Loading branches..."}
                  </option>
                  {state.branches &&
                    state.branches.map((branch) => (
                      <option key={branch.branch_code} value={branch.branch_code}>
                        {branch.branch_name} {branch.type === 'godown' ? '(Godown)' : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex-1 space-y-4">
              {/* Quantity */}
              <div>
                <label htmlFor="quantity" className="block mb-2 font-medium">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  value={quantity}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                  min="1"
                  required
                />
              </div>

              {/* Client Name */}
              <div>
                <label htmlFor="client_name" className="block mb-2 font-medium">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="client_name"
                  name="client_name"
                  value={client_name}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>

              {/* Client Address */}
              <div>
                <label htmlFor="client_address" className="block mb-2 font-medium">
                  Client Address
                </label>
                <input
                  type="text"
                  id="client_address"
                  name="client_address"
                  value={client_address}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="Optional"
                />
              </div>

              {/* Date Picker */}
              <div>
                <label htmlFor="date" className="block mb-2 font-medium">
                  Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  selected={new Date(date)}
                  onChange={(date) => dispatch({ type: 'SET_NOTES_FORM', payload: { date } })}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block mb-2 font-medium">
              Reason
            </label>
            <textarea
              id="reason"
              name="reason"
              value={reason}
              onChange={handleChange}
              className="w-full p-2 border rounded-md focus:ring-green-500 focus:border-green-500"
              rows="3"
              placeholder="Optional"
            ></textarea>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              className={`w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center justify-center ${
                state.isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={state.isUploading}
            >
              {state.isUploading ? (
                <>
                  <ClipLoader size={20} color="#ffffff" />
                  <span className="ml-2">Submitting...</span>
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Toast Notifications */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default Notes;

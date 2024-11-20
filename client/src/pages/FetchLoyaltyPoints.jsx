// src/components/FetchLoyaltyPoints.jsx
import { useState } from "react";
import supabase from "../supabaseClient";

const FetchLoyaltyPoints = ({ isCollapsed }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pcNumber, setPcNumber] = useState("");
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();

    // Reset previous state
    setUserData(null);
    setError("");

    // Validate input: At least one field should be filled
    if (!phoneNumber && !pcNumber) {
      setError("Please enter either Phone Number or PC Number to search.");
      return;
    }

    setLoading(true);

    try {
      let query = supabase.from("privilegecards").select("*");

      if (phoneNumber) {
        query = query.or(`phone_number.eq.${phoneNumber}`);
      }

      if (pcNumber) {
        query = query.or(`pc_number.eq.${pcNumber}`);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows found
          setError("No user found with the provided details.");
        } else {
          // Other errors
          setError("An error occurred while fetching data.");
          console.error("Supabase Error:", error);
        }
      } else {
        setUserData(data);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
      console.error("Unexpected Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`transition-all duration-300 ${
        isCollapsed ? "mx-20" : "mx-20 px-20"
      } justify-center mt-0 p-20 rounded-xl mx-auto max-w-2xl`}
    >
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
        {/* <h2 className="text-2xl font-semibold text-gray-700 text-center mb-6">
          Fetch Privilege Card details
        </h2> */}

        <form onSubmit={handleSearch} className="space-y-4">
          {/* Phone Number Input */}
          <div>
            <label
              htmlFor="phoneNumber"
              className="block text-gray-700 font-medium mb-1"
            >
              Phone Number
            </label>
            <input
              type="text"
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number"
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:border-green-500"
            />
          </div>

          {/* OR Separator */}
          <div className="flex items-center justify-center">
            <hr className="w-1/4 border-gray-300" />
            <span className="mx-2 text-gray-500">OR</span>
            <hr className="w-1/4 border-gray-300" />
          </div>

          {/* PC Number Input */}
          <div>
            <label
              htmlFor="pcNumber"
              className="block text-gray-700 font-medium mb-1"
            >
              PC Number
            </label>
            <input
              type="text"
              id="pcNumber"
              value={pcNumber}
              onChange={(e) => setPcNumber(e.target.value)}
              placeholder="Enter your PC number"
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          {/* Search Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {/* User Data Display */}
        {userData && (
          <div className="mt-6 bg-green-50 p-4 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-700 mb-4 text-center">
              Privilege Card Details
            </h3>
            <div className="space-y-2">
              <p>
                <span className="font-semibold">Customer Name:</span>{" "}
                {userData.customer_name
                  ? userData.customer_name.toUpperCase()
                  : "N/A"}
              </p>
              <p>
                <span className="font-semibold">Phone Number:</span>{" "}
                {userData.phone_number
                  ? userData.phone_number.toUpperCase()
                  : "N/A"}
              </p>
              {userData.pc_number && (
                <p>
                  <span className="font-semibold">PC Number:</span>{" "}
                  {userData.pc_number.toUpperCase()}
                </p>
              )}
              <p>
                <span className="font-semibold">Loyalty Points:</span>{" "}
                {userData.loyalty_points}
              </p>
              <p>
                <span className="font-semibold">Card Tier:</span>{" "}
                {userData.card_tier
                  ? userData.card_tier.toUpperCase()
                  : "N/A"}
              </p>
              <p>
                <span className="font-semibold">Created At:</span>{" "}
                {userData.created_at
                  ? new Date(userData.created_at)
                      .toLocaleString()
                      .toUpperCase()
                  : "N/A"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FetchLoyaltyPoints;

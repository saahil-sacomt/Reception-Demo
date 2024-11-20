import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import { useModificationContext } from "../context/ModificationContext";

const ModifyOrder = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { setOnModificationSuccess } = useModificationContext();
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState(null);

  const handleModificationSuccess = (modifiedOrderId) => {
    console.log("Modification success callback triggered for order:", modifiedOrderId);
  };

  // Fetch modification request details
  const fetchRequestDetails = async () => {
    setLoading(true);

    const { data: requestData, error: requestError } = await supabase
      .from("modification_requests")
      .select("*")
      .eq("order_id", orderId);

    if (requestError || !requestData || requestData.length === 0) {
      console.error("Error fetching modification request:", requestError);
      setLoading(false);
      return;
    }

    // Find an approved request
    const approvedRequest = requestData.find((req) => req.status === "approved");
    setRequest(approvedRequest);

    if (approvedRequest) {
      // Set the callback in the context
      setOnModificationSuccess(() => handleModificationSuccess);

      // Navigate to the SalesOrderGeneration page
      navigate(`/sales-order/${orderId}`, { state: { isFromApproval: true } });
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestDetails();
  }, [orderId]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Modify Order</h1>
      {loading ? (
        <p>Loading...</p>
      ) : request ? (
        <p>Redirecting to modify sales order...</p>
      ) : (
        <p>No approved modification request found for this order.</p>
      )}
    </div>
  );
};

export default ModifyOrder;

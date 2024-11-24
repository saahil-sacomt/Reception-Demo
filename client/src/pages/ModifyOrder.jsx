// client/src/pages/ModifyOrder.jsx
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
  const [modified, setModified] = useState(false); // To track modification

  // Fetch modification request details
  const fetchRequestDetails = async () => {
    setLoading(true);

    const { data: requestData, error: requestError } = await supabase
      .from("modification_requests")
      .select("*")
      .eq("order_id", orderId)
      .eq("status", "approved"); // Fetch only approved requests

    if (requestError || !requestData || requestData.length === 0) {
      console.error("Error fetching modification request:", requestError);
      setLoading(false);
      alert("No approved modification request found for this order.");
      navigate('/employee/action-required');
      return;
    }

    const approvedRequest = requestData[0];
    setRequest(approvedRequest);

    // Set the callback in the context
    setOnModificationSuccess(() => handleModificationSuccess);

    // Redirect based on order_type
    if (approvedRequest.order_type === 'work_order') {
      navigate(`/work-order/${orderId}`, { state: { isFromApproval: true } });
    } else if (approvedRequest.order_type === 'sales_order') {
      navigate(`/sales-order/${orderId}`, { state: { isFromApproval: true } });
    } else {
      alert("Unknown order type.");
      navigate('/employee/action-required');
    }

    setLoading(false);
  };

  const handleModificationSuccess = async () => {
    console.log("Modification success callback triggered for order:", orderId);

    // Update the status to 'completed'
    const { error } = await supabase
      .from('modification_requests')
      .update({ status: 'completed' })
      .eq('order_id', orderId)
      .eq('order_type', request.order_type); // Ensure correct order_type

    if (error) {
      console.error("Error updating request status to completed:", error);
      alert("Failed to update request status to completed.");
    } else {
      // Optionally, navigate back or show a success message
      alert("Order modified successfully and request status updated to completed.");
      navigate('/employee/action-required');
    }
  };

  useEffect(() => {
    fetchRequestDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {loading ? (
        <h1 className="text-2xl font-semibold mb-6 text-center text-gray-800">Loading...</h1>
      ) : (
        <h1 className="text-2xl font-semibold mb-6 text-center text-gray-800">Redirecting to Modify Order...</h1>
      )}
    </div>
  );
};

export default ModifyOrder;

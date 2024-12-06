// client/src/pages/ModifyOrder.jsx

import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient"; // Adjust the import path accordingly

const ModifyOrder = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrderType = async () => {
      // Try fetching from 'work_orders' table
      let { data: workOrder, error: workOrderError } = await supabase
        .from("work_orders")
        .select("work_order_id")
        .eq("work_order_id", orderId)
        .single();

      if (workOrder) {
        navigate(`/modify-order/work_order/${orderId}`);
        return;
      }

      // Try fetching from 'sales_orders' table
      let { data: salesOrder, error: salesOrderError } = await supabase
        .from("sales_orders")
        .select("sales_order_id")
        .eq("sales_order_id", orderId)
        .single();

      if (salesOrder) {
        navigate(`/modify-order/sales_order/${orderId}`);
        return;
      }

      // If order not found in both tables
      navigate("/not-found"); // Or display an error message
    };

    fetchOrderType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return null; // Render nothing since we're redirecting
};

export default ModifyOrder;

// client/src/components/ModifyOrderWrapper.jsx

import React from "react";
import { useParams } from "react-router-dom";
import WorkOrderGeneration from "../pages/WorkOrderGeneration";
import SalesOrderGeneration from "../pages/SalesOrderGeneration";

const ModifyOrderWrapper = ({ isCollapsed }) => {
  const { orderType } = useParams();

  if (orderType === "work_order") {
    return <WorkOrderGeneration isCollapsed={isCollapsed} />;
  } else if (orderType === "sales_order") {
    return <SalesOrderGeneration isCollapsed={isCollapsed} />;
  } else {
    return <div>Invalid order type</div>;
  }
};

export default ModifyOrderWrapper;

// GlobalState.jsx
import React, { createContext, useContext, useReducer, useEffect } from "react";
import merge from "lodash.merge"; // Import lodash.merge

const savedState = localStorage.getItem("globalState")
  ? JSON.parse(localStorage.getItem("globalState"))
  : {};

// Create a context
const GlobalStateContext = createContext();

// Initial State
const defaultInitialState = {
  pendingRequestsCount: 0,
  pendingWorkOrdersCount: 0,
  salesTodayCount: 0,
  pendingWorkOrders: [],
  salesOrdersToday: [],
  salesOrderForm: {
    step: 0,
    salesOrderId: "",
    isEditing: false,
    isPrinted: false,
    isOtpSent: false,
    productEntries: [{ id: "", name: "", price: "", quantity: "" }],
    advanceDetails: "",
    dueDate: "",
    mrNumber: "",
    isPinVerified: false,
    patientDetails: null,
    employee: "",
    paymentMethod: "",
    discount: "",
    gstNumber: "",
    isB2B: false,
    hasMrNumber: "yes",
    customerName: "",
    customerPhone: "",
    address: "",
    age: "",
    gender: "",
    modificationRequestId: null,
    isSaving: false,
    allowPrint: false,
    privilegeCard: null,
    privilegeCardDetails: null,
    loyaltyPoints: 0,
    pointsToAdd: 0,
    redeemOption: null,
    redeemPointsAmount: "",
    isLoading: false,
    validationErrors: {},
    fetchMethod: "work_order_id",
    searchQuery: "",
    workOrders: [],
  },
  workOrderForm: {
    step: 1,
    workOrderId: "",
    isPrinted: false,
    productEntries: [{ id: "", name: "", price: "", quantity: "" }],
    advanceDetails: "",
    dueDate: "",
    mrNumber: "",
    isPinVerified: false,
    patientDetails: null,
    employee: "",
    paymentMethod: "",
    discount: "",
    gstNumber: "",
    isB2B: false,
    hasMrNumber: true,
    customerName: "",
    customerPhone: "",
    address: "",
    age: "",
    gender: "",
    modificationRequestId: null,
    isSaving: false,
    allowPrint: false,
  },
};

// Deep merge defaultInitialState with savedState
const initialState = merge({}, defaultInitialState, savedState);

// Reducer Function
const globalStateReducer = (state, action) => {
  console.log("Action Type:", action.type); // Log action type
  console.log("Payload:", action.payload); 
  switch (action.type) {
    case "SET_PENDING_REQUESTS_COUNT":
      return { ...state, pendingRequestsCount: action.payload };
    case "SET_PENDING_WORK_ORDERS_COUNT":
      return { ...state, pendingWorkOrdersCount: action.payload };
    case "SET_SALES_TODAY_COUNT":
      return { ...state, salesTodayCount: action.payload };
    case "SET_PENDING_WORK_ORDERS":
      return { ...state, pendingWorkOrders: action.payload };
    case "SET_SALES_ORDERS_TODAY":
      return { ...state, salesOrdersToday: action.payload };

    // SalesOrderForm actions
    case "SET_SALES_ORDER_FORM":
      console.log("Previous State (salesOrderForm):", state.salesOrderForm);
      console.log("New Payload:", action.payload);
      return {
        ...state,
        salesOrderForm: { ...state.salesOrderForm, ...action.payload },
      };
    case "RESET_SALES_ORDER_FORM":
      console.log("RESET_SALES_ORDER_FORM triggered");
      return { ...state, salesOrderForm: defaultInitialState.salesOrderForm };

    // WorkOrderForm actions
    case "SET_WORK_ORDER_FORM":
      return {
        ...state,
        workOrderForm: { ...state.workOrderForm, ...action.payload },
      };
    case "RESET_WORK_ORDER_FORM":
      console.log("RESET_WORK_ORDER_FORM triggered");
      return { ...state, workOrderForm: defaultInitialState.workOrderForm };
    default:
      return state;
  }
};

// Create a provider component
export const GlobalStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(globalStateReducer, initialState);

  // Persist state in localStorage
  useEffect(() => {
    localStorage.setItem("globalState", JSON.stringify(state));
  }, [state]);

  const resetState = () => {
    localStorage.removeItem("globalState");
    dispatch({ type: "RESET_SALES_ORDER_FORM" });
    dispatch({ type: "RESET_WORK_ORDER_FORM" });
    // Optionally reset other parts of the state if necessary
  };

  useEffect(() => {
    console.log("Current State:", state);
  }, [state]);

  // Removed unnecessary useEffect hooks that might interfere with state integrity
  /*
  useEffect(() => {
    if (state.salesOrderForm.someCondition === false) {
      dispatch({
        type: "SET_SALES_ORDER_FORM",
        payload: { someCondition: true },
      });
    }
  }, [state.salesOrderForm.someCondition]);
  */

  
  useEffect(() => {
    const handlePageRefresh = () => {
      resetState(); // Reset state on refresh
    };
  
    window.addEventListener("beforeunload", handlePageRefresh);
  
    return () => {
      window.removeEventListener("beforeunload", handlePageRefresh);
    };
  }, []);
  

  return (
    <GlobalStateContext.Provider value={{ state, dispatch, resetState }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

// Create a custom hook to use the GlobalStateContext
export const useGlobalState = () => useContext(GlobalStateContext);

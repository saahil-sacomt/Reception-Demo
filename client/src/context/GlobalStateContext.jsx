// client/src/context/GlobalStateProvider.jsx
import React, { createContext, useContext, useReducer, useEffect } from "react";

// Create a context
const GlobalStateContext = createContext();

// Initial State
const initialState = {
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
    isOtpSent:false,
    productEntries: [
      { id: "", name: "", price: "", quantity: "" },
    ],
    advanceDetails: "",
    dueDate: "",
    mrNumber: "",
    isPinVerified: false,
    patientDetails: null,
    employee: "",
    paymentMethod: "",
    discount: "", // discount amount
    gstNumber: "",
    isB2B: false,
    hasMrNumber: "yes", // 'yes' or 'no'
    customerName: "",
    customerPhone: "",
    address: "",
    age: "",
    gender: "",
    modificationRequestId: null,
    isSaving: false,
    allowPrint: false,
    privilegeCard:null,
    privilegeCardDetails: null,
    loyaltyPoints: 0,
    pointsToAdd: 0,
    redeemOption:null,
    redeemPointsAmount:"",
    isLoading: false,
    validationErrors: {},
    fetchMethod: "work_order_id", // 'work_order_id', 'mr_number', 'phone_number'
    searchQuery: "",
    workOrders: [],
  },
  workOrderForm: {
    step: 1,
    workOrderId: "",
    isPrinted: false,
    productEntries: [
      { id: "", name: "", price: "", quantity: "" },
    ],
    advanceDetails: "",
    dueDate: "",
    mrNumber: "",
    isPinVerified: false,
    patientDetails: null,
    employee: "",
    paymentMethod: "",
    discount: "", // discount amount
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

// Reducer Function
const globalStateReducer = (state, action) => {
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
      return { ...state, salesOrderForm: { ...state.salesOrderForm, ...action.payload } };
    case "RESET_SALES_ORDER_FORM":
      return { ...state, salesOrderForm: initialState.salesOrderForm };

    // WorkOrderForm actions
    case "SET_WORK_ORDER_FORM":
      return { ...state, workOrderForm: { ...state.workOrderForm, ...action.payload } };
    case "RESET_WORK_ORDER_FORM":
      return { ...state, workOrderForm: initialState.workOrderForm };
    default:
      return state;
  }
};

// Create a provider component
export const GlobalStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(globalStateReducer, initialState);

  // Persist state in localStorage
  useEffect(() => {
    const savedState = JSON.parse(localStorage.getItem("globalState"));
    if (savedState) {
      dispatch({ type: "SET_PENDING_REQUESTS_COUNT", payload: savedState.pendingRequestsCount });
      dispatch({ type: "SET_PENDING_WORK_ORDERS_COUNT", payload: savedState.pendingWorkOrdersCount });
      dispatch({ type: "SET_SALES_TODAY_COUNT", payload: savedState.salesTodayCount });
      dispatch({ type: "SET_PENDING_WORK_ORDERS", payload: savedState.pendingWorkOrders });
      dispatch({ type: "SET_SALES_ORDERS_TODAY", payload: savedState.salesOrdersToday });
      dispatch({ type: "SET_SALES_ORDER_FORM", payload: savedState.salesOrderForm });
      dispatch({ type: "SET_WORK_ORDER_FORM", payload: savedState.workOrderForm });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("globalState", JSON.stringify(state));
  }, [state]);

  return (
    <GlobalStateContext.Provider value={{ state, dispatch }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

// Create a custom hook to use the GlobalStateContext
export const useGlobalState = () => useContext(GlobalStateContext);

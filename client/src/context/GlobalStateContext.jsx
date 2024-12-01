// client/src/GlobalState.jsx

import React, { createContext, useContext, useReducer, useEffect } from "react";
import merge from "lodash.merge";

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
    customerId: "",
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
    workOrderDiscount: 0,
    submitted:false,
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
    customerAge: "",
    customerGender: "",
    modificationRequestId: null,
    isSaving: false,
    allowPrint: false,
    submitted:false,
  },
  // Add Modal States
  modals: {
    showWorkOrdersModal: false,
    showSalesModal: false,
    showPurchaseModal: false,
    showAssignStockModal: false,
    showEditStockModal: false,
  },
  // Add Selected Order States
  selectedWorkOrder: null,
  selectedSalesOrder: null,
  // Add Purchase Modal Content
  purchaseModal: {
    action: null,
    content: null,
  },
};

// Deep merge defaultInitialState with savedState
const initialState = merge({}, defaultInitialState, savedState);

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
      return {
        ...state,
        salesOrderForm: { ...state.salesOrderForm, ...action.payload },
      };
    case "RESET_SALES_ORDER_FORM":
      return { ...state, salesOrderForm: defaultInitialState.salesOrderForm };

    // WorkOrderForm actions
    case "SET_WORK_ORDER_FORM":
      return {
        ...state,
        workOrderForm: { ...state.workOrderForm, ...action.payload },
      };
    case "RESET_WORK_ORDER_FORM":
      return { ...state, workOrderForm: defaultInitialState.workOrderForm };

    // Modal Actions
    case "SET_MODAL_STATE":
      return {
        ...state,
        modals: {
          ...state.modals,
          ...action.payload,
        },
      };
    case "RESET_MODAL_STATES":
      return {
        ...state,
        modals: {
          showWorkOrdersModal: false,
          showSalesModal: false,
          showPurchaseModal: false,
          showAssignStockModal: false,
          showEditStockModal: false,
        },
        selectedWorkOrder: null,
        selectedSalesOrder: null,
        purchaseModal: {
          action: null,
          content: null,
        },
      };

    // Purchase Modal Actions
    case "SET_PURCHASE_MODAL":
      return {
        ...state,
        purchaseModal: {
          action: action.payload.action,
          content: action.payload.content,
        },
        modals: {
          ...state.modals,
          showPurchaseModal: action.payload.showModal,
        },
      };
    case "RESET_PURCHASE_MODAL":
      return {
        ...state,
        purchaseModal: {
          action: null,
          content: null,
        },
        modals: {
          ...state.modals,
          showPurchaseModal: false,
        },
      };

    // Selected Work Order Actions
    case "SET_SELECTED_WORK_ORDER":
      return {
        ...state,
        selectedWorkOrder: action.payload,
      };
    case "RESET_SELECTED_WORK_ORDER":
      return {
        ...state,
        selectedWorkOrder: null,
      };

    // Selected Sales Order Actions
    case "SET_SELECTED_SALES_ORDER":
      return {
        ...state,
        selectedSalesOrder: action.payload,
      };
    case "RESET_SELECTED_SALES_ORDER":
      return {
        ...state,
        selectedSalesOrder: null,
      };

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
    dispatch({ type: "RESET_MODAL_STATES" });
    dispatch({ type: "RESET_SELECTED_WORK_ORDER" });
    dispatch({ type: "RESET_SELECTED_SALES_ORDER" });
  };

  useEffect(() => {
    const handlePageRefresh = () => {
      resetState();
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

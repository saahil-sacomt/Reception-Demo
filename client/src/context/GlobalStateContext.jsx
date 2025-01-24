// client/src/GlobalState.jsx

import React, { createContext, useContext, useReducer, useEffect } from "react";
import merge from "lodash.merge";

// Initialize savedState as needed or keep it empty
const savedState = {}; // Remove localStorage retrieval if not used

// Create a context
const GlobalStateContext = createContext();

// Initial State
const defaultInitialState = {
  workOrders: [],
  selectedWorkOrder: null,
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
    isInsurance: false,
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
    submitted: false,
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
    submitted: false,
    insuranceName: '',
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
  selectedSalesOrder: null,
  // Add Purchase Modal Content
  purchaseModal: {
    action: null,
    content: null,
  },
  stockAssignmentForm: {
    selectedBranch: null,
    fromBranch: "",
    toBranch: "",
    selectedProduct: null,
    quantity: 0,
    rate: 0,
    mrp: 0,
    productSuggestions: [],
    // branches removed from here
  },
  // Add isUploading flag for state reset handling
  isUploading: false,

  // **New: Notes Form State**
  notesForm: {
    order_id: "",
    order_type: "", // 'sales' or 'work'
    product_search: "",
    selected_product: null,
    branch_code: "",
    quantity: "",
    client_name: "",
    client_address: "",
    date: new Date(),
    reason: "",
    note_type: "debit", // Default value added
  },

  // **New: Branches**
  branches: [], // Initialize branches as an empty array
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
        salesOrderForm: {
          ...state.salesOrderForm,
          ...action.payload,
        },
      };

    case "RESET_SALES_ORDER_FORM":
      return {
        ...state,
        salesOrderForm: { ...defaultInitialState.salesOrderForm },
      };

    // WorkOrderForm actions
    case "SET_WORK_ORDER_FORM":
      return {
        ...state,
        workOrderForm: { ...state.workOrderForm, ...action.payload },
      };
    case "RESET_WORK_ORDER_FORM":
      return { ...state, workOrderForm: defaultInitialState.workOrderForm };

    // Add new action type
    case "RESET_PRODUCT_FIELDS":
      return {
        ...state,
        workOrderForm: {
          ...state.workOrderForm,
          productEntries: state.workOrderForm.productEntries.map((entry, i) =>
            i === action.payload.index ? {
              ...entry,
              id: "",
              name: "",
              price: "",
              hsn_code: "",
              quantity: ""
            } : entry
          )
        }
      };

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

    case "SET_NOTES_FORM":
      return {
        ...state,
        notesForm: { ...state.notesForm, ...action.payload },
      };
    case "RESET_NOTES_FORM":
      return {
        ...state,
        notesForm: { ...defaultInitialState.notesForm },
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

    case "SET_STOCK_ASSIGNMENT_FORM":
      return {
        ...state,
        stockAssignmentForm: { ...state.stockAssignmentForm, ...action.payload },
      };
    case "RESET_STOCK_ASSIGNMENT_FORM":
      return {
        ...state,
        stockAssignmentForm: defaultInitialState.stockAssignmentForm,
      };

    // Uploading State Actions
    case "SET_IS_UPLOADING":
      return { ...state, isUploading: action.payload };

    // **New: Set Branches**
    case "SET_BRANCHES":
      return {
        ...state,
        branches: action.payload,
      };
    case "RESET_STATE":
      return { ...defaultInitialState };

    default:
      return state;
  }
};

// Provider Component
export const GlobalStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(globalStateReducer, initialState);

  return (
    <GlobalStateContext.Provider value={{ state, dispatch }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

// Create a custom hook to use the GlobalStateContext
export const useGlobalState = () => useContext(GlobalStateContext);
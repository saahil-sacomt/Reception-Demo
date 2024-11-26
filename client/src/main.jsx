// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import './index.css'
import App from './App.jsx'
import { ModificationProvider } from "./context/ModificationContext";
import { GlobalStateProvider } from "./context/GlobalStateContext";

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
  <GlobalStateProvider>
    <ModificationProvider>
    <App />
  </ModificationProvider>
  </GlobalStateProvider>
  </BrowserRouter>
)

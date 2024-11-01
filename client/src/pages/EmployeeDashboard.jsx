// src/pages/EmployeeDashboard.jsx
import React, { useState } from 'react';
import { fetchCustomerDetails } from './../../../server/services/supabaseService.js';

const EmployeeDashboard = () => {
    const [barcode, setBarcode] = useState('');
    const [customerData, setCustomerData] = useState(null);

    const handleBarcodeScan = async (e) => {
        e.preventDefault();
        const data = await fetchCustomerDetails(barcode);
        setCustomerData(data);
    };

    return (
        <div>
            <h1>Employee Dashboard</h1>
            <form onSubmit={handleBarcodeScan}>
                <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan Barcode"
                />
                <button type="submit">Fetch Customer Data</button>
            </form>
            {customerData && (
                <div>
                    <h2>Customer Information</h2>
                    <p>Name: {customerData.name}</p>
                    <p>Age: {customerData.age}</p>
                    <p>Condition: {customerData.condition}</p>
                </div>
            )}
        </div>
    );
};

export default EmployeeDashboard;

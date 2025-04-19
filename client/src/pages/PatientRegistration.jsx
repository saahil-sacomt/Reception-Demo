import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const PatientRegistration = () => {
    const navigate = useNavigate();
    const [validationErrors, setValidationErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    const [patientDetails, setPatientDetails] = useState({
        name: '',
        phone_number: '',
        address: '',
        age: '',
        gender: '',
        mr_number: ''
    });

    // Refs for input fields
    const nameRef = useRef(null);
    const phoneRef = useRef(null);
    const addressRef = useRef(null);
    const genderRef = useRef(null);
    const ageRef = useRef(null);
    const mrNumberRef = useRef(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setPatientDetails(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const validateForm = () => {
        const errors = {};
        if (!patientDetails.name.trim()) errors.name = "Name is required";
        if (!patientDetails.phone_number.trim()) errors.phone_number = "Phone number is required";
        if (!patientDetails.address.trim()) errors.address = "Address is required";
        if (!patientDetails.age || parseInt(patientDetails.age) <= 0) errors.age = "Valid age is required";
        if (!patientDetails.gender) errors.gender = "Gender is required";
        if (!patientDetails.mr_number.trim()) errors.mr_number = "MR number is required";

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };



const savePatientDetails = async () => {
    if (!validateForm() || isSaving) return;

    setIsSaving(true);
    try {
        // First check if patient with this MR number already exists
        const { data: existingPatient, error: fetchError } = await supabase
            .from('patients')
            .select()
            .eq('mr_number', patientDetails.mr_number)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 is the "not found" error code, any other error should be handled
            throw fetchError;
        }

        let result;
        if (existingPatient) {
            // Update existing patient record
            result = await supabase
                .from('patients')
                .update({
                    name: patientDetails.name,
                    phone_number: patientDetails.phone_number,
                    address: patientDetails.address,
                    age: parseInt(patientDetails.age),
                    gender: patientDetails.gender
                })
                .eq('mr_number', patientDetails.mr_number)
                .select();
                
            alert('Patient details updated successfully!');
        } else {
            // Insert new patient record
            result = await supabase
                .from('patients')
                .insert([{
                    name: patientDetails.name,
                    phone_number: patientDetails.phone_number,
                    address: patientDetails.address,
                    age: parseInt(patientDetails.age),
                    gender: patientDetails.gender,
                    mr_number: patientDetails.mr_number
                }])
                .select();
                
            alert('Patient registered successfully!');
        }

        if (result.error) throw result.error;
        navigate('/dashboard');

    } catch (error) {
        console.error('Error saving patient details:', error);
        setValidationErrors({
            submit: 'Failed to save patient details. Please try again.'
        });
    } finally {
        setIsSaving(false);
    }
};



    return (
        <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-semibold text-gray-700 mb-6">Patient Registration</h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-gray-700 font-medium mb-1">Name</label>
                    <input
                        type="text"
                        name="name"
                        ref={nameRef}
                        value={patientDetails.name}
                        onChange={handleInputChange}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        placeholder="Enter patient name"
                    />
                    {validationErrors.name && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>
                    )}
                </div>

                <div>
                    <label className="block text-gray-700 font-medium mb-1">Phone Number</label>
                    <input
                        type="text"
                        name="phone_number"
                        ref={phoneRef}
                        value={patientDetails.phone_number}
                        onChange={handleInputChange}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        placeholder="Enter phone number"
                    />
                    {validationErrors.phone_number && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.phone_number}</p>
                    )}
                </div>

                <div>
                    <label className="block text-gray-700 font-medium mb-1">Address</label>
                    <input
                        type="text"
                        name="address"
                        ref={addressRef}
                        value={patientDetails.address}
                        onChange={handleInputChange}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        placeholder="Enter address"
                    />
                    {validationErrors.address && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.address}</p>
                    )}
                </div>

                <div>
                    <label className="block text-gray-700 font-medium mb-1">Gender</label>
                    <select
                        name="gender"
                        ref={genderRef}
                        value={patientDetails.gender}
                        onChange={handleInputChange}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                    >
                        <option value="">Select Gender</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="Other">Other</option>
                    </select>
                    {validationErrors.gender && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.gender}</p>
                    )}
                </div>

                <div>
                    <label className="block text-gray-700 font-medium mb-1">Age</label>
                    <input
                        type="number"
                        name="age"
                        ref={ageRef}
                        value={patientDetails.age}
                        onChange={handleInputChange}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        placeholder="Enter age"
                        min="0"
                    />
                    {validationErrors.age && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.age}</p>
                    )}
                </div>

                <div>
                    <label className="block text-gray-700 font-medium mb-1">MR Number</label>
                    <input
                        type="text"
                        name="mr_number"
                        ref={mrNumberRef}
                        value={patientDetails.mr_number}
                        onChange={handleInputChange}
                        className="border border-gray-300 w-full px-4 py-3 rounded-lg"
                        placeholder="Enter MR number"
                    />
                    {validationErrors.mr_number && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.mr_number}</p>
                    )}
                </div>

                {validationErrors.submit && (
                    <p className="text-red-500 text-sm">{validationErrors.submit}</p>
                )}

                <div className="flex justify-end space-x-4 mt-6">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={savePatientDetails}
                        disabled={isSaving}
                        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Patient'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PatientRegistration;
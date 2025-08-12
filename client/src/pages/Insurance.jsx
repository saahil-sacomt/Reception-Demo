// export default Insurance;
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import EmployeeVerification from '../components/EmployeeVerification';

const Insurance = ({ isCollapsed }) => {
  // Step Management
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: MR Number & Insurance
  const [mrNumber, setMrNumber] = useState('');
  const [insuranceDetails, setInsuranceDetails] = useState(null);
  const [newInsuranceName, setNewInsuranceName] = useState('');
  const mrNumberRef = useRef(null);
  const fetchButtonRef = useRef(null);

  // Step 2: Amount Details
  const [totalAmount, setTotalAmount] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');

  const [isManualTotalEnabled, setIsManualTotalEnabled] = useState(false);


  // Step 3: Employee Selection
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employeeList, setEmployeeList] = useState([]);

  // Form Validation
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Employee Verification
  const [showEmployeeVerification, setShowEmployeeVerification] = useState(false);

  // Navigation
  const navigate = useNavigate();
  const { branch, role } = useAuth();

  const component = 'insurance';


  const initialFormState = {
    mrNumber: '',
    insuranceName: '',
    totalAmount: '',
    approvedAmount: '',
    employeeId: '',
    branch: branch,
    status: 'pending',
    createdAt: new Date().toISOString(),
    // Set a default empty payment method to avoid validation errors
    paymentMethod: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const resetForm = useCallback(() => {
    setMrNumber('');
    setInsuranceDetails(null);
    setNewInsuranceName('');
    setTotalAmount('');
    setApprovedAmount('');
    setSelectedEmployee('');
    setFormData(initialFormState);
    setErrors({});
    setCurrentStep(1);
    setIsManualTotalEnabled(false);
  }, [initialFormState]);

  // Fetch Employees on Component Mount
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('branch', branch);

      if (error) {
        console.error('Error fetching employees:', error);
        setErrors(prev => ({
          ...prev,
          fetch: 'Error fetching employees. Please try again later.',
        }));
        return;
      }

      setEmployeeList(data);
    };

    fetchEmployees();
  }, [branch]);

  // Handle MR Number Search
  // const handleMRNumberSearch = useCallback(async () => {
  //   if (!mrNumber.trim()) {
  //     setErrors(prev => ({ ...prev, mrNumber: 'MR Number is required' }));
  //     return;
  //   }

  //   setIsLoading(true);
  //   try {
  //     const { data, error } = await supabase
  //       .from('work_orders')
  //       .select('insurance_name, total_amount')
  //       .eq('mr_number', mrNumber.trim())
  //       .not('insurance_name', 'is', null)
  //       .neq('insurance_name', '')
  //       .order('created_at', { ascending: false })
  //       .limit(1);

  //     if (error) throw error;

  //     // If there’s data, set insurance name & total amount from the DB
  //     if (data && data.length > 0) {
  //       setInsuranceDetails({ insurance_name: data[0].insurance_name });
  //       setNewInsuranceName(data[0].insurance_name || '');
  //       setTotalAmount(data[0].total_amount || '');
  //       updateFormData('insuranceName', data[0].insurance_name || '');
  //       updateFormData('totalAmount', data[0].total_amount || '');
  //     } else {
  //       setInsuranceDetails({ insurance_name: null });
  //       setNewInsuranceName('');
  //       setTotalAmount('');
  //       updateFormData('insuranceName', '');
  //       updateFormData('totalAmount', '');
  //     }

  //     updateFormData('mrNumber', mrNumber.trim());
  //   } catch (err) {
  //     console.error('Error:', err);
  //     setErrors(prev => ({ ...prev, fetch: 'Error fetching insurance details' }));
  //   } finally {
  //     setIsLoading(false);
  //   }
  // }, [mrNumber, updateFormData]);


  const handleMRNumberSearch = useCallback(async () => {
    if (!mrNumber.trim()) {
      setErrors(prev => ({ ...prev, mrNumber: 'MR Number is required' }));
      return;
    }

    setIsLoading(true);
    try {
      // First fetch: Get insurance name
      const { data: insuranceData, error: insuranceError } = await supabase
        .from('work_orders')
        .select('insurance_name')
        .eq('mr_number', mrNumber.trim())
        .not('insurance_name', 'is', null)
        .neq('insurance_name', '')
        .order('created_at', { ascending: false })
        .limit(1);

      if (insuranceError) throw insuranceError;

      // Second fetch: Get sum of total_amounts where is_insurance is true
      const { data: amountData, error: amountError } = await supabase
        .from('work_orders')
        .select('total_amount')
        .eq('mr_number', mrNumber.trim())
        .eq('is_insurance', true);

      if (amountError) throw amountError;

      // Calculate total amount from all insurance work orders
      const calculatedTotalAmount = amountData
        ? amountData.reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0)
        : 0;

      // Set insurance details if found
      if (insuranceData && insuranceData.length > 0) {
        setInsuranceDetails({ insurance_name: insuranceData[0].insurance_name });
        setNewInsuranceName(insuranceData[0].insurance_name || '');
        updateFormData('insuranceName', insuranceData[0].insurance_name || '');
      } else {
        setInsuranceDetails({ insurance_name: null });
        setNewInsuranceName('');
        updateFormData('insuranceName', '');
      }

      // Set total amount from calculation
      setTotalAmount(calculatedTotalAmount.toString());
      updateFormData('totalAmount', calculatedTotalAmount.toString());
      setIsManualTotalEnabled(false);

      // Update MR number in form data
      updateFormData('mrNumber', mrNumber.trim());

    } catch (err) {
      console.error('Error:', err);
      setErrors(prev => ({ ...prev, fetch: 'Error fetching insurance details' }));
    } finally {
      setIsLoading(false);
    }
  }, [mrNumber, updateFormData]);
  // Handle Enter Key
  const handleEnterKey = (e, ref) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ref.current?.click();
    }
  };

  // Validation Functions
  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 1:
        if (!mrNumber.trim()) newErrors.mrNumber = 'MR Number is required';
        if (!newInsuranceName.trim()) {
          newErrors.insuranceName = 'Insurance name is required';
        }
        break;
      case 2:
        if (!String(totalAmount).trim()) {
          newErrors.totalAmount = 'Total amount is required';
        }
        if (!approvedAmount.trim()) newErrors.approvedAmount = 'Approved amount is required';
        if (
          totalAmount &&
          approvedAmount &&
          parseFloat(approvedAmount) > parseFloat(totalAmount)
        ) {
          newErrors.approvedAmount =
            'Approved amount cannot exceed Total amount';
        }
        break;
      case 3:
        if (!selectedEmployee.trim())
          newErrors.employee = 'Employee selection is required';
        break;
      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation Functions
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Handle Submission
  const handleSubmit = () => {
    if (!validateStep(currentStep)) return;

    // Show Employee Verification
    setShowEmployeeVerification(true);
  };

  // Handle PIN Verification Result
  const handlePinVerify = (isVerified) => {
    if (isVerified) {
      submitForm();
      setShowEmployeeVerification(false);
    } else {
      // Handle failed verification
      alert('PIN verification failed. Please try again.');
    }
  };

  // Form Submission
  const submitForm = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const insuranceData = {
        mr_number: mrNumber.trim(),
        insurance_name: newInsuranceName.trim(),
        total_amount: parseFloat(totalAmount),
        approved_amount: parseFloat(approvedAmount),
        employee_id: selectedEmployee,
        branch: branch,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('insurance_claims')
        .insert(insuranceData);

      if (error) throw error;

      alert('Insurance claim submitted successfully');
      resetForm();
      navigate('/home');
    } catch (err) {
      console.error('Error submitting insurance claim:', err);
      setErrors(prev => ({ ...prev, submit: 'Error submitting insurance claim' }));
    } finally {
      setIsSubmitting(false);
    }
  }, [approvedAmount, branch, mrNumber, newInsuranceName, navigate, resetForm, selectedEmployee, supabase, totalAmount]);

  return (
    <div className={`transition-all duration-300 ${isCollapsed ? "mx-20" : "mx-20 px-20"} justify-center mt-16 p-4 mx-auto`}>
      <h1 className="text-2xl font-semibold text-gray-700 text-center mb-8">
        Insurance Claim Form
      </h1>

      {/* Progress Tracker - Same as WorkOrderGeneration */}
      <div className="flex items-center mb-8 w-2/3 mx-auto">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-2 rounded-xl mx-1 ${currentStep > i + 1 ? "bg-[#0000ff]" : "bg-gray-300"
              } transition-all duration-300`}
          />
        ))}
      </div>

      <form className="space-y-8 bg-white p-6 rounded-lg max-w-3xl mx-auto flex flex-col gap-4 items-center" onSubmit={(e) => e.preventDefault()}>
        {/* Step 1: MR Number & Insurance Details */}
        {currentStep === 1 && (
          <div className="w-fit bg-gray-50 p-6 rounded-md shadow-inner space-y-4 flex flex-col gap-4 items-center">
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                MR Number
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={mrNumber}
                  onChange={(e) => setMrNumber(e.target.value)}
                  onKeyDown={(e) => handleEnterKey(e, fetchButtonRef)}
                  ref={mrNumberRef}
                  className="flex-1 border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter MR Number"
                />
                <button
                  ref={fetchButtonRef}
                  onClick={handleMRNumberSearch}
                  disabled={isLoading}
                  className={`${isLoading ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'
                    } text-white px-6 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  {isLoading ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
              {errors.mrNumber && (
                <p className="text-red-500 text-sm mt-2">{errors.mrNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Insurance Name
              </label>
              <input
                type="text"
                value={newInsuranceName}
                onChange={(e) => {
                  setNewInsuranceName(e.target.value);
                  updateFormData('insuranceName', e.target.value);
                }}
                className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Insurance Name"
              />
              {errors.insuranceName && (
                <p className="text-red-500 text-sm mt-2">{errors.insuranceName}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Amount Details */}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Amount
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => {
                    setTotalAmount(e.target.value);
                    updateFormData('totalAmount', e.target.value);
                  }}
                  readOnly={!isManualTotalEnabled}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Enter Total Amount"
                />
                {!isManualTotalEnabled && (
                  <button
                    type="button"
                    onClick={() => setIsManualTotalEnabled(true)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded-md hover:bg-yellow-600"
                  >
                    Edit Manually
                  </button>
                )}
              </div>
              {errors.totalAmount && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.totalAmount}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approved Amount
              </label>
              <input
                type="number"
                value={approvedAmount}
                onChange={(e) => {
                  setApprovedAmount(e.target.value);
                  updateFormData('approvedAmount', e.target.value);
                }}
                className="w-full border rounded-md px-3 py-2"
                placeholder="Enter Approved Amount"
              />
              {errors.approvedAmount && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.approvedAmount}
                </p>
              )}
            </div>

            {/* <div className="flex justify-between mt-6">
              <button
                onClick={handlePrevious}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              >
                Next
              </button>
            </div> */}
          </div>
        )}


        {/* Step 3: Employee Selection */}
        {currentStep === 3 && (
          <div className="w-fit bg-gray-50 p-6 rounded-md shadow-inner space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-1">
                Select Employee
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => {
                  setSelectedEmployee(e.target.value);
                  updateFormData('employeeId', e.target.value);
                }}
                className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an employee</option>
                {employeeList.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              {errors.employee && (
                <p className="text-red-500 text-sm mt-2">{errors.employee}</p>
              )}
            </div>

            {/* Employee Verification Modal */}
            {showEmployeeVerification && (
              <EmployeeVerification
                employee={selectedEmployee}
                onVerify={handlePinVerify}
                component={component}
              />
            )}
          </div>
        )}

        {/* Navigation Buttons - Consistent with WorkOrderGeneration */}
        <div className="flex justify-center mt-6">
          {currentStep > 1 && (
            <button
              onClick={handlePrevious}
              className="bg-blue-500 hover:bg-blue-600 text-white mx-2 px-6 py-2 rounded-lg transition-colors"
            >
              Previous
            </button>
          )}
          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="bg-blue-500 hover:bg-blue-600 text-white mx-2 px-6 py-2 rounded-lg transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`${isSubmitting ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'
                } text-white mx-2 px-6 py-2 rounded-lg transition-colors`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default Insurance;
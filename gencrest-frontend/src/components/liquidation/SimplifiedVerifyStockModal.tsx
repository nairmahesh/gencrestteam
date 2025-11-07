import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Search, Plus, Building2, Camera, CheckCircle, Eye, ExternalLink } from 'lucide-react';
import { SignatureCapture } from '../SignatureCapture';
import { MediaUpload } from '../MediaUpload';
import { MOCK_RETAILERS } from '../../data/mockData';
import { useAppSelector } from '../../store/hooks';
import { AddRetailerModal, type NewRetailerData } from './AddRetailerModal';
import { Notification } from '../ui/Notification';
import { saveStockVerification } from '../../services/verificationService';
import { useGeolocation } from '../../hooks/useGeolocation';
import { supabase } from '../../lib/supabase';

interface SKU {
  id: string;
  sku_code: string;
  sku_name: string;
  product_name: string;
  current_stock: number;
  unit: string;
  value?: number;
  case_size?: number;
  bag_size?: number;
  packaging_type?: string;
}

interface Retailer {
  retailer_id: string;
  retailer_name: string;
  retailer_location: string;
  inventory: SKU[];
}

interface SimplifiedVerifyStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailer: Retailer;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4;

const convertToMainUnit = (value: number, unit: string): { value: number; unit: string } => {
  const lowerUnit = unit.toLowerCase();
  if (lowerUnit === 'ml') {
    return { value: value / 1000, unit: 'Ltr' };
  } else if (lowerUnit === 'mg' || lowerUnit === 'gm' || lowerUnit === 'g') {
    return { value: value / 1000, unit: 'Kg' };
  }
  return { value, unit };
};

const convertInputToUnits = (inputValue: number, inputType: 'units' | 'cases' | 'bags', sku: SKU): number => {
  if (inputType === 'units') {
    return inputValue;
  } else if (inputType === 'cases') {
    const caseSize = sku.case_size || 1;
    return inputValue * caseSize;
  } else if (inputType === 'bags') {
    const bagSize = sku.bag_size || 1;
    return inputValue * bagSize;
  }
  return inputValue;
};

export const SimplifiedVerifyStockModal: React.FC<SimplifiedVerifyStockModalProps> = ({
  isOpen,
  onClose,
  retailer,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { location, getLocation } = useGeolocation();
  const [inputValue, setInputValue] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (retailer?.inventory) {
      retailer.inventory.forEach(sku => {
        initial[sku.id] = String(sku.current_stock);
      });
    }
    return initial;
  });
  const [verificationData, setVerificationData] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (retailer?.inventory) {
      retailer.inventory.forEach(sku => {
        initial[sku.id] = sku.current_stock;
      });
    }
    return initial;
  });
  const [allocations, setAllocations] = useState<Record<string, { farmer: number; retailers: { name: string; amount: number }[] }>>(() => {
    const initial: Record<string, { farmer: number; retailers: { name: string; amount: number }[] }> = {};
    if (retailer?.inventory) {
      retailer.inventory.forEach(sku => {
        // Initially, all stock is at retailer (farmer allocation is 0)
        initial[sku.id] = { farmer: 0, retailers: [] };
      });
    }
    return initial;
  });
  const [retailerStockInput, setRetailerStockInput] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadedProofs, setUploadedProofs] = useState<Array<{ id: string; type: string; name: string; url: string }>>([]);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [savedProgress, setSavedProgress] = useState<any>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [retailerSearch, setRetailerSearch] = useState<Record<string, string>>({});
  const [showRetailerDropdown, setShowRetailerDropdown] = useState<Record<string, boolean>>({});
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string>('');
  const [retailerAmount, setRetailerAmount] = useState<Record<string, string>>({});
  const [showAddRetailerModal, setShowAddRetailerModal] = useState(false);
  const [newlyAddedRetailers, setNewlyAddedRetailers] = useState<Array<{
    name: string;
    phone: string;
    outletName: string;
    code: string;
    address: string;
    market: string;
    city: string;
  }>>([]);
  const [availableRetailers, setAvailableRetailers] = useState<Array<{
    name: string;
    phone?: string;
    outletName?: string;
    code?: string;
    address?: string;
    market?: string;
  }>>([]);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-save progress
  useEffect(() => {
    if (!isOpen) return;

    const progressData = {
      retailerId: retailer.retailer_id,
      retailerName: retailer.retailer_name,
      currentStep,
      verificationData,
      allocations,
      retailerStockInput,
      signature,
      uploadedProofs,
      timestamp: Date.now(),
      lastUpdated: new Date().toLocaleString()
    };

    localStorage.setItem(`verification_progress_${retailer.retailer_id}`, JSON.stringify(progressData));
  }, [currentStep, verificationData, allocations, retailerStockInput, signature, uploadedProofs, isOpen, retailer.retailer_id, retailer.retailer_name]);

  // Initialize retailer stock input when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initial: Record<string, string> = {};
    retailer.inventory.forEach(sku => {
      initial[sku.id] = sku.current_stock.toString();
    });
    setRetailerStockInput(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, retailer.retailer_id]);

  // Fetch available retailers from database
  useEffect(() => {
    if (!isOpen) return;

    const fetchRetailers = async () => {
      if (!supabase) {
        // Fallback to mock data if no database
        setAvailableRetailers(MOCK_RETAILERS.map(r => ({
          name: r.name,
          phone: r.phone,
          outletName: r.name,
          code: r.code,
          address: r.location || '',
          market: r.market || ''
        })));
        return;
      }

      try {
        // Fetch all outlets (retailers)
        const { data: outlets, error } = await supabase
          .from('outlets')
          .select('outlet_code, outlet_name, owner_name, contact_phone, address')
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching retailers:', error);
          return;
        }

        if (outlets && outlets.length > 0) {
          const formattedRetailers = outlets.map(outlet => ({
            name: outlet.owner_name || outlet.outlet_name,
            phone: outlet.contact_phone || '',
            outletName: outlet.outlet_name,
            code: outlet.outlet_code,
            address: outlet.address || '',
            market: ''
          }));
          setAvailableRetailers(formattedRetailers);
          console.log(`Loaded ${formattedRetailers.length} retailers from database`);
        }
      } catch (error) {
        console.error('Error loading retailers:', error);
      }
    };

    fetchRetailers();
  }, [isOpen]);

  // Check for saved progress on mount
  useEffect(() => {
    if (!isOpen) return;

    const savedData = localStorage.getItem(`verification_progress_${retailer.retailer_id}`);
    if (savedData) {
      const progress = JSON.parse(savedData);
      const timeDiff = Date.now() - progress.timestamp;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // Show continue modal if progress is less than 24 hours old and not on first step
      if (hoursDiff < 24 && progress.currentStep > 1) {
        setSavedProgress(progress);
        setShowContinueModal(true);
      }
    }
  }, [isOpen, retailer.retailer_id]);

  const handleContinue = () => {
    if (savedProgress) {
      setCurrentStep(savedProgress.currentStep);
      setVerificationData(savedProgress.verificationData);
      setAllocations(savedProgress.allocations);
      setSignature(savedProgress.signature);
      setUploadedProofs(savedProgress.uploadedProofs);
    }
    setShowContinueModal(false);
  };

  const handleStartFresh = () => {
    localStorage.removeItem(`verification_progress_${retailer.retailer_id}`);
    setShowContinueModal(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(showRetailerDropdown).forEach(skuId => {
        if (showRetailerDropdown[skuId] && dropdownRefs.current[skuId] &&
            !dropdownRefs.current[skuId]?.contains(event.target as Node)) {
          setShowRetailerDropdown(prev => ({ ...prev, [skuId]: false }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
  };

  const handleClickPicture = () => {
    setShowInstructionsModal(true);
  };

  const openCamera = () => {
    setShowInstructionsModal(false);
    setShowCameraModal(true);
    setCameraKey(prev => prev + 1);
  };

  const handleCameraUpload = (files: File[]) => {
    const lastFile = files[files.length - 1];
    if (lastFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newProof = {
          id: `photo_${Date.now()}`,
          type: 'photo',
          name: lastFile.name,
          url: reader.result as string
        };
        setUploadedProofs(prev => [...prev, newProof]);
        showNotification('Photo uploaded successfully', 'success');
        setShowCameraModal(false);
      };
      reader.readAsDataURL(lastFile);
    }
  };

  const handleCameraCancel = () => {
    setShowCameraModal(false);
  };

  if (!isOpen) return null;

  const updateStock = (skuId: string, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    const sku = retailer.inventory.find(s => s.id === skuId);

    if (!sku) return;

    // Update input value
    setInputValue(prev => ({ ...prev, [skuId]: value }));

    // Convert to actual units based on SKU unit type
    // Always use bags for Kg SKUs, cases for Ltr SKUs
    const unit = sku.unit.toLowerCase();
    const inputType = unit.includes('kg') ? 'bags' : 'cases';
    const actualUnits = convertInputToUnits(isNaN(numValue) ? 0 : numValue, inputType, sku);

    setVerificationData({
      ...verificationData,
      [skuId]: actualUnits
    });
  };

  const totalCurrentStock = retailer.inventory.reduce((sum, sku) => sum + sku.current_stock, 0);
  const totalNewStock = Object.values(verificationData).reduce((sum, val) => sum + val, 0);
  const totalDecreased = totalCurrentStock - totalNewStock;

  const steps = [
    { number: 1, label: 'Verify', completed: currentStep > 1 },
    { number: 2, label: 'Allocate', completed: currentStep > 2 },
    { number: 3, label: 'E-Sign', completed: currentStep > 3 },
    { number: 4, label: 'Proof', completed: currentStep > 4 }
  ];

  const handleNext = () => {
    if (currentStep === 3 && !signature) {
      showNotification('Please provide your signature', 'error');
      return;
    }
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const updateRetailerStock = (skuId: string, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    const sku = retailer.inventory.find(s => s.id === skuId);
    if (!sku) return;

    const totalStock = sku.current_stock;

    // Update input state
    setRetailerStockInput(prev => ({
      ...prev,
      [skuId]: value
    }));

    console.log('Retailer Stock Update:', {
      skuName: sku.sku_name,
      currentStock: totalStock,
      retailerStock: numValue,
      farmerAllocation: totalStock - numValue
    });

    if (!isNaN(numValue) && numValue > totalStock) {
      const displayTotal = convertToMainUnit(totalStock, sku.unit);
      showNotification(
        `Stock at retailer cannot exceed total stock of ${displayTotal.value.toFixed(0)} ${displayTotal.unit}.`,
        'error'
      );
      return;
    }

    // Auto-calculate farmer allocation as the remaining stock
    const farmerAllocation = totalStock - numValue;

    setAllocations(prev => ({
      ...prev,
      [skuId]: {
        retailers: [],
        farmer: isNaN(farmerAllocation) ? 0 : farmerAllocation
      }
    }));
  };

  const addRetailerAllocation = (skuId: string, retailerName: string, amount: number) => {
    const sku = retailer.inventory.find(s => s.id === skuId);
    if (!sku) return;

    const totalDifference = Math.abs(sku.current_stock - verificationData[skuId]);
    const farmerAllocation = allocations[skuId]?.farmer || 0;
    const currentRetailerTotal = allocations[skuId]?.retailers.reduce((sum, r) => sum + r.amount, 0) || 0;
    const maxAllowed = totalDifference - farmerAllocation - currentRetailerTotal;

    if (amount > maxAllowed) {
      const displayAmount = convertToMainUnit(amount, sku.unit);
      const displayMax = convertToMainUnit(maxAllowed, sku.unit);
      const displayTotal = convertToMainUnit(totalDifference, sku.unit);
      const displayFarmer = convertToMainUnit(farmerAllocation, sku.unit);
      const displayRetailer = convertToMainUnit(currentRetailerTotal, sku.unit);
      showNotification(`Cannot allocate ${displayAmount.value.toFixed(0)} ${displayAmount.unit} to this retailer. Only ${displayMax.value.toFixed(0)} ${displayMax.unit} remaining.`, 'error');
      return;
    }

    setAllocations({
      ...allocations,
      [skuId]: {
        ...allocations[skuId],
        retailers: [...allocations[skuId].retailers, { name: retailerName, amount }]
      }
    });
  };

  const removeRetailerAllocation = (skuId: string, index: number) => {
    setAllocations({
      ...allocations,
      [skuId]: {
        ...allocations[skuId],
        retailers: allocations[skuId].retailers.filter((_, i) => i !== index)
      }
    });
  };

  const getTotalAllocated = (skuId: string) => {
    const allocation = allocations[skuId];
    if (!allocation) return 0;
    const retailerTotal = allocation.retailers.reduce((sum, r) => sum + r.amount, 0);
    return allocation.farmer + retailerTotal;
  };

  const getRemaining = (skuId: string, sku: SKU) => {
    const difference = Math.abs(sku.current_stock - verificationData[skuId]);
    const allocated = getTotalAllocated(skuId);
    const remaining = difference - allocated;
    return remaining >= 0 ? remaining : 0;
  };

  const isFullyAllocated = (skuId: string, sku: SKU) => {
    const difference = Math.abs(sku.current_stock - verificationData[skuId]);
    const allocated = getTotalAllocated(skuId);
    return difference > 0 && allocated >= difference;
  };

  const addRetailerToAllocation = (skuId: string, retailerName: string) => {
    const amount = parseInt(retailerAmount[skuId] || '0', 10);
    if (amount <= 0 || isNaN(amount)) {
      showNotification('Please enter a valid quantity greater than 0', 'error');
      return;
    }
    addRetailerAllocation(skuId, retailerName, amount);
    setRetailerSearch({ ...retailerSearch, [skuId]: '' });
    setRetailerAmount({ ...retailerAmount, [skuId]: '' });
    setShowRetailerDropdown({ ...showRetailerDropdown, [skuId]: false });
  };

  const currentUser = useAppSelector((state) => state.auth.user);

  const getFilteredRetailers = (skuId: string) => {
    const search = retailerSearch[skuId] || '';
    const selectedIds = allocations[skuId]?.retailers.map(r => r.name) || [];

    // Combine database retailers and newly added ones
    const allRetailers = [
      ...availableRetailers.map(r => ({
        id: r.code || r.name,
        name: r.name,
        code: r.code || '',
        phone: r.phone || '',
        location: r.address || '',
        market: r.market || '',
        city: ''
      })),
      ...newlyAddedRetailers.map(r => ({
        id: r.code,
        name: r.name,
        code: r.code,
        phone: r.phone,
        location: r.address,
        market: r.market,
        city: r.city
      }))
    ];

    return allRetailers.filter(retailer =>
      !selectedIds.includes(retailer.name) &&
      (retailer.name.toLowerCase().includes(search.toLowerCase()) ||
       retailer.code.toLowerCase().includes(search.toLowerCase()) ||
       (retailer.phone && retailer.phone.includes(search)))
    );
  };

  const handleSubmit = async () => {
    // Validate that at least one photo is uploaded
    if (uploadedProofs.length === 0 && photos.length === 0) {
      showNotification('Please capture at least one photo as proof', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current location
      await getLocation();

      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

      // Prepare SKU verifications
      const skuVerifications = retailer.inventory.map(sku => ({
        id: sku.id,
        sku_code: sku.sku_code,
        sku_name: sku.sku_name,
        product_name: sku.product_name,
        previous_stock: sku.current_stock,
        verified_stock: verificationData[sku.id] || sku.current_stock,
        unit: sku.unit,
        value: sku.value
      }));

      // Save to database
      const result = await saveStockVerification({
        retailerId: retailer.retailer_id,
        retailerName: retailer.retailer_name,
        retailerLocation: retailer.retailer_location,
        distributorId: (retailer as any).distributor_id,
        distributorName: (retailer as any).distributor_name,
        skuVerifications,
        allocations,
        signature: signature || undefined,
        photos,
        recordedBy: currentUser.name || 'Unknown',
        recordedByRole: currentUser.role || 'Unknown',
        latitude: location?.latitude,
        longitude: location?.longitude
      });

      if (result.success) {
        showNotification('Stock verification submitted successfully!', 'success');
        // Clear saved progress on successful submission
        localStorage.removeItem(`verification_progress_${retailer.retailer_id}`);

        // Wait a bit to show success message
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
      } else {
        showNotification(`Failed to save verification: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error submitting verification:', error);
      showNotification('Error submitting verification. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;
  if (!retailer || !retailer.inventory || retailer.inventory.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">
                {currentStep === 1 ? (
                  <span className="flex items-center gap-2">
                    <span>Verify Stock</span>
                    <span className="text-gray-400">|</span>
                    <span className="text-blue-700">Verification</span>
                  </span>
                ) : currentStep === 2 ? (
                  <span className="flex items-center gap-2">
                    <span>Verify Stock</span>
                    <span className="text-gray-400">|</span>
                    <span className="text-orange-700">Farmer Allocation</span>
                  </span>
                ) : currentStep === 3 ? (
                  <span className="flex items-center gap-2">
                    <span>Verify Stock</span>
                    <span className="text-gray-400">|</span>
                    <span className="text-blue-700">E-Sign</span>
                  </span>
                ) : currentStep === 4 ? (
                  <span className="flex items-center gap-2">
                    <span>Verify Stock</span>
                    <span className="text-gray-400">|</span>
                    <span className="text-amber-700">Pic-Verify</span>
                  </span>
                ) : (
                  'Verify Stock'
                )}
              </h2>
              <p className="text-sm mt-0.5">
                {currentStep === 1 ? (
                  <span className="text-blue-600">Review stock changes for all SKUs below.</span>
                ) : currentStep === 2 ? (
                  <span className="text-orange-600">Allocate stock to farmer. Remaining will stay at retailer.</span>
                ) : currentStep === 3 ? (
                  <span className="text-blue-600">Provide your electronic signature to authenticate this stock verification.</span>
                ) : currentStep === 4 ? (
                  <span className="text-amber-700">Capture a photo as proof of verification.</span>
                ) : (
                  <span className="text-gray-600">Outlet Details And Transaction History</span>
                )}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Step Progress Indicator */}
          <div className="py-3 flex items-center justify-center space-x-2">
            <div className="flex items-center space-x-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === 1 ? 'bg-blue-600 text-white' : currentStep > 1 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>1</div>
              <span className={`text-xs ${currentStep === 1 ? 'font-semibold text-gray-900' : currentStep > 1 ? 'text-green-600' : 'text-gray-400'}`}>Verification</span>
            </div>
            <div className="h-px w-4 bg-gray-300"></div>
            <div className="flex items-center space-x-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === 2 ? 'bg-orange-600 text-white' : currentStep > 2 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>2</div>
              <span className={`text-xs ${currentStep === 2 ? 'font-semibold text-gray-900' : currentStep > 2 ? 'text-green-600' : 'text-gray-400'}`}>Farmer Allocation</span>
            </div>
            <div className="h-px w-4 bg-gray-300"></div>
            <div className="flex items-center space-x-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === 3 ? 'bg-blue-600 text-white' : currentStep > 3 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>3</div>
              <span className={`text-xs ${currentStep === 3 ? 'font-semibold text-gray-900' : currentStep > 3 ? 'text-green-600' : 'text-gray-400'}`}>E-Sign</span>
            </div>
            <div className="h-px w-4 bg-gray-300"></div>
            <div className="flex items-center space-x-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === 4 ? 'bg-blue-600 text-white' : currentStep > 4 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>4</div>
              <span className={`text-xs ${currentStep === 4 ? 'font-semibold text-gray-900' : currentStep > 4 ? 'text-green-600' : 'text-gray-400'}`}>Pic-Verify</span>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-700" />
                <span className="text-base font-bold text-orange-800">{retailer.retailer_name}</span>
              </div>
              <div className="flex items-center gap-2 text-orange-700">
                <span className="font-medium">#</span>
                <span className="font-medium">Code: {retailer.retailer_id}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-600">
                ₹{(totalCurrentStock * 720 / 1000).toFixed(2)}K
              </div>
              <div className="text-sm text-orange-600 font-medium">Total Balance Stock</div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Verify Stock */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Product & SKU Breakdown</h3>

              {/* Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="bg-gray-100 grid grid-cols-[2fr,1.5fr,1fr,1.5fr] gap-4 px-6 py-3 border-b border-gray-300">
                  <div className="text-sm font-bold text-gray-700 uppercase">PRODUCT</div>
                  <div className="text-sm font-bold text-gray-700 uppercase">SKU</div>
                  <div className="text-sm font-bold text-gray-700 uppercase">ALLOCATED STOCK</div>
                  <div className="text-sm font-bold text-gray-700 uppercase">UPDATE CURRENT STOCK</div>
                </div>

                {/* Table Rows */}
                {retailer.inventory.map((sku, idx) => {
                  const displayCurrent = convertToMainUnit(sku.current_stock, sku.unit);
                  const difference = verificationData[sku.id] - sku.current_stock;
                  const isDecreased = difference < 0;

                  return (
                    <div key={sku.id} className={`grid grid-cols-[2fr,1.5fr,1fr,1.5fr] gap-4 px-6 py-4 ${idx % 2 === 0 ? 'bg-yellow-50' : 'bg-blue-50'}`}>
                      <div>
                        <div className="font-bold text-gray-900 text-base">{sku.product_name}</div>
                        <div className="text-xs text-gray-600 mt-1">{sku.sku_code}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{sku.sku_name}</div>
                        <div className="text-xs text-gray-600 mt-1">({displayCurrent.unit})</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900">{displayCurrent.value.toFixed(0)} <span className="text-sm font-normal text-gray-600">{displayCurrent.unit}</span></div>
                        <div className="text-xs text-gray-500">Value: ₹{(sku.current_stock * 720 / 1000).toFixed(2)}K</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={inputValue[sku.id]}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              updateStock(sku.id, value);
                            }}
                            className={`w-24 px-3 py-2.5 text-base font-medium border-2 rounded focus:ring-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              isDecreased ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                            }`}
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {displayCurrent.unit.toLowerCase().includes('kg') ? 'Bag(s)' : 'Case(s)'}
                          </span>
                        </div>
                        {/* Show conversion text below input */}
                        <div className="text-xs mt-1 min-h-[18px] mb-1">
                          {inputValue[sku.id] && Number(inputValue[sku.id]) > 0 ? (
                            <div className="text-gray-500">
                              ({verificationData[sku.id]} {displayCurrent.unit})
                            </div>
                          ) : null}
                        </div>
                        {isDecreased && (
                          <div className="text-xs font-medium text-red-600 mt-1">
                            <span className="text-red-600">↓ {Math.abs(difference)} {displayCurrent.unit}</span>
                            <div className="text-red-700">Stock Decreased (Liquidation)</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Farmer Allocation */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Farmer Allocation</h3>

              {retailer.inventory.map((sku) => {
                const displayCurrent = convertToMainUnit(sku.current_stock, sku.unit);
                const displayNew = convertToMainUnit(verificationData[sku.id], sku.unit);
                const difference = verificationData[sku.id] - sku.current_stock;
                const isDecreased = difference < 0;
                const totalStock = sku.current_stock;
                const farmerAllocation = allocations[sku.id]?.farmer || 0;
                const retailerStock = totalStock - farmerAllocation;
                const displayTotalLiquidated = convertToMainUnit(totalStock, sku.unit);
                const displayFarmerAllocation = convertToMainUnit(farmerAllocation, sku.unit);
                const displayRetailerStock = convertToMainUnit(retailerStock, sku.unit);

                if (!isDecreased) return null;

                return (
                  <div key={sku.id} className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-900">{sku.product_name}</h4>
                        <p className="text-sm text-gray-600">{sku.sku_name} ({sku.sku_code})</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Total Balance Stock</div>
                        <div className="text-xl font-bold text-blue-600">
                          {displayTotalLiquidated.value.toFixed(2)} {displayTotalLiquidated.unit}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Retailer Allocations */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Retailer Allocations
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9.]*"
                          value={retailerStockInput[sku.id] || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            updateRetailerStock(sku.id, value);
                          }}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                        <div className="mt-1.5 text-xs text-gray-600">
                          Stock remaining at retailer ({displayRetailerStock.value.toFixed(2)} {displayRetailerStock.unit})
                        </div>
                      </div>

                      {/* Farmer Allocation */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Farmer Allocation
                        </label>
                        <div className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-700 font-medium">
                          {displayFarmerAllocation.value.toFixed(2)} {displayFarmerAllocation.unit}
                        </div>
                        <div className="mt-1.5 text-xs text-gray-600">
                          Balance after retailer allocations
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 3: E-Sign */}
          {currentStep === 3 && (() => {
            const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
              const canvas = signatureCanvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const ctx = canvas.getContext('2d');
              if (!ctx) return;

              setIsDrawing(true);
              ctx.beginPath();
              ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
            };

            const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
              if (!isDrawing) return;
              const canvas = signatureCanvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              const ctx = canvas.getContext('2d');
              if (!ctx) return;

              ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
              ctx.stroke();
            };

            const stopDrawing = () => {
              if (isDrawing) {
                const canvas = signatureCanvasRef.current;
                if (canvas) {
                  setSignature(canvas.toDataURL());
                }
              }
              setIsDrawing(false);
            };

            const clearSignature = () => {
              const canvas = signatureCanvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  setSignature('');
                }
              }
            };

            return (
              <div className="space-y-6">
                <div className="max-w-2xl mx-auto">
                  <h4 className="font-semibold text-gray-900 mb-4">
                    E-Sign <span className="text-red-600">(Required)</span>
                  </h4>

                  <div className="border-2 border-gray-300 rounded-lg bg-white">
                    <canvas
                      ref={signatureCanvasRef}
                      width={400}
                      height={200}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      className="w-full cursor-crosshair"
                      style={{ touchAction: 'none' }}
                    />
                  </div>

                  <p className="text-xs text-gray-500 text-center mt-2">
                    Draw your signature above
                  </p>

                  <button
                    onClick={clearSignature}
                    className="w-full mt-3 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Step 4: Pic-Verify */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-white">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-28 h-28 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200 flex items-center justify-center">
                    <Camera className="w-14 h-14 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-800 mb-1">Camera Required</p>
                    <p className="text-base text-gray-600">Click The Button Below To Capture Photo Proof</p>
                  </div>
                  <button
                    onClick={handleClickPicture}
                    className="w-full px-10 py-3.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <Camera className="w-6 h-6" />
                    Click Picture
                  </button>
                </div>
              </div>

              {uploadedProofs.length > 0 && (
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-3 text-green-700">
                    <CheckCircle className="w-6 h-6 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-base">
                        {uploadedProofs.length} photo{uploadedProofs.length > 1 ? 's' : ''} captured successfully
                      </p>
                      <p className="text-sm text-green-600 mt-0.5">
                        Click preview to view photos
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {uploadedProofs.map((proof, index) => {
                      console.log('Rendering proof:', proof);
                      return (
                        <div key={proof.id} className="flex items-center justify-between bg-white p-3 rounded-lg border-2 border-green-300 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                              <Camera className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-gray-800">Photo {index + 1}</span>
                              <p className="text-xs text-gray-500 truncate max-w-[150px]">{proof.name}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              console.log('Preview clicked for:', proof);
                              setPreviewPhotoUrl(proof.url);
                              setShowPhotoPreview(true);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                          >
                            <Eye className="w-4 h-4" />
                            Preview
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-base font-bold text-orange-600">
            {retailer.inventory.length} SKU(S) Ready For Verification
          </div>
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Back
              </button>
            )}
            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                disabled={false}
                className="px-8 py-3 text-base font-bold rounded-lg transition-colors bg-orange-600 text-white hover:bg-orange-700 cursor-pointer"
              >
                {currentStep === 1 ? `Proceed to Verification (${retailer.inventory.length})` : 'Next'}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-3 text-base font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            )}
          </div>
        </div>
      </div>

      <AddRetailerModal
        isOpen={showAddRetailerModal}
        onClose={() => setShowAddRetailerModal(false)}
        onSave={async (newRetailer: NewRetailerData) => {
          try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const outletCode = `RET-${Date.now()}`;
            const fullAddress = `${newRetailer.address}, ${newRetailer.city}, ${newRetailer.state} - ${newRetailer.pincode}`;

            // Save to database
            if (supabase) {
              const { data: outletData, error: outletError } = await supabase
                .from('outlets')
                .insert({
                  outlet_code: outletCode,
                  outlet_name: newRetailer.outletName,
                  owner_name: newRetailer.name,
                  contact_phone: newRetailer.phone,
                  address: fullAddress,
                  state: newRetailer.state,
                  mdo_id: currentUser.id || 'unknown',
                  is_active: true
                })
                .select()
                .single();

              if (outletError) {
                console.error('Error saving retailer:', outletError);
                showNotification(`Failed to save retailer: ${outletError.message}`, 'error');
                return;
              }

              console.log('Retailer saved to database:', outletData);

              // Create initial inventory entry with 0 stock so retailer appears in verification list
              const { error: inventoryError } = await supabase
                .from('retailer_inventory')
                .insert({
                  retailer_id: outletCode,
                  retailer_name: newRetailer.outletName,
                  retailer_business_name: newRetailer.outletName,
                  retailer_location: `${newRetailer.city}, ${newRetailer.state}`,
                  distributor_id: retailer.retailer_id,
                  distributor_name: retailer.retailer_name,
                  product_code: 'PENDING',
                  product_name: 'To be allocated',
                  sku_code: 'PENDING-001',
                  sku_name: 'Awaiting stock allocation',
                  current_stock: 0,
                  unit: 'Unit',
                  total_received: 0,
                  total_sold: 0
                });

              if (inventoryError) {
                console.warn('Error creating inventory entry:', inventoryError);
              }
            }

            // Add to both local state and available retailers for immediate use
            const retailerData = {
              name: newRetailer.name,
              phone: newRetailer.phone,
              outletName: newRetailer.outletName,
              code: outletCode,
              address: fullAddress,
              market: newRetailer.market,
              city: newRetailer.city
            };

            setNewlyAddedRetailers(prev => [...prev, retailerData]);
            setAvailableRetailers(prev => [...prev, retailerData]);
            setShowAddRetailerModal(false);
            showNotification(`Retailer "${newRetailer.name}" added successfully! They are now saved to the database.`, 'success');
          } catch (error) {
            console.error('Error adding retailer:', error);
            showNotification('Failed to add retailer. Please try again.', 'error');
          }
        }}
        existingRetailers={[
          ...availableRetailers,
          ...newlyAddedRetailers
        ]}
      />

      {showCameraModal && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-[200] flex flex-col">
          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Capture Proof Photo</h3>
              <button
                onClick={() => setShowCameraModal(false)}
                className="text-white hover:text-gray-300 p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <div className="w-full">
                <MediaUpload
                  onUpload={(files) => {
                    setPhotos(prev => [...prev, ...files]);
                    setShowCameraModal(false);
                  }}
                  maxFiles={5 - photos.length}
                  acceptedTypes={['image/*']}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Continue Verification Modal */}
      {showContinueModal && savedProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-full p-2 flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white break-words">Hi {currentUser?.name?.split(' ')[0] || 'there'}!</h3>
                  <p className="text-sm text-blue-50 mt-0.5">Continue Verification?</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <p className="text-gray-700 text-base leading-relaxed">
                  <span className="font-semibold text-gray-900">Hi {currentUser?.name?.split(' ')[0] || 'there'}</span>, you have an incomplete verification from today for{' '}
                  <span className="font-semibold text-gray-900">{savedProgress.retailerName}</span>.
                </p>

                <p className="text-gray-700 text-base leading-relaxed">
                  Would you like to continue from where you left off{' '}
                  <span className="font-semibold text-gray-900">(Step {savedProgress.currentStep})</span>?
                </p>
              </div>

              {/* Info Note */}
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm mb-1">Note:</h4>
                    <p className="text-sm text-blue-800">
                      Clicking "Start Fresh" will discard your saved progress and start a new verification.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 pt-2">
                Last saved: {savedProgress.lastUpdated}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3">
              <button
                onClick={handleStartFresh}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
              >
                Start Fresh
              </button>
              <button
                onClick={handleContinue}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-lg"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[200] flex items-center justify-center p-2">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[95vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-white text-green-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
                  <h3 className="text-lg font-bold text-white">Step 4: Capture Proof Photo</h3>
                </div>
                <p className="text-xs text-green-50 mt-0.5">Take a clear photo as proof of stock verification</p>
              </div>
              <button
                onClick={handleCameraCancel}
                className="text-white hover:text-green-100 p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden">
                <MediaUpload
                  key={cameraKey}
                  onUpload={handleCameraUpload}
                  maxFiles={5}
                  acceptedTypes={['image/*']}
                  autoOpenCamera={true}
                  onCancel={handleCameraCancel}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Important Instructions</h3>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-orange-50 border-l-4 border-orange-500 rounded-r-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Click Picture of Person</h4>
                    <p className="text-sm text-gray-700">Take a photo of the person who has e-signed the document</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 border-l-4 border-orange-500 rounded-r-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Include Shop Signboard</h4>
                    <p className="text-sm text-gray-700">Try to capture the shop name or signboard in the photo if possible</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={openCamera}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold shadow-lg"
              >
                OK, Open Camera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {showPhotoPreview && previewPhotoUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 z-[300] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPhotoPreview(false);
              setPreviewPhotoUrl('');
            }
          }}
        >
          <div className="relative max-w-6xl w-full max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 bg-black/50 p-4 rounded-t-lg">
              <h3 className="text-xl font-bold text-white">Photo Preview</h3>
              <button
                onClick={() => {
                  console.log('Closing preview');
                  setShowPhotoPreview(false);
                  setPreviewPhotoUrl('');
                }}
                className="text-white hover:text-red-400 p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center bg-gray-900 rounded-lg overflow-hidden min-h-[400px]">
              <img
                src={previewPhotoUrl}
                alt="Photo Preview"
                className="max-w-full max-h-[70vh] object-contain"
                onError={(e) => {
                  console.error('Image failed to load:', previewPhotoUrl);
                  e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="10" y="50">Error loading image</text></svg>';
                }}
                onLoad={() => console.log('Image loaded successfully')}
              />
            </div>
            <div className="mt-4 flex justify-center gap-3 bg-black/50 p-4 rounded-b-lg">
              <a
                href={previewPhotoUrl}
                download={`verification-photo-${Date.now()}.jpg`}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg"
              >
                <ExternalLink className="w-5 h-5" />
                Download Photo
              </a>
              <button
                onClick={() => {
                  setShowPhotoPreview(false);
                  setPreviewPhotoUrl('');
                }}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

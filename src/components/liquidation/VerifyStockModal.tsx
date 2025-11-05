/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
import React, { useState, useRef, useEffect } from 'react';
import { X, Building2, Hash, MapPin, ChevronDown, ChevronUp, Camera, Upload, FileText, CheckCircle, AlertTriangle, MailCheckIcon, MessageCircle, MessageCircleIcon, Eye, Download, Share2, Copy, Navigation } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { AddRetailerModal, NewRetailerData } from './AddRetailerModal';
import { ProofDocumentViewer } from './ProofDocumentViewer';
import { MediaUpload } from '../MediaUpload';
import { IRetailer, useLiquidation } from '../../contexts/LiquidationContext';
import LoadingSkeleton from '../LoadingSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import jsPDF from 'jspdf';
import { supabase } from '../../lib/supabase';
import AsyncSelect from 'react-select/async';

const InlineLoader: React.FC = () => (
  <div className="flex items-center justify-center">
    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const convertToMainUnit = (value: number, unit: string): { value: number; unit: string } => {
  const lowerUnit = unit.toLowerCase();
  if (lowerUnit === 'ml') {
    return { value: value / 1000, unit: 'Ltr' };
  } else if (lowerUnit === 'mg' || lowerUnit === 'gm' || lowerUnit === 'g') {
    return { value: value / 1000, unit: 'Kg' };
  }
  return { value, unit };
};
interface SKU {
  productCode: string | null | undefined;
  skuCode: string;
  skuName: string;
  name?: string;
  unit: string;
  openingStock: number;
  currentStock: number;
  liquidated: number;
  unitPrice: number;
}

interface Product {
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  skus: SKU[];
}

interface VerifyStockModalProps {
  distributorId: string;
  distributorName: string;
  distributorCode: string;
  salesStaffName?: string;
  onClose: () => void;
  onSuccess?: () => void;
  productData: Product[];
  selectedMetric: string;
  distributorLatitude?: number | null;
  distributorLongitude?: number | null;
}

export const VerifyStockModal: React.FC<VerifyStockModalProps> = ({
  distributorId,
  distributorName,
  distributorCode,
  salesStaffName = 'Sales Representative',
  selectedMetric,
  onClose,
  onSuccess,
  distributorLatitude,
  distributorLongitude
}) => {
  const userLocation = useGeolocation();
  const { productData, fetchProductData, retailers, createRetailer, fetchRetailers, uploadFile, submitLiquidation, loadingProducts } = useLiquidation();
  const [showLoader, setShowLoader] = useState(false);
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [isVerificationComplete, setIsVerificationComplete] = useState(false);
  const [generatedDocLink, setGeneratedDocLink] = useState<string | null>(null);
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 10000000) {
      return `${sign}₹${(absValue / 10000000).toFixed(2)}Cr`;
    } else if (absValue >= 100000) {
      return `${sign}₹${(absValue / 100000).toFixed(2)}L`;
    } else if (absValue >= 1000) {
      return `${sign}₹${(absValue / 1000).toFixed(2)}K`;
    }
    return `${sign}₹${absValue.toFixed(2)}`;
  };

  const { user } = useAuth()
  const { showError, showSuccess, showWarning } = useModal();
  const [modalTab, setModalTab] = useState<'details' | 'verify'>('details');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedSKUs, setExpandedSKUs] = useState<Set<string>>(new Set());
  const [verificationProductData, setVerificationProductData] = useState<Product[]>([]);
  const [currentDistributorId, setCurrentDistributorId] = useState<string | null>(null);

  useEffect(() => {
    if (distributorId !== currentDistributorId) {
      setVerificationProductData([]);
      setCurrentDistributorId(distributorId);
      fetchProductData(distributorId!);
    }
  }, [distributorId, fetchProductData, selectedMetric, currentDistributorId])
  const [stockInputs, setStockInputs] = useState<Map<string, string>>(new Map());
  const [allSKUsToProcess, setAllSKUsToProcess] = useState<Array<{ product: Product; sku: SKU; newStock: number }>>([]);
  const [showTransactionSplitModal, setShowTransactionSplitModal] = useState(false);
  const [verificationStep, setVerificationStep] = useState(1);

  useEffect(() => {
    fetchRetailers();
  }, [fetchRetailers])

  // Location check removed - proceed without location verification

  useEffect(() => {
    if (productData && productData.length > 0) {
      setVerificationProductData(productData);
    } else if (!loadingProducts) {
      // Show dummy data when no data from database
      const dummyData: Product[] = [
        {
          productId: 'P001',
          productCode: 'P001',
          productName: 'Herbicide Premium',
          category: 'Agrochemical',
          skus: [
            {
              productCode: 'P001',
              skuCode: 'SKU001',
              skuName: '500ml Bottle',
              unit: 'ml',
              openingStock: 150,
              ytdSales: 80,
              liquidated: 80,
              currentStock: 70,
              unitPrice: 450
            },
            {
              productCode: 'P001',
              skuCode: 'SKU002',
              skuName: '1L Bottle',
              unit: 'Ltr',
              openingStock: 200,
              ytdSales: 120,
              liquidated: 120,
              currentStock: 80,
              unitPrice: 850
            }
          ]
        },
        {
          productId: 'P002',
          productCode: 'P002',
          productName: 'Insecticide Pro',
          category: 'Agrochemical',
          skus: [
            {
              productCode: 'P002',
              skuCode: 'SKU003',
              skuName: '250ml Bottle',
              unit: 'ml',
              openingStock: 180,
              ytdSales: 95,
              liquidated: 95,
              currentStock: 85,
              unitPrice: 320
            },
            {
              productCode: 'P002',
              skuCode: 'SKU004',
              skuName: '500ml Bottle',
              unit: 'ml',
              openingStock: 160,
              ytdSales: 70,
              liquidated: 70,
              currentStock: 90,
              unitPrice: 580
            }
          ]
        },
        {
          productId: 'P003',
          productCode: 'P003',
          productName: 'Fungicide Advanced',
          category: 'Agrochemical',
          skus: [
            {
              productCode: 'P003',
              skuCode: 'SKU005',
              skuName: '1L Bottle',
              unit: 'Ltr',
              openingStock: 120,
              ytdSales: 60,
              liquidated: 60,
              currentStock: 60,
              unitPrice: 920
            }
          ]
        }
      ];
      setVerificationProductData(dummyData);
    }
  }, [productData, loadingProducts])
  // Per-SKU data storage: key = `${productCode}-${skuCode}`
  const [skuFarmerQuantities, setSkuFarmerQuantities] = useState<Map<string, string>>(new Map());
  const [skuRetailers, setSkuRetailers] = useState<Map<string, Array<{ id: string; code: string; name: string; phone: string; address: string; quantity: string }>>>(new Map());

  const [expandedSKUsInVerification, setExpandedSKUsInVerification] = useState<Set<string>>(new Set());

  const [uploadedProofs, setUploadedProofs] = useState<any[]>([]);
  const [photosSaved, setPhotosSaved] = useState<Set<number>>(new Set());
  const [selectedProofForViewing, setSelectedProofForViewing] = useState<any | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showAddRetailerModal, setShowAddRetailerModal] = useState(false);
  const [showPhotoReminderModal, setShowPhotoReminderModal] = useState(false);
  const [showContinueProgressModal, setShowContinueProgressModal] = useState(false);
  const [savedProgressData, setSavedProgressData] = useState<any>(null);
  const [currentSKUKeyForRetailerSelection, setCurrentSKUKeyForRetailerSelection] = useState<string>('');
  const [prefilledRetailerName, setPrefilledRetailerName] = useState<string>('');
  const [signature, setSignature] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedMetadata, setCapturedMetadata] = useState<{ user: string; timestamp: string; location: string } | null>(null);

  // Save verification progress to localStorage
  const saveVerificationProgress = () => {
    if (verificationStep > 1 && allSKUsToProcess.length > 0) {
      const progress = {
        distributorId,
        distributorCode,
        distributorName,
        verificationStep,
        allSKUsToProcess,
        skuFarmerQuantities: Array.from(skuFarmerQuantities.entries()),
        skuRetailers: Array.from(skuRetailers.entries()),
        signature,
        uploadedProofs,
        timestamp: new Date().toISOString(),
        date: new Date().toDateString()
      };
      console.log('💾 Saving progress:', progress);
      localStorage.setItem(`verification_progress_${distributorId}`, JSON.stringify(progress));
    } else {
      console.log('⚠️ Not saving progress - step:', verificationStep, 'SKUs:', allSKUsToProcess.length);
    }
  };

  // Load verification progress from localStorage
  const loadVerificationProgress = () => {
    const savedProgress = localStorage.getItem(`verification_progress_${distributorId}`);
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        const savedDate = new Date(progress.date).toDateString();
        const today = new Date().toDateString();

        if (savedDate === today && progress.distributorId === distributorId) {
          return progress;
        } else {
          // Clear old progress if it's not from today
          localStorage.removeItem(`verification_progress_${distributorId}`);
        }
      } catch (error) {
        console.error('Error loading verification progress:', error);
      }
    }
    return null;
  };

  // Clear verification progress from localStorage
  const clearVerificationProgress = () => {
    localStorage.removeItem(`verification_progress_${distributorId}`);
  };

  // Check for saved progress whenever component mounts or distributorId changes
  useEffect(() => {
    // Always check for saved progress when the modal is opened
    const checkSavedProgress = () => {
      const savedProgress = loadVerificationProgress();
      console.log('🔍 Checking for saved progress:', savedProgress);

      if (savedProgress && savedProgress.verificationStep > 1) {
        console.log('✅ Found saved progress at step:', savedProgress.verificationStep);
        // Show custom modal instead of browser confirm
        setSavedProgressData(savedProgress);
        setShowContinueProgressModal(true);

        // Mark distributor as current to prevent data fetch
        setCurrentDistributorId(distributorId);
      } else {
        console.log('❌ No saved progress found or step <= 1');
        // No saved progress, ensure continue modal is hidden
        setShowContinueProgressModal(false);
        setSavedProgressData(null);
      }
    };

    checkSavedProgress();
  }, [distributorId]);

  useEffect(() => {
    // Only fetch if no saved progress was found
    if (distributorId && distributorId !== currentDistributorId && !savedProgressData) {
      // 🧹 Clear old data to prevent flicker of old info
      setVerificationProductData([]);
      setStockInputs(new Map());
      setExpandedProducts(new Set());
      setExpandedSKUs(new Set());
      setAllSKUsToProcess([]);
      setSkuFarmerQuantities(new Map());
      setSkuRetailers(new Map());
      setUploadedProofs([]);
      setPhotosSaved(new Set());
      setSignature('');
      setCapturedMetadata(null);
      setVerificationStep(1);
      setShowTransactionSplitModal(false);

      // Update distributor reference
      setCurrentDistributorId(distributorId);

      // 🕐 Now fetch fresh data
      fetchProductData(distributorId);
    }

  }, [distributorId, fetchProductData, currentDistributorId, savedProgressData]);
  const [isDataReady, setIsDataReady] = useState(false);
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    // When loading starts
    if (loadingProducts) {
      setShowLoader(true);
      setIsDataReady(false);
    }

    // When data finishes loading and product data arrives
    if (!loadingProducts && verificationProductData.length > 0) {
      // Keep loader visible slightly longer for smoothness
      timer = setTimeout(() => {
        const newTotal = verificationProductData.reduce(
          (sum, product) =>
            sum +
            product.skus.reduce(
              (skuSum, sku) => skuSum + sku.currentStock * sku.unitPrice,
              0
            ),
          0
        );
        setDisplayValue(newTotal);
        setIsDataReady(true);
        setShowLoader(false);
      }, 500); // 👈 adjust for smooth feel (1s)
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loadingProducts, verificationProductData]);



  const toggleProduct = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const toggleSKU = (skuCode: string) => {
    const newExpanded = new Set(expandedSKUs);
    if (newExpanded.has(skuCode)) {
      newExpanded.delete(skuCode);
    } else {
      newExpanded.add(skuCode);
    }
    setExpandedSKUs(newExpanded);
  };

  const handleStockInput = (productCode: string, skuCode: string, value: string, currentStock: number) => {
    const key = `${productCode}-${skuCode}`;

    // Allow empty value (clearing the input)
    if (!value || value === '') {
      const newMap = new Map(stockInputs);
      newMap.delete(key);
      setStockInputs(newMap);
      return;
    }

    const numValue = parseFloat(value);

    // Validate: must be a valid number
    if (isNaN(numValue)) {
      showError('Please enter a valid number');
      return;
    }

    // Validate: cannot be negative
    if (numValue < 0) {
      showError('Stock cannot be negative');
      return;
    }

    // Validate: verified stock cannot exceed balance stock
    if (numValue > currentStock) {
      showError(`Verified stock (${numValue}) cannot exceed balance stock (${currentStock})`);
      return;
    }

    const newMap = new Map(stockInputs);
    newMap.set(key, value);
    setStockInputs(newMap);
  };

  const handleProceedToVerification = () => {
    if (stockInputs.size === 0) {
      showError('Please enter at least one stock value');
      return;
    }

    // VALIDATION: Collect all SKUs that have stock > 0
    const allActiveSKUs: Array<{ product: Product; sku: SKU; key: string }> = [];
    verificationProductData.forEach(product => {
      product.skus.forEach(sku => {
        if (sku.currentStock > 0) {
          const key = `${product.productCode}-${sku.skuCode}`;
          allActiveSKUs.push({ product, sku, key });
        }
      });
    });

    // Check which SKUs haven't been updated
    const missingUpdates: string[] = [];
    allActiveSKUs.forEach(({ product, sku, key }) => {
      const inputValue = stockInputs.get(key);
      if (!inputValue || inputValue.trim() === '') {
        missingUpdates.push(`${product.productName} - ${sku.skuName} (${sku.skuCode})`);
      }
    });

    // If any SKUs are missing updates, show detailed error
    if (missingUpdates.length > 0) {
      const title = missingUpdates.length === 1 ? 'Missing Stock Update' : 'Missing Stock Updates';
      const message = `Please update stock for the following ${missingUpdates.length === 1 ? 'product' : 'products'} before proceeding:\n\n${missingUpdates.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;
      showError(message, title);
      return;
    }

    // Collect SKUs that have actual changes
    const skusToProcess: Array<{ product: Product; sku: SKU; newStock: number }> = [];

    verificationProductData.forEach(product => {
      product.skus.forEach(sku => {
        const key = `${product.productCode}-${sku.skuCode}`;
        const inputValue = stockInputs.get(key);
        if (inputValue) {
          const newStock = parseInt(inputValue);
          if (!isNaN(newStock) && newStock !== sku.currentStock) {
            skusToProcess.push({ product, sku, newStock });
          }
        }
      });
    });

    if (skusToProcess.length === 0) {
      showWarning('No changes detected in stock values');
      return;
    }

    setAllSKUsToProcess(skusToProcess);

    // Initialize empty maps for each SKU
    const newFarmerQtyMap = new Map<string, string>();
    const newRetailersMap = new Map<string, Array<any>>();
    const newExpandedSet = new Set<string>();

    skusToProcess.forEach(item => {
      const key = `${item.product.productCode}-${item.sku.productCode}`;
      newFarmerQtyMap.set(key, '0');
      newRetailersMap.set(key, []);
      newExpandedSet.add(key);
    });

    setSkuFarmerQuantities(newFarmerQtyMap);
    setSkuRetailers(newRetailersMap);
    setExpandedSKUsInVerification(newExpandedSet);
    setVerificationStep(1);
    setShowTransactionSplitModal(true);
  };

  // Handle continuing from saved progress
  const handleContinueProgress = async () => {
    if (savedProgressData) {
      // First fetch fresh product data
      setCurrentDistributorId(distributorId);
      await fetchDistributorProducts();

      // Then restore all saved state
      setVerificationStep(savedProgressData.verificationStep);
      setAllSKUsToProcess(savedProgressData.allSKUsToProcess);
      setSkuFarmerQuantities(new Map(savedProgressData.skuFarmerQuantities));
      setSkuRetailers(new Map(savedProgressData.skuRetailers));
      setSignature(savedProgressData.signature || '');
      setUploadedProofs(savedProgressData.uploadedProofs || []);

      // Restore expanded SKUs in verification modal
      const expandedSet = new Set<string>();
      savedProgressData.allSKUsToProcess.forEach((item: any) => {
        const key = `${item.product.productCode}-${item.sku.skuCode}`;
        expandedSet.add(key);
      });
      setExpandedSKUsInVerification(expandedSet);

      // Close the continue modal and show the verification modal
      setShowContinueProgressModal(false);
      setShowTransactionSplitModal(true);
    }
  };

  // Handle starting fresh (cancel saved progress)
  const handleStartFresh = () => {
    clearVerificationProgress();
    setShowContinueProgressModal(false);
    setSavedProgressData(null);

    // Clear old data and fetch fresh
    setVerificationProductData([]);
    setStockInputs(new Map());
    setExpandedProducts(new Set());
    setExpandedSKUs(new Set());
    setAllSKUsToProcess([]);
    setSkuFarmerQuantities(new Map());
    setSkuRetailers(new Map());
    setUploadedProofs([]);
    setPhotosSaved(new Set());
    setSignature('');
    setCapturedMetadata(null);
    setVerificationStep(1);
    setShowTransactionSplitModal(false);

    fetchProductData(distributorId);
  };

  const handleConfirmSplit = async () => {
    try {
      // 1️⃣ Validate all SKUs have proper allocation
      let hasErrors = false;
      const errors: string[] = [];

      allSKUsToProcess.forEach(item => {
        const key = `${item.product.productCode}-${item.sku.skuCode}`;
        const difference = Math.abs(item.sku.currentStock - item.newStock);
        const farmerQty = parseInt(skuFarmerQuantities.get(key) || '0') || 0;
        const retailers = skuRetailers.get(key) || [];
        const actualRetailers = retailers.filter(r => r.id && r.id !== 'manual-entry');
        const retailerTotal = actualRetailers.reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0);
        const total = farmerQty + retailerTotal;
        console.log(skuRetailers)
        if (total !== difference) {
          hasErrors = true;
          errors.push(`${item.product.productName} - ${item.sku.skuCode}: Total ${total} doesn't match difference ${difference}`);
        }
      });

      if (hasErrors) {
        showError(`Please fix allocation errors:\n\n${errors.join('\n')}`);
        return;
      }

      if (!signature) {
        showError("E-signature is required to submit");
        return;
      }

      // 2️⃣ Upload signature if it’s a base64 data URL
      let signatureUrl = signature;
      if (signature.startsWith("data:image")) {
        const blob = await fetch(signature).then(res => res.blob());
        const file = new File([blob], `signature_${Date.now()}.png`, { type: "image/png" });
        const uploadRes = await uploadFile(file);
        if (uploadRes?.url) signatureUrl = uploadRes.url;
        else throw new Error("Failed to upload signature");
      }

      // 3️⃣ Collect all proof URLs
      const proofUrls = uploadedProofs.map(p => p.url).filter(Boolean);
      if (proofUrls.length === 0) return showError('Please upload at least one proof');

      // 4️⃣ Build API payload following `createLiquidationEntrySchema`
      // 4️⃣ Build API payload following `createLiquidationEntrySchema`
      const payload = {
        distributorCode,
        distributorName,
        productEntries: allSKUsToProcess.map(({ product, sku, newStock }) => {
          const key = `${product.productCode}-${sku.skuCode}`;
          const farmerQty = parseInt(skuFarmerQuantities.get(key) || '0') || 0;
          const currentRetailers = skuRetailers.get(key) || [];

          // Filter out manual entry AND any rows where retailer wasn't selected or quantity is invalid
          const validRetailerAllocations = currentRetailers
            .filter(r => r.id && r.id !== 'manual-entry' && r.quantity && parseInt(r.quantity) > 0)
            .map(r => ({
              retailerId: r.id,
              quantity: parseInt(r.quantity),
            }));

          return {
            productCode: sku.productCode, // Make sure this is the correct code your API expects
            currentStock: newStock, // Send the new stock level
            farmerQuantity: farmerQty,
            retailerAllocations: validRetailerAllocations,
          };
        }),// Or determine based on stock increase/decrease if needed
        signatureUrl: signatureUrl, // No longer optional if validation passes
        // retailerId: retailers?.[0]?._id || undefined, // Remove this top-level retailerId unless specifically required
        proofUrls: proofUrls, // Send proofs
      };

      console.log('Final Payload:', JSON.stringify(payload, null, 2)); // Use stringify for better readability
      // 5️⃣ Submit to backend via context API
      const success = await submitLiquidation(payload);

      if (success) {
        showSuccess("✅ Liquidation entry submitted successfully!", "Stock Verification Complete");

        // Clear saved progress after successful submission
        clearVerificationProgress();

        // 6️⃣ Update local UI data
        let updatedData = [...verificationProductData];
        allSKUsToProcess.forEach(item => {
          updatedData = updatedData.map(product => {
            if (product.productCode === item.product.productCode) {
              return {
                ...product,
                skus: product.skus.map(sku =>
                  sku.skuCode === item.sku.skuCode
                    ? { ...sku, currentStock: item.newStock }
                    : sku
                ),
              };
            }
            return product;
          });
        });
        setVerificationProductData(updatedData);

        // 7️⃣ Reset modal state and mark verification as complete
        setShowTransactionSplitModal(false);
        setSkuFarmerQuantities(new Map());
        setSkuRetailers(new Map());
        setExpandedSKUsInVerification(new Set());
        setUploadedProofs([]);
        setSignature('');
        setCapturedMetadata(null);
        setVerificationStep(1);

        // Mark verification as complete and switch to Submit Proof tab
        setIsVerificationComplete(true);
        setModalTab('verify');

        // Call onSuccess callback if provided (handles highlight and scroll)
        if (onSuccess) {
          onSuccess();
        } else {
          // Fallback to old behavior if onSuccess not provided
          onClose();

          // Scroll to and animate the updated distributor card
          setTimeout(() => {
            const cardElement = document.querySelector(`[data-distributor-id="${distributorId}"]`);
            if (cardElement) {
              cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

              // Add pulsing animation
              cardElement.classList.add('animate-pulse-ring');
              setTimeout(() => {
                cardElement.classList.remove('animate-pulse-ring');
              }, 3000);
            }
          }, 300);
        }
      } else {
        showError("❌ Failed to submit liquidation entry. Please try again.");
      }
    } catch (err: any) {
      console.error("Error confirming split:", err);
      showError(`Submission failed: ${err.message}`);
    }
  };


  const handleSelectRetailer = (skuKey: string, retailer: { id: string; code: string; name: string; phone: string; address: string }) => {
    const currentRetailers = skuRetailers.get(skuKey) || [];
    const newRetailersMap = new Map(skuRetailers);
    newRetailersMap.set(skuKey, [...currentRetailers, { ...retailer, quantity: '' }]);
    setSkuRetailers(newRetailersMap);
  };

  const handleAddNewRetailer = (skuKey: string) => {
    setCurrentSKUKeyForRetailerSelection(skuKey);
    setPrefilledRetailerName('');
    setShowAddRetailerModal(true);
  };

  const loadRetailerOptions = async (inputValue: string) => {
    try {
      console.log('[VerifyStockModal] Loading retailer options for:', inputValue);

      // Fetch retailers from database
      let query = supabase
        .from('outlets')
        .select('id, code, name, contact_person, phone, address')
        .eq('status', 'Active')
        .limit(50); // Limit to 50 results

      // If there's input, filter by name or code
      if (inputValue && inputValue.trim()) {
        query = query.or(`name.ilike.%${inputValue}%,code.ilike.%${inputValue}%,contact_person.ilike.%${inputValue}%`);
      }

      const { data: outlets, error } = await query;

      console.log('[VerifyStockModal] Fetched outlets:', outlets?.length, 'Error:', error);

      if (error) {
        console.error('Error fetching retailers:', error);
        return [];
      }

      if (!outlets || outlets.length === 0) {
        console.log('[VerifyStockModal] No outlets found in database');
        // If there's input but no matches, add a "Create new" option
        if (inputValue && inputValue.trim()) {
          return [{
            value: '__create_new__',
            label: `+ Create "${inputValue}"`,
            phone: '',
            code: '',
            address: '',
            isCreateNew: true,
            createName: inputValue,
            data: null,
          }];
        }
        return [];
      }

      // Map to the format required by react-select
      const options = outlets.map((outlet: any) => ({
        value: outlet.code,
        label: `${outlet.name}${outlet.code ? ` (${outlet.code})` : ''}`,
        phone: outlet.phone || '',
        code: outlet.code,
        address: outlet.address || '',
        data: {
          _id: outlet.code,
          name: outlet.name,
          code: outlet.code,
          phone: outlet.phone,
          address: outlet.address
        },
      }));

      console.log('[VerifyStockModal] Mapped options:', options.length);
      return options;
    } catch (error) {
      console.error('Error loading retailer options:', error);
      return [];
    }
  };

  const handleSaveNewRetailer = async (retailerData: NewRetailerData) => {
    console.log('Creating retailer with data:', retailerData);

    const newRetailer: IRetailer | null = await createRetailer({
      ...retailerData,
      _id: '', // Will be provided by the backend
      state: retailerData.state || '',
      region: (retailerData as any).region || '',
      territory: (retailerData as any).territory || '',
      zone: (retailerData as any).zone || '',
      pincode: retailerData.pincode || '',
      address: retailerData.address || ''
    });

    console.log('Created retailer response:', newRetailer);

    if (!newRetailer) {
      showError("Failed to create new retailer.");
      throw new Error("Failed to create new retailer.");
    }

    // Refresh the retailers list to ensure the new retailer appears in dropdowns
    await fetchRetailers();

    // Now, add this new retailer to the current SKU's list for allocation.
    if (currentSKUKeyForRetailerSelection) {
      const currentRetailers = skuRetailers.get(currentSKUKeyForRetailerSelection) || [];
      const newRetailersMap = new Map(skuRetailers);

      // Get the ID from the normalized retailer
      const retailerId = newRetailer.id || newRetailer._id;
      console.log('Retailer ID extracted:', retailerId, 'from retailer:', newRetailer);

      const formattedRetailer = {
        id: retailerId || '',
        code: (newRetailer as any).code || '',
        name: newRetailer.name,
        phone: (newRetailer as any).phone || retailerData.phone || '',
        address: newRetailer.address || retailerData.address || '',
        quantity: '' // Start with empty quantity
      };

      console.log('Formatted retailer:', formattedRetailer);

      // Only add if we have a valid ID
      if (formattedRetailer.id) {
        newRetailersMap.set(currentSKUKeyForRetailerSelection, [...currentRetailers, formattedRetailer]);
        setSkuRetailers(newRetailersMap);
        setCurrentSKUKeyForRetailerSelection('');
        showSuccess(`Retailer "${retailerData.name}" added successfully!`);
      } else {
        console.error('No valid ID found for retailer:', newRetailer);
        showError("Failed to get retailer ID. Please try selecting the retailer from the dropdown.");
        throw new Error("Failed to get retailer ID");
      }
    }
  };

  const handleRemoveRetailer = (skuKey: string, index: number) => {
    const currentRetailers = skuRetailers.get(skuKey) || [];
    const newRetailersMap = new Map(skuRetailers);
    newRetailersMap.set(skuKey, currentRetailers.filter((_, i) => i !== index));
    setSkuRetailers(newRetailersMap);
  };

  const handleRetailerQuantityChange = (skuKey: string, index: number, quantity: string) => {
    const currentRetailers = skuRetailers.get(skuKey) || [];
    const newRetailersMap = new Map(skuRetailers);
    newRetailersMap.set(skuKey, currentRetailers.map((r, i) => i === index ? { ...r, quantity } : r));
    setSkuRetailers(newRetailersMap);
  };


  const handleClickPicture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const uploadRes = await uploadFile(file);
        if (uploadRes?.url) {
          const newProof = {
            id: `photo_${Date.now()}`,
            type: 'photo',
            name: file.name,
            url: uploadRes.url,
            timestamp: new Date().toISOString(),
            metadata: {
              capturedAt: new Date().toLocaleString('en-IN'),
              userName: user?.name,
              designation: user?.role
            }
          };
          setUploadedProofs(prev => [...prev, newProof]);
          showSuccess("✅ Photo uploaded successfully");
        } else {
          showError("❌ Upload failed. Try again.");
        }
      }
    };
    input.click();
  };


  const handleDownloadVerificationDoc = () => {
    const currentDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stock Verification Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #1f2937; border-bottom: 3px solid #f97316; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .header-info { margin: 20px 0; }
    .header-info p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #d1d5db; padding: 12px; text-align: left; }
    th { background-color: #f3f4f6; font-weight: bold; }
    .outward { color: #16a34a; }
    .return { color: #2563eb; }
    .footer { margin-top: 40px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
    .signature { margin-top: 60px; }
  </style>
</head>
<body>
  <h1>Stock Verification Report</h1>

  <div class="header-info">
    <p><strong>Distributor Name:</strong> ${distributorName}</p>
    <p><strong>Distributor Code:</strong> ${distributorCode}</p>
    <p><strong>Verification Date:</strong> ${currentDate}</p>
    <p><strong>Verified By:</strong> ${user?.name || 'N/A'}</p>
  </div>

  <h2>Verified Products</h2>
  <table>
    <thead>
      <tr>
        <th>S.No</th>
        <th>Product Name</th>
        <th>SKU Name</th>
        <th>SKU Code</th>
        <th>Previous Stock</th>
        <th>New Stock</th>
        <th>Difference</th>
        <th>Type</th>
      </tr>
    </thead>
    <tbody>`;

    allSKUsToProcess.forEach((item, idx) => {
      const difference = Math.abs(item.sku.currentStock - item.newStock);
      const isDecrease = item.newStock < item.sku.currentStock;
      const type = isDecrease ? 'Outward' : 'Return';
      const typeClass = isDecrease ? 'outward' : 'return';

      htmlContent += `
      <tr>
        <td>${idx + 1}</td>
        <td style="text-transform: capitalize;">${item.product.productName}</td>
        <td>${item.sku.skuName}</td>
        <td>${item.sku.skuCode}</td>
        <td>${item.sku.currentStock} ${item.sku.unit}</td>
        <td>${item.newStock} ${item.sku.unit}</td>
        <td>${difference} ${item.sku.unit}</td>
        <td class="${typeClass}"><strong>${type}</strong></td>
      </tr>`;
    });

    htmlContent += `
    </tbody>
  </table>

  <div class="footer">
    <p><strong>Total Products Verified:</strong> ${allSKUsToProcess.length}</p>
    <p><strong>Report Generated:</strong> ${new Date().toLocaleString('en-IN')}</p>
  </div>

  <div class="signature">
    <p>_______________________</p>
    <p><strong>Authorized Signature</strong></p>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock_Verification_${distributorCode}_${new Date().toISOString().split('T')[0]}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showSuccess('Verification report downloaded successfully!');
  };

  const handleSubmitProof = () => {
    if (uploadedProofs.length === 0) {
      showError('Please upload at least one proof');
      return;
    }
    showSuccess(`Verification submitted with ${uploadedProofs.length} proof(s)!`);
    onClose();
  };

  // const totalValue = verificationProductData.reduce((sum, product) => {
  //   return sum + product.skus.reduce((skuSum, sku) => skuSum + (sku.currentStock * sku.unitPrice), 0);
  // }, 0);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
        <div className="bg-white w-full h-full sm:h-auto sm:rounded-lg sm:shadow-2xl sm:max-w-6xl sm:max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex-shrink-0 sticky top-0 z-10 bg-white">
            {/* Compact Header - Single Row */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Title and Distributor Info */}
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900 whitespace-nowrap">Verify Stock</h2>
                  <div className="h-8 w-px bg-gray-300 hidden sm:block"></div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    <span className="text-sm sm:text-lg font-bold text-gray-900 truncate capitalize">{distributorName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600 flex-shrink-0">
                    <Hash className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Code: {distributorCode}</span>
                  </div>
                </div>

                {/* Right: Total Balance and Close */}
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xl sm:text-3xl font-bold text-orange-600">
                      {!isDataReady ? (
                        <InlineLoader />
                      ) : (
                        <>{formatCurrency(displayValue)}</>
                      )}
                    </div>
                    <div className="text-xs text-orange-600 font-medium whitespace-nowrap">Total Balance Stock</div>
                  </div>
                  <button
                    onClick={() => {
                      saveVerificationProgress();
                      onClose();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* SKU WISE VERIFY Tab */}
            <div className="border-b border-gray-200 px-4 sm:px-6">
              <div className="border-b-2 border-orange-500 inline-block">
                <div className="px-4 py-2 sm:py-3 font-bold text-sm text-gray-900">
                  SKU WISE VERIFY
                </div>
              </div>
            </div>

          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
            <>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Product & SKU Breakdown</h3>

                {/* Flat Table View - All Products & SKUs */}
                <div className="overflow-x-auto -mx-2 sm:-mx-4">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden border border-gray-200 rounded-md sm:rounded-lg">
                      {(() => {
                        // Show loading skeleton while fetching data
                        if (!isDataReady) {
                          return (
                            <div className="p-6 space-y-3 animate-fade-in">
                              <LoadingSkeleton type="card" />
                              <LoadingSkeleton type="card" />
                              <LoadingSkeleton type="card" />
                            </div>
                          );
                        }

                        // Check if there's any product with stock > 0
                        const hasData = verificationProductData?.some(product =>
                          product.skus.some(sku => sku.currentStock > 0)
                        );

                        // Show fallback if no valid stock data
                        if (!hasData) {
                          return (
                            <div className="flex flex-col items-center justify-center py-10 text-center text-gray-500">
                              <div className="text-3xl mb-2">📦</div>
                              <p className="text-sm sm:text-base font-medium">No data found</p>
                              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                                There are no product stock records available.
                              </p>
                            </div>
                          );
                        }

                        // Flatten all SKUs into a single array
                        const allSKUs: Array<{ product: Product; sku: SKU }> = [];
                        verificationProductData?.forEach((product) => {
                          product.skus.forEach((sku) => {
                            if (sku.currentStock > 0) {
                              allSKUs.push({ product, sku });
                            }
                          });
                        });

                        return (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="min-w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase border-b border-gray-300">
                                    <span className="hidden sm:inline">PRODUCT</span>
                                    <span className="sm:hidden">PRODUCT</span>
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase border-b border-gray-300">
                                    <span className="hidden sm:inline">SKU</span>
                                    <span className="sm:hidden">SKU</span>
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase border-b border-gray-300">
                                    <span className="hidden sm:inline">CURRENT STOCK<br/>(last visit updated)</span>
                                    <span className="sm:hidden">CURRENT</span>
                                  </th>
                                  <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-bold text-gray-700 uppercase border-b border-gray-300">
                                    <span className="hidden sm:inline">UPDATE STOCK<br/>(enter in Cases/Bags)</span>
                                    <span className="sm:hidden">UPDATE</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {allSKUs.map(({ product, sku }, index) => {
                                  const skuValue = sku.currentStock * sku.unitPrice;
                                  const key = `${product.productCode}-${sku.skuCode}`;
                                  const displayStock = convertToMainUnit(sku.currentStock, sku.unit);

                                  return (
                                    <tr key={key} className={index % 2 === 0 ? 'bg-yellow-100' : 'bg-blue-100'}>
                                      <td className="px-2 sm:px-6 py-2 sm:py-3 max-w-[140px] sm:max-w-none">
                                        <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                          {product.productName}
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">{product.productCode}</div>
                                      </td>
                                      <td className="px-2 sm:px-6 py-2 sm:py-3 max-w-[100px] sm:max-w-none">
                                        <div className="text-[10px] sm:text-xs font-medium text-gray-900 truncate">{sku.skuName}</div>
                                        <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5">({displayStock.unit})</div>
                                      </td>
                                      <td className="px-2 sm:px-6 py-2 sm:py-3 whitespace-nowrap">
                                        <div className="text-sm sm:text-base font-bold text-gray-900">
                                          {displayStock.value.toFixed(0)} <span className="text-[10px] sm:text-xs font-normal text-gray-600">{displayStock.unit}</span>
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-gray-500">
                                          {formatCurrency(skuValue)}
                                        </div>
                                      </td>
                                      <td className="px-2 sm:px-6 py-2 sm:py-3">
                                        <input
                                          type="number"
                                          step="1"
                                          min="0"
                                          placeholder="0"
                                          className="w-16 sm:w-32 px-1.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                          onChange={(e) => handleStockInput(product.productCode, sku.skuCode, e.target.value, sku.currentStock)}
                                          value={stockInputs.get(key) || ''}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Footer Info - Hidden on mobile as it's in header */}
                <div className="mt-3 text-xs text-gray-500 bg-orange-50 border border-orange-200 rounded-lg p-2 sm:p-3 hidden sm:block">
                  <strong className="text-orange-900">{allSKUsToProcess.length > 0 ? allSKUsToProcess.length : stockInputs.size} SKU(s)</strong> ready for verification
                </div>

              </>
          </div>

          {(
            <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm sm:text-base font-bold text-orange-600">
                  {stockInputs.size > 0 ? (
                    <>{stockInputs.size} SKU(S) Ready For Verification</>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Enter stock values above to proceed</span>
                      <span className="sm:hidden">Enter values to proceed</span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleProceedToVerification}
                  disabled={stockInputs.size === 0}
                  className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-bold transition-colors ${stockInputs.size > 0
                    ? 'bg-orange-600 text-white hover:bg-orange-700 cursor-pointer'
                    : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    }`}
                >
                  <span className="hidden sm:inline">Proceed to Verification ({stockInputs.size})</span>
                  <span className="sm:hidden">Proceed ({stockInputs.size})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showTransactionSplitModal && allSKUsToProcess.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    {verificationStep === 1 ? (
                      <span className="flex items-center gap-2">
                        <span>Verify Stock Changes</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-blue-700">Verification</span>
                      </span>
                    ) : verificationStep === 2 ? (
                      <span className="flex items-center gap-2">
                        <span>Verify Stock Changes</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-yellow-700">Stock Allocation</span>
                      </span>
                    ) : verificationStep === 3 ? (
                      <span className="flex items-center gap-2">
                        <span>Verify Stock Changes</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-blue-700">Step 3: E-Sign</span>
                      </span>
                    ) : verificationStep === 4 ? (
                      <span className="flex items-center gap-2">
                        <span>Verify Stock Changes</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-amber-700">Step 4: Capture Proof Photo</span>
                      </span>
                    ) : (
                      'Verify Stock Changes'
                    )}
                  </h3>
                  <p className="text-sm mt-0.5">
                    {verificationStep === 1 ? (
                      <span className="text-blue-600">Review stock changes for all SKUs below.</span>
                    ) : verificationStep === 2 ? (
                      <span className="text-yellow-700">Allocate liquidated stock to farmers or retailers. Leave blank to skip.</span>
                    ) : verificationStep === 3 ? (
                      <span className="text-blue-600">Provide your electronic signature to authenticate this stock verification.</span>
                    ) : verificationStep === 4 ? (
                      <span className="text-amber-700">Capture a photo as proof of verification.</span>
                    ) : allSKUsToProcess.length > 1 ? (
                      <span className="text-gray-600">Verifying {allSKUsToProcess.length} SKUs</span>
                    ) : (
                      <span className="text-gray-600">Verifying 1 SKU</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTransactionSplitModal(false);
                    setAllSKUsToProcess([]);
                    setSkuFarmerQuantities(new Map());
                    setSkuRetailers(new Map());
                    setExpandedSKUsInVerification(new Set());
                    setPhotosSaved(new Set());
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-center space-x-2">
                <div className="flex items-center space-x-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${verificationStep === 1 ? 'bg-blue-600 text-white' : verificationStep > 1 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>1</div>
                  <span className={`text-xs ${verificationStep === 1 ? 'font-semibold text-gray-900' : verificationStep > 1 ? 'text-green-600' : 'text-gray-400'}`}>Verification</span>
                </div>
                <div className="h-px w-4 bg-gray-300"></div>
                <div className="flex items-center space-x-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${verificationStep === 2 ? 'bg-blue-600 text-white' : verificationStep > 2 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>2</div>
                  <span className={`text-xs ${verificationStep === 2 ? 'font-semibold text-gray-900' : verificationStep > 2 ? 'text-green-600' : 'text-gray-400'}`}>Stock Allocation</span>
                </div>
                <div className="h-px w-4 bg-gray-300"></div>
                <div className="flex items-center space-x-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${verificationStep === 3 ? 'bg-blue-600 text-white' : verificationStep > 3 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>3</div>
                  <span className={`text-xs ${verificationStep === 3 ? 'font-semibold text-gray-900' : verificationStep > 3 ? 'text-green-600' : 'text-gray-400'}`}>E-Sign</span>
                </div>
                <div className="h-px w-4 bg-gray-300"></div>
                <div className="flex items-center space-x-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${verificationStep === 4 ? 'bg-blue-600 text-white' : verificationStep > 4 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>4</div>
                  <span className={`text-xs ${verificationStep === 4 ? 'font-semibold text-gray-900' : verificationStep > 4 ? 'text-green-600' : 'text-gray-400'}`}>Pic-Verify</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {(() => {
                const item = allSKUsToProcess[0];
                if (!item) return null;

                const key = `${item.product.productCode}-${item.sku.skuCode}`;
                const farmerQuantity = parseInt(skuFarmerQuantities.get(key) || '0') || 0;
                const retailers = skuRetailers.get(key) || [];
                const retailerTotal = retailers.reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0);
                const selectedSKUForUpdate = {
                  productName: item.product.productName,
                  productCode: item.product.productCode,
                  sku: item.sku
                };
                const newStockValue = item.newStock;
                const stockDifference = item.sku.currentStock - item.newStock;

                return (
                  <>
                    {verificationStep === 1 && (
                      <div className="space-y-3">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Product / SKU</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Last Visit Stock</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Current</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Liquidated</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {allSKUsToProcess.map((itemMap, idx) => {
                                const keyMap = `${itemMap.product.productCode}-${itemMap.sku.skuCode}`;
                                const difference = Math.abs(itemMap.sku.currentStock - itemMap.newStock);
                                const displayCurrent = convertToMainUnit(itemMap.sku.currentStock, itemMap.sku.unit);
                                const displayNew = convertToMainUnit(itemMap.newStock, itemMap.sku.unit);
                                const displayDiff = convertToMainUnit(difference, itemMap.sku.unit);

                                return (
                                  <tr key={keyMap} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-2">
                                      <div className="text-sm font-medium text-gray-900">{itemMap.product.productName}</div>
                                      <div className="text-xs text-gray-500">{itemMap.sku.skuName} • {itemMap.sku.skuCode}</div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <div className="text-sm font-bold text-gray-900">{displayCurrent.value.toFixed(2)}</div>
                                      <div className="text-xs text-gray-500">{displayCurrent.unit}</div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <div className="text-sm font-bold text-green-600">{displayNew.value.toFixed(2)}</div>
                                      <div className="text-xs text-gray-500">{displayNew.unit}</div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <div className="text-sm font-bold text-green-600">{displayDiff.value.toFixed(2)}</div>
                                      <div className="text-xs text-gray-500">{displayDiff.unit}</div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {verificationStep === 2 && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          {allSKUsToProcess.map((itemMap, idx) => {
                            const keyMap = `${itemMap.product.productCode}-${itemMap.sku.skuCode}`;
                            const difference = Math.abs(itemMap.sku.currentStock - itemMap.newStock);
                            const farmerQty = parseFloat(skuFarmerQuantities.get(keyMap) || '0') || 0;
                            const retailersMap = skuRetailers.get(keyMap) || [];
                            const retailerTotal = retailersMap.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                            const total = farmerQty + retailerTotal;
                            const displayDiff = convertToMainUnit(difference, itemMap.sku.unit);
                            const isFullyAllocated = Math.abs(total - difference) < 0.01 && total > 0;

                            return (
                              <div
                                key={keyMap}
                                data-sku-key={keyMap}
                                className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border border-gray-200 rounded-lg p-3`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <h5 className="font-semibold text-gray-900 text-sm">{itemMap.product.productName}</h5>
                                    <p className="text-xs text-gray-600">{itemMap.sku.skuName} • {itemMap.sku.skuCode}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-green-600 font-medium">Total: {displayDiff.value.toFixed(2)} {displayDiff.unit} (Decrease)</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                      Farmer Allocation
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="Enter Farmer Quantity"
                                      value={skuFarmerQuantities.get(keyMap) || ''}
                                      onChange={(e) => {
                                        const newMap = new Map(skuFarmerQuantities);
                                        newMap.set(keyMap, e.target.value);
                                        setSkuFarmerQuantities(newMap);
                                      }}
                                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    {farmerQty > 0 && farmerQty < difference && (
                                      <div className="mt-1.5 flex items-center gap-1 text-xs text-orange-600">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span>Remaining: {(difference - farmerQty - retailerTotal).toFixed(2)} {itemMap.sku.unit}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <label className="block text-sm font-medium text-gray-700">
                                        Retailer Allocations
                                      </label>
                                      <button
                                        onClick={() => handleAddNewRetailer(keyMap)}
                                        className="px-2.5 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                      >
                                        + Add New Retailer
                                      </button>
                                    </div>

                                    <AsyncSelect
                                      cacheOptions
                                      defaultOptions
                                      value={null}
                                      loadOptions={loadRetailerOptions}
                                      noOptionsMessage={() => "No options"}
                                      onChange={(selectedOption: any) => {
                                        if (selectedOption) {
                                          if (selectedOption.isCreateNew) {
                                            setPrefilledRetailerName(selectedOption.createName);
                                            setCurrentSKUKeyForRetailerSelection(keyMap);
                                            setShowAddRetailerModal(true);
                                            return;
                                          }

                                          const existingRetailers = skuRetailers.get(keyMap) || [];
                                          const isDuplicate = existingRetailers.some(r => r.phone === selectedOption.phone);

                                          if (isDuplicate) {
                                            alert('This retailer has already been added to this SKU');
                                            return;
                                          }

                                          const newRetailersMap = new Map(skuRetailers);
                                          newRetailersMap.set(keyMap, [
                                            ...existingRetailers,
                                            {
                                              id: selectedOption.value,
                                              code: selectedOption.code,
                                              name: selectedOption.label,
                                              phone: selectedOption.phone || '',
                                              address: selectedOption.address || '',
                                              quantity: ''
                                            }
                                          ]);
                                          setSkuRetailers(newRetailersMap);
                                        }
                                      }}
                                      placeholder="Search Or Add..."
                                      styles={{
                                        control: (base) => ({
                                          ...base,
                                          minHeight: '32px',
                                          fontSize: '0.875rem'
                                        }),
                                        menu: (base) => ({
                                          ...base,
                                          fontSize: '0.875rem',
                                          zIndex: 9999
                                        })
                                      }}
                                    />

                                    {retailersMap.length > 0 && (
                                      <div className="mt-2 space-y-1.5">
                                        {retailersMap.map((retailer, rIdx) => (
                                          <div key={rIdx} className="flex gap-1.5 items-center bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm font-medium text-gray-900">{retailer.name}</div>
                                              {retailer.phone && (
                                                <div className="text-xs text-gray-500">{retailer.phone}</div>
                                              )}
                                            </div>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              placeholder="0"
                                              value={retailer.quantity || ''}
                                              onChange={(e) => {
                                                const newRetailersMap = new Map(skuRetailers);
                                                const updatedRetailers = [...retailersMap];
                                                updatedRetailers[rIdx] = { ...retailer, quantity: e.target.value };
                                                newRetailersMap.set(keyMap, updatedRetailers);
                                                setSkuRetailers(newRetailersMap);
                                              }}
                                              className="w-20 px-2 py-1 text-sm border rounded text-center flex-shrink-0"
                                            />
                                            <button
                                              onClick={() => {
                                                const newRetailersMap = new Map(skuRetailers);
                                                const updatedRetailers = retailersMap.filter((_, i) => i !== rIdx);
                                                newRetailersMap.set(keyMap, updatedRetailers);
                                                setSkuRetailers(newRetailersMap);
                                              }}
                                              className="px-1.5 text-red-600 hover:text-red-800 flex-shrink-0 text-lg"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {retailerTotal > 0 && retailerTotal < difference && (
                                      <div className="mt-1.5 flex items-center gap-1 text-xs text-orange-600">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span>Remaining: {(difference - farmerQty - retailerTotal).toFixed(2)} {itemMap.sku.unit}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    )}


                    {verificationStep === 3 && (() => {
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

                            if (!capturedMetadata) {
                              const now = new Date();
                              setCapturedMetadata({
                                user: user?.name || 'Unknown User',
                                timestamp: now.toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                }),
                                location: '19.092350, 73.075933'
                              });
                            }
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

                      const hasRetailers = retailerTotal > 0;

                      const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        for (const file of Array.from(files)) {
                          const uploadRes = await uploadFile(file);
                          if (uploadRes?.url) {
                            setUploadedProofs(prev => [
                              ...prev,
                              {
                                id: `file_${Date.now()}`,
                                name: file.name,
                                type: file.type.startsWith("image") ? "photo" : "file",
                                url: uploadRes.url,
                                timestamp: new Date().toISOString(),
                              },
                            ]);
                            showSuccess(`${file.name} uploaded successfully`);
                          } else {
                            showError(`Failed to upload ${file.name}`);
                          }
                        }
                      };


                      const handleCapturePhoto = async () => {
                        try {
                          // Get current location
                          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                              enableHighAccuracy: true,
                              timeout: 10000,
                              maximumAge: 0
                            });
                          });

                          const latitude = position.coords.latitude;
                          const longitude = position.coords.longitude;
                          const locationString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

                          // Capture photo using device camera
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.capture = 'environment';

                          input.onchange = async (e: any) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const timestamp = new Date();
                            const dateTimeString = timestamp.toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            });

                            // Upload the file
                            const uploadRes = await uploadFile(file);
                            if (uploadRes?.url) {
                              const photoData = {
                                id: `photo_${Date.now()}`,
                                name: file.name,
                                type: 'photo',
                                url: uploadRes.url,
                                timestamp: timestamp.toISOString(),
                                metadata: {
                                  employee: user?.name || 'Unknown',
                                  designation: user?.role || 'Unknown',
                                  location: locationString,
                                  dateTime: dateTimeString,
                                  latitude,
                                  longitude
                                }
                              };

                              setUploadedProofs([...uploadedProofs, photoData]);
                              showSuccess(`Photo captured with location and timestamp`);
                            } else {
                              showError('Failed to upload photo');
                            }
                          };

                          input.click();
                        } catch (error: any) {
                          if (error.code === 1) {
                            showError('Location permission denied. Please enable location access to capture photo.');
                          } else {
                            showError('Failed to get location. Please ensure location services are enabled.');
                          }
                        }
                      };

                      const generateDraftLetter = async () => {
                        const now = new Date();
                        const dateStr = now.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });
                        const timeStr = now.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        });

                        const doc = new Document({
                          sections: [
                            {
                              properties: {},
                              children: [
                                new Paragraph({
                                  text: "Stock Verification and Update Confirmation",
                                  heading: HeadingLevel.TITLE,
                                  alignment: "center",
                                }),
                                new Paragraph({
                                  text: `Date: ${dateStr}  |  Time: ${timeStr}`,
                                  spacing: { after: 300 },
                                }),
                                new Paragraph({
                                  children: [
                                    new TextRun({ text: `Distributor Name: ${distributorName}`, bold: true }),
                                    new TextRun({ text: `\nDistributor Code: ${distributorCode}` }),
                                    new TextRun({ text: `\nSales Representative: ${salesStaffName}` }),
                                    new TextRun({ text: `\nVerification Conducted On: ${dateStr} ${timeStr}` }),
                                  ],
                                  spacing: { after: 300 },
                                }),

                                new Paragraph({
                                  text: "The following products were verified and confirmed:",
                                  spacing: { after: 200 },
                                }),

                                // Loop through all SKUs and retailer allocations
                                ...allSKUsToProcess.flatMap(({ product, sku, newStock }) => {
                                  const key = `${product.productCode}-${sku.skuCode}`;
                                  const difference = Math.abs(sku.currentStock - newStock);
                                  const isDecrease = newStock < sku.currentStock ? "Outward" : "Return";
                                  const farmerQty = parseInt(skuFarmerQuantities.get(key) || "0") || 0;
                                  const retailers = skuRetailers.get(key) || [];

                                  const retailerDetails =
                                    retailers.length > 0
                                      ? retailers
                                        .filter((r) => r.id !== "manual-entry")
                                        .map(
                                          (r, idx) =>
                                            `${idx + 1}. ${r.name} (${r.code || "N/A"}) - ${r.quantity} ${sku.unit}`
                                        )
                                        .join("\n")
                                      : "No retailer allocations.";

                                  return [
                                    new Paragraph({
                                      text: `${product.productName} (${product.productCode})`,
                                      heading: HeadingLevel.HEADING_2,
                                    }),
                                    new Paragraph({
                                      children: [
                                        new TextRun(`SKU: ${sku.skuName} (${sku.skuCode})`),
                                        new TextRun(
                                          `\nPrevious Stock: ${sku.currentStock} ${sku.unit}`
                                        ),
                                        new TextRun(`\nNew Stock: ${newStock} ${sku.unit}`),
                                        new TextRun(`\nDifference: ${difference} ${sku.unit} (${isDecrease})`),
                                        new TextRun(`\nSold to Farmers: ${farmerQty} ${sku.unit}`),
                                        new TextRun(`\nRetailer Allocations:\n${retailerDetails}`),
                                      ],
                                      spacing: { after: 300 },
                                    }),
                                  ];
                                }),

                                new Paragraph({
                                  text: "Verification Summary",
                                  heading: HeadingLevel.HEADING_2,
                                }),
                                new Paragraph({
                                  text: `Verified By: ${user?.name || "N/A"}`,
                                }),
                                new Paragraph({
                                  text: `Location: ${capturedMetadata?.location || "Not captured"}`,
                                }),
                                new Paragraph({
                                  text: `Timestamp: ${capturedMetadata?.timestamp || new Date().toLocaleString("en-IN")}`,
                                }),
                                new Paragraph({
                                  text: "\n\nWe hereby confirm that the above information is true and accurate to the best of our knowledge.\n\n",
                                }),
                                new Paragraph({
                                  text: "Signature:",
                                }),
                                new Paragraph({
                                  text: "____________________________",
                                }),
                                new Paragraph({
                                  text: `${distributorName} (${distributorCode})`,
                                }),
                              ],
                            },
                          ],
                        });

                        const blob = await Packer.toBlob(doc);
                        const filename = `Stock_Verification_${distributorCode}_${new Date().toISOString().split("T")[0]}.docx`;
                        saveAs(blob, filename);

                        showSuccess("Draft Letter downloaded successfully!");

                        // Save a temporary blob URL for sharing
                        const fileURL = URL.createObjectURL(blob);
                        setGeneratedDocLink(fileURL);
                      };


                      return (
                        <div className="space-y-6">
                          <div className="max-w-2xl mx-auto">
                            <h4 className="font-semibold text-gray-900 mb-4">
                              E-Sign <span className="text-red-600">(required)</span>
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
                              Draw signature above, it will be auto-saved & uploaded.
                            </p>

                            <button
                              onClick={clearSignature}
                              className="w-full mt-3 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Clear
                            </button>

                            {capturedMetadata && (
                              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs">
                                <p className="font-semibold text-gray-700 mb-2">Captured metadata:</p>
                                <p className="text-gray-600"><span className="font-medium">User:</span> {capturedMetadata.user}</p>
                                <p className="text-gray-600"><span className="font-medium">At:</span> {capturedMetadata.timestamp}</p>
                                <p className="text-gray-600"><span className="font-medium">Location:</span> {capturedMetadata.location}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {verificationStep === 4 && (() => {
                      console.log('📸 Rendering Step 4 - Pic Verify');
                      const hasRetailers = retailerTotal > 0;

                      const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        for (const file of Array.from(files)) {
                          const uploadRes = await uploadFile(file);
                          if (uploadRes?.url) {
                            setUploadedProofs(prev => [
                              ...prev,
                              {
                                id: `file_${Date.now()}`,
                                name: file.name,
                                type: file.type.startsWith("image") ? "photo" : "file",
                                url: uploadRes.url,
                                timestamp: new Date().toISOString(),
                              },
                            ]);
                            showSuccess(`${file.name} uploaded successfully`);
                          } else {
                            showError(`Failed to upload ${file.name}`);
                          }
                        }
                      };

                      const handleCapturePhoto = async () => {
                        try {
                          // Get current location
                          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                              enableHighAccuracy: true,
                              timeout: 10000,
                              maximumAge: 0
                            });
                          });

                          const latitude = position.coords.latitude;
                          const longitude = position.coords.longitude;
                          const locationString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

                          // Capture photo using device camera
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.capture = 'environment';

                          input.onchange = async (e: any) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const timestamp = new Date();
                            const dateTimeString = timestamp.toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            });

                            // Upload the file
                            const uploadRes = await uploadFile(file);
                            if (uploadRes?.url) {
                              const photoData = {
                                id: `photo_${Date.now()}`,
                                name: file.name,
                                type: 'photo',
                                url: uploadRes.url,
                                timestamp: timestamp.toISOString(),
                                metadata: {
                                  employee: user?.name || 'Unknown',
                                  designation: user?.role || 'Unknown',
                                  location: locationString,
                                  dateTime: dateTimeString,
                                  latitude,
                                  longitude
                                }
                              };

                              setUploadedProofs([...uploadedProofs, photoData]);
                              showSuccess(`Photo captured with location and timestamp`);
                            } else {
                              showError('Failed to upload photo');
                            }
                          };

                          input.click();
                        } catch (error: any) {
                          if (error.code === 1) {
                            showError('Location permission denied. Please enable location access to capture photo.');
                          } else {
                            showError('Failed to get location. Please ensure location services are enabled.');
                          }
                        }
                      };

                      const generateDraftLetter = async () => {
                        const now = new Date();
                        const dateStr = now.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });
                        const timeStr = now.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        });

                        const doc = new Document({
                          sections: [
                            {
                              properties: {},
                              children: [
                                new Paragraph({
                                  text: "Stock Verification and Update Confirmation",
                                  heading: HeadingLevel.TITLE,
                                  alignment: "center",
                                }),
                                new Paragraph({
                                  text: `Date: ${dateStr}  |  Time: ${timeStr}`,
                                  spacing: { after: 300 },
                                }),
                                new Paragraph({
                                  children: [
                                    new TextRun({ text: `Distributor Name: ${distributorName}`, bold: true }),
                                    new TextRun({ text: `\nDistributor Code: ${distributorCode}` }),
                                    new TextRun({ text: `\nSales Representative: ${salesStaffName}` }),
                                    new TextRun({ text: `\nVerification Conducted On: ${dateStr} ${timeStr}` }),
                                  ],
                                  spacing: { after: 300 },
                                }),

                                new Paragraph({
                                  text: "The following products were verified and confirmed:",
                                  spacing: { after: 200 },
                                }),

                                ...allSKUsToProcess.flatMap(({ product, sku, newStock }) => {
                                  const key = `${product.productCode}-${sku.skuCode}`;
                                  const difference = Math.abs(sku.currentStock - newStock);
                                  const isDecrease = newStock < sku.currentStock ? "Outward" : "Return";
                                  const farmerQty = parseInt(skuFarmerQuantities.get(key) || "0") || 0;
                                  const retailers = skuRetailers.get(key) || [];

                                  const retailerDetails =
                                    retailers.length > 0
                                      ? retailers
                                        .filter((r) => r.id !== "manual-entry")
                                        .map(
                                          (r, idx) =>
                                            `${idx + 1}. ${r.name} (${r.code || "N/A"}) - ${r.quantity} ${sku.unit}`
                                        )
                                        .join("\n")
                                      : "No retailer allocations.";

                                  return [
                                    new Paragraph({
                                      text: `${product.productName} (${product.productCode})`,
                                      heading: HeadingLevel.HEADING_2,
                                    }),
                                    new Paragraph({
                                      children: [
                                        new TextRun(`SKU: ${sku.skuName} (${sku.skuCode})`),
                                        new TextRun(
                                          `\nPrevious Stock: ${sku.currentStock} ${sku.unit}`
                                        ),
                                        new TextRun(`\nNew Stock: ${newStock} ${sku.unit}`),
                                        new TextRun(`\nDifference: ${difference} ${sku.unit} (${isDecrease})`),
                                        new TextRun(`\nSold to Farmers: ${farmerQty} ${sku.unit}`),
                                        new TextRun(`\nRetailer Allocations:\n${retailerDetails}`),
                                      ],
                                      spacing: { after: 300 },
                                    }),
                                  ];
                                }),

                                new Paragraph({
                                  text: "Verification Summary",
                                  heading: HeadingLevel.HEADING_2,
                                }),
                                new Paragraph({
                                  text: `Verified By: ${user?.name || "N/A"}`,
                                }),
                                new Paragraph({
                                  text: `Location: ${capturedMetadata?.location || "Not captured"}`,
                                }),
                                new Paragraph({
                                  text: `Timestamp: ${capturedMetadata?.timestamp || new Date().toLocaleString("en-IN")}`,
                                }),
                                new Paragraph({
                                  text: "\n\nWe hereby confirm that the above information is true and accurate to the best of our knowledge.\n\n",
                                }),
                                new Paragraph({
                                  text: "Signature:",
                                }),
                                new Paragraph({
                                  text: "____________________________",
                                }),
                                new Paragraph({
                                  text: `${distributorName} (${distributorCode})`,
                                }),
                              ],
                            },
                          ],
                        });

                        const blob = await Packer.toBlob(doc);
                        const filename = `Stock_Verification_${distributorCode}_${new Date().toISOString().split("T")[0]}.docx`;
                        saveAs(blob, filename);

                        showSuccess("Draft Letter downloaded successfully!");

                        const fileURL = URL.createObjectURL(blob);
                        setGeneratedDocLink(fileURL);
                      };

                      return (
                        <div className="space-y-3 md:space-y-4">
                          {/* Camera button - clean and simple */}
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 bg-white">
                            <div className="flex flex-col items-center justify-center text-center space-y-3 md:space-y-4">
                              <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200 flex items-center justify-center">
                                <Camera className="w-10 h-10 md:w-14 md:h-14 text-green-600" />
                              </div>
                              <div>
                                <p className="text-base md:text-lg font-bold text-gray-800 mb-1">Capture Proof Photo</p>
                                <p className="text-sm md:text-base text-gray-600">Take a photo to verify the transaction</p>
                              </div>
                              <button
                                onClick={() => setShowCameraModal(true)}
                                className="w-full md:w-auto px-8 md:px-10 py-3 md:py-3.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold text-base md:text-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                              >
                                <Camera className="w-5 h-5 md:w-6 md:h-6" />
                                Click Picture
                              </button>
                            </div>
                          </div>

                          {uploadedProofs.length > 0 && (
                            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                              <div className="flex items-center gap-3 text-green-700">
                                <CheckCircle className="w-6 h-6" />
                                <div>
                                  <p className="font-bold text-base">
                                    {uploadedProofs.length} photo{uploadedProofs.length > 1 ? 's' : ''} captured successfully
                                  </p>
                                  <p className="text-sm text-green-600 mt-0.5">
                                    Photos will be submitted with the verification
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })()}

                  </>
                );
              })()}
            </div>

            <div className="p-6 border-t border-gray-200 flex-shrink-0">
              <div className="flex justify-end space-x-3">
                {verificationStep > 1 && verificationStep < 5 && (
                  <button
                    onClick={() => setVerificationStep(verificationStep - 1)}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Back
                  </button>
                )}
                {verificationStep === 1 && (
                  <button
                    onClick={() => {
                      clearVerificationProgress();
                      setShowTransactionSplitModal(false);
                      setAllSKUsToProcess([]);
                      setSkuFarmerQuantities(new Map());
                      setSkuRetailers(new Map());
                      setExpandedSKUsInVerification(new Set());
                      setPhotosSaved(new Set());
                      setVerificationStep(1);
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                )}
                {verificationStep < 4 ? (
                  <button
                    onClick={() => {
                      if (verificationStep === 1) {
                        // Step 1: Just move to allocation step, no validation needed
                        setVerificationStep(2);
                        return;
                      }

                      if (verificationStep === 2) {
                        // Step 2: Validate all SKUs have proper allocation
                        let hasErrors = false;
                        const errors: string[] = [];
                        let unallocatedCount = 0;
                        let firstErrorKey: string | null = null;

                        allSKUsToProcess.forEach(item => {
                          const key = `${item.product.productCode}-${item.sku.skuCode}`;
                          const difference = Math.abs(item.sku.currentStock - item.newStock);
                          const farmerQty = parseInt(skuFarmerQuantities.get(key) || '0') || 0;
                          const retailers = skuRetailers.get(key) || [];
                          // Exclude manual-entry from retailer total calculation
                          const actualRetailers = retailers.filter(r => r.id !== 'manual-entry');
                          const retailerTotal = actualRetailers.reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0);
                          const total = farmerQty + retailerTotal;

                          if (total !== difference) {
                            if (!hasErrors) {
                              firstErrorKey = key;
                            }
                            hasErrors = true;
                            unallocatedCount++;
                            const remaining = difference - total;
                            if (remaining > 0) {
                              errors.push(`${item.product.productName} (${item.sku.skuCode}): Need ${remaining} ${item.sku.unit} more`);
                            } else {
                              errors.push(`${item.product.productName} (${item.sku.skuCode}): Over-allocated by ${Math.abs(remaining)} ${item.sku.unit}`);
                            }
                          }

                          // Validate retailer selections have quantities (exclude manual-entry)
                          actualRetailers.forEach((retailer, idx) => {
                            if (!retailer.id || retailer.id === '') {
                              if (!hasErrors) {
                                firstErrorKey = key;
                              }
                              hasErrors = true;
                              errors.push(`${item.product.productName} (${item.sku.skuCode}): Please select a retailer`);
                            } else if (!retailer.quantity || parseInt(retailer.quantity) <= 0) {
                              if (!hasErrors) {
                                firstErrorKey = key;
                              }
                              hasErrors = true;
                              errors.push(`${item.product.productName} (${item.sku.skuCode}): Retailer "${retailer.name}" needs a quantity`);
                            }
                          });
                        });

                        if (hasErrors) {
                          // Scroll to the first SKU with an error
                          if (firstErrorKey) {
                            setTimeout(() => {
                              const element = document.querySelector(`[data-sku-key="${firstErrorKey}"]`);
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Add a brief highlight effect
                                element.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
                                setTimeout(() => {
                                  element.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
                                }, 2000);
                              }
                            }, 100);
                          }

                          const skuWord = unallocatedCount > 1 ? 'SKUs' : 'SKU';
                          const title = `Please Complete Allocation`;
                          const formattedErrors = errors.map((error, index) => `${index + 1}. ${error}`).join('\n\n');
                          const message = `${unallocatedCount} ${skuWord} need${unallocatedCount === 1 ? 's' : ''} attention:\n\n${formattedErrors}\n\nNote: Total allocated quantity must match the stock difference for each SKU.`;
                          showError(message, title);
                          return;
                        }
                      } else if (verificationStep === 3) {
                        // --- Step 3 Validation (E-Sign only) ---
                        if (!signature) {
                          showError('E-signature is required to proceed.');
                          return;
                        }
                        console.log('✅ Step 3 validation passed, moving to step 4');
                      }

                      // If all validations pass, move to the next step and save progress
                      const nextStep = verificationStep + 1;
                      console.log(`🔄 Moving from step ${verificationStep} to step ${nextStep}`);
                      setVerificationStep(nextStep);
                      setTimeout(() => saveVerificationProgress(), 100);
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      // If no photo uploaded, show reminder modal
                      if (uploadedProofs.length === 0) {
                        setShowPhotoReminderModal(true);
                        return;
                      }

                      // --- Step 4 Validation (Pic-Verify/Proof) ---
                      // Check if proofs are required (if any retailer allocation exists)
                      let requiresProofs = false;
                      for (const item of allSKUsToProcess) {
                        const key = `${item.product.productCode}-${item.sku.skuCode}`;
                        const currentRetailers = skuRetailers.get(key) || [];
                        const actualRetailers = currentRetailers.filter(r => r.id && r.id !== 'manual-entry');
                        const retailerTotal = actualRetailers.reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0);
                        if (retailerTotal > 0) {
                          requiresProofs = true;
                          break; // Found retailer allocation, no need to check further
                        }
                      }

                      // If proofs are required, check if at least one is uploaded
                      if (requiresProofs && uploadedProofs.length === 0) {
                        setShowPhotoReminderModal(true);
                        return;
                      }

                      // If validation passes, proceed with confirmation
                      handleConfirmSplit();
                    }}
                    disabled={uploadedProofs.length === 0}
                    className={`px-6 py-2 rounded-lg transition-colors font-medium ${
                      uploadedProofs.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    Confirm & Submit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AddRetailerModal
        isOpen={showAddRetailerModal}
        onClose={() => {
          setShowAddRetailerModal(false);
          setPrefilledRetailerName('');
        }}
        onSave={handleSaveNewRetailer}
        existingRetailers={retailers.map(r => ({
          name: r.name,
          phone: (r as any).phone || '',
          outletName: (r as any).outletName || '',
          code: (r as any).code || r._id
        }))}
        prefilledName={prefilledRetailerName}
      />

      {selectedProofForViewing && (
        <ProofDocumentViewer
          proof={selectedProofForViewing}
          onClose={() => setSelectedProofForViewing(null)}
        />
      )}

      {showCameraModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[200] flex items-center justify-center p-2">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full h-[95vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-white text-green-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
                  <h3 className="text-lg font-bold text-white">Step 4: Capture Proof Photo</h3>
                </div>
                <p className="text-xs text-green-50 mt-0.5">Click picture of person who e-signed • Include shop signboard if possible</p>
              </div>
              <button
                onClick={() => setShowCameraModal(false)}
                className="text-white hover:text-green-100 p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden">
                <MediaUpload
                  key={uploadedProofs.length}
                  autoOpenCamera={true}
                  onUpload={(files) => {
                    for (const file of files) {
                      const timestamp = new Date();
                      const dateTimeString = timestamp.toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      });

                      const photoId = `photo_${Date.now()}`;

                      // Add photo immediately with placeholder location
                      const photoData = {
                        id: photoId,
                        name: file.name,
                        type: 'photo',
                        url: URL.createObjectURL(file),
                        timestamp: timestamp.toISOString(),
                        metadata: {
                          employee: user?.name || 'Unknown',
                          designation: user?.role || 'Unknown',
                          location: 'Getting location...',
                          dateTime: dateTimeString,
                          latitude: undefined,
                          longitude: undefined
                        }
                      };

                      setUploadedProofs(prev => [...prev, photoData]);

                      // Try to get location in background and update later
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          const latitude = position.coords.latitude;
                          const longitude = position.coords.longitude;
                          const locationString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

                          setUploadedProofs(prev =>
                            prev.map(p =>
                              p.id === photoId
                                ? {
                                    ...p,
                                    metadata: {
                                      ...p.metadata,
                                      location: locationString,
                                      latitude,
                                      longitude
                                    }
                                  }
                                : p
                            )
                          );
                        },
                        (error) => {
                          console.error('Error capturing location:', error);
                          setUploadedProofs(prev =>
                            prev.map(p =>
                              p.id === photoId
                                ? {
                                    ...p,
                                    metadata: {
                                      ...p.metadata,
                                      location: 'Location unavailable'
                                    }
                                  }
                                : p
                            )
                          );
                        },
                        {
                          enableHighAccuracy: true,
                          timeout: 15000,
                          maximumAge: 0
                        }
                      );
                    }

                    // Close modal immediately
                    setShowCameraModal(false);
                  }}
                  onCancel={() => setShowCameraModal(false)}
                  maxFiles={5 - uploadedProofs.length}
                  acceptedTypes={['image/*']}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showPhotoReminderModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[250] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPhotoReminderModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-full p-2 flex-shrink-0">
                  <Camera className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white break-words">Hi {user?.name?.split(' ')[0] || 'Gencrestian'}!</h3>
                  <p className="text-sm text-green-50 mt-0.5">Photo Required</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <p className="text-gray-700 text-base leading-relaxed">
                  Please capture a photo as proof before submitting the verification.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-800">
                    <p className="font-semibold mb-1">Please complete the following:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Capture a photo as proof of verification</li>
                      <li>Include the person who e-signed if possible</li>
                      <li>Try to capture shop name/signboard</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowPhotoReminderModal(false)}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPhotoReminderModal(false);
                  setShowCameraModal(true);
                }}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-700 hover:to-green-600 transition-colors font-semibold shadow-lg"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showContinueProgressModal && savedProgressData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[250] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowContinueProgressModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-full p-2 flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white break-words">Hi {user?.name?.split(' ')[0] || 'Gencrestian'}!</h3>
                  <p className="text-sm text-blue-50 mt-0.5">Continue Verification?</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <p className="text-gray-700 text-base leading-relaxed">
                  <span className="font-semibold text-gray-900">Hi {user?.name?.split(' ')[0] || 'Gencrestian'}</span>, you have an incomplete verification from today for{' '}
                  <span className="font-semibold text-gray-900">{savedProgressData.distributorName}</span>.
                </p>
                <p className="text-gray-700 text-base leading-relaxed">
                  Would you like to continue from where you left off{' '}
                  <span className="font-semibold text-gray-900">(Step {savedProgressData.verificationStep})</span>?
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Note:</p>
                    <p>Clicking "Start Fresh" will discard your saved progress and start a new verification.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleStartFresh}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Start Fresh
              </button>
              <button
                onClick={handleContinueProgress}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors font-semibold shadow-lg"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
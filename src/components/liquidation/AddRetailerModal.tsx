/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

export interface NewRetailerData {
  name: string;
  outletName: string;
  phone: string;
  address: string;
  pincode: string;
  market: string;
  city: string;
  state: string;
}

export interface RetailerMatch {
  name: string;
  phone?: string;
  outletName?: string;
  code?: string;
  address?: string;
  market?: string;
}

interface AddRetailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (retailer: NewRetailerData) => void;
  existingRetailers?: Array<RetailerMatch>;
  prefilledName?: string;
}

interface DuplicateWarning {
  type: 'exact' | 'similar' | 'phone' | 'phone-address';
  message: string;
  matches: Array<RetailerMatch>;
  allowSubmit?: boolean;
}

export const AddRetailerModal: React.FC<AddRetailerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingRetailers = [],
  prefilledName = '',
}) => {
  const [formData, setFormData] = useState<NewRetailerData>({
    name: "",
    outletName: "",
    phone: "",
    address: "",
    pincode: "",
    market: "",
    city: "",
    state: "",
  });
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof NewRetailerData, string>>>({});

  const normalizeString = React.useCallback((str: string): string => {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '');
  }, []);

  const calculateSimilarity = React.useCallback((str1: string, str2: string): number => {
    const s1 = normalizeString(str1);
    const s2 = normalizeString(str2);

    if (s1 === s2) return 1;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = (s1: string, s2: string): number => {
      const costs: number[] = [];
      for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
          if (i === 0) {
            costs[j] = j;
          } else if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
        if (i > 0) costs[s2.length] = lastValue;
      }
      return costs[s2.length];
    };

    return (longer.length - editDistance(longer, shorter)) / longer.length;
  }, [normalizeString]);

  const normalizeAddress = React.useCallback((address: string): string => {
    return address
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '');
  }, []);

  const checkForDuplicates = React.useCallback((name: string, phone: string, address: string) => {
    if (existingRetailers.length === 0) {
      setDuplicateWarning(null);
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    if (!normalizedPhone || normalizedPhone.length < 10) {
      if (!name.trim()) {
        setDuplicateWarning(null);
        return;
      }
    }

    const normalizedName = normalizeString(name);
    const normalizedAddress = normalizeAddress(address);

    const exactMatches: typeof existingRetailers = [];
    const similarMatches: typeof existingRetailers = [];
    const phoneMatches: typeof existingRetailers = [];

    existingRetailers.forEach((retailer) => {
      const existingNormalizedName = normalizeString(retailer.name);
      const existingPhone = (retailer.phone || '').replace(/\D/g, '');

      if (existingNormalizedName === normalizedName) {
        exactMatches.push(retailer);
      } else if (name.trim()) {
        const similarity = calculateSimilarity(name, retailer.name);
        if (similarity > 0.8) {
          similarMatches.push(retailer);
        }
      }

      if (normalizedPhone && existingPhone && normalizedPhone === existingPhone) {
        phoneMatches.push(retailer);
      }
    });

    if (phoneMatches.length > 0) {
      const existingAddress = normalizeAddress(phoneMatches[0].address || '');
      const addressIsDifferent = normalizedAddress && existingAddress && normalizedAddress !== existingAddress;

      setDuplicateWarning({
        type: addressIsDifferent ? 'phone-address' : 'phone',
        message: addressIsDifferent
          ? `This phone number is registered with another retailer. You can proceed since the address is different.`
          : `A contact exists with this phone number. Please verify if this is a new retailer at a different location.`,
        matches: phoneMatches,
        allowSubmit: addressIsDifferent,
      });
    } else if (exactMatches.length > 0) {
      setDuplicateWarning({
        type: 'exact',
        message: `A retailer with this exact name already exists. This might be a duplicate entry.`,
        matches: exactMatches,
      });
    } else if (similarMatches.length > 0) {
      setDuplicateWarning({
        type: 'similar',
        message: `Found similar retailer names. Please verify this is not a duplicate.`,
        matches: similarMatches,
      });
    } else {
      setDuplicateWarning(null);
    }
  }, [existingRetailers, normalizeString, normalizeAddress, calculateSimilarity]);

  useEffect(() => {
    if (prefilledName && isOpen) {
      setFormData(prev => ({ ...prev, name: prefilledName }));
    }
  }, [prefilledName, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (!formData.phone || formData.phone.replace(/\D/g, '').length < 10) {
      if (!formData.name) {
        setDuplicateWarning(null);
        return;
      }
    }

    const timeoutId = setTimeout(() => {
      checkForDuplicates(formData.name, formData.phone, formData.address);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [formData.name, formData.phone, formData.address, isOpen, checkForDuplicates]);

  if (!isOpen) return null;

  const validateField = (name: keyof NewRetailerData, value: string): string => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Retailer name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return '';
      case 'outletName':
        if (!value.trim()) return 'Outlet name is required';
        return '';
      case 'phone':
        if (!value.trim()) return 'Mobile number is required';
        if (!/^\d{10}$/.test(value.replace(/\D/g, ''))) return 'Enter a valid 10-digit mobile number';
        return '';
      case 'address':
        if (!value.trim()) return 'Address is required';
        if (value.trim().length < 5) return 'Address must be at least 5 characters';
        return '';
      case 'pincode':
        if (!value.trim()) return 'Pincode is required';
        if (!/^\d{6}$/.test(value)) return 'Enter a valid 6-digit pincode';
        return '';
      case 'market':
        if (!value.trim()) return 'Market is required';
        return '';
      case 'city':
        if (!value.trim()) return 'City is required';
        return '';
      case 'state':
        if (!value.trim()) return 'State is required';
        return '';
      default:
        return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof NewRetailerData;

    setFormData((prev) => ({ ...prev, [fieldName]: value }));

    const error = validateField(fieldName, value);
    setErrors((prev) => ({ ...prev, [fieldName]: error }));
    setConfirmOverride(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Partial<Record<keyof NewRetailerData, string>> = {};
    let hasErrors = false;

    (Object.keys(formData) as Array<keyof NewRetailerData>).forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);

    if (hasErrors) {
      return;
    }

    if (duplicateWarning && !duplicateWarning.allowSubmit) {
      if (duplicateWarning.type === 'exact') {
        return;
      }
      if ((duplicateWarning.type === 'phone' || duplicateWarning.type === 'similar') && !confirmOverride) {
        return;
      }
    }

    setLoading(true);
    try {
      onSave(formData);
      // Success - close the modal
      onClose();
      // Reset form
      setFormData({
        name: "",
        outletName: "",
        phone: "",
        address: "",
        pincode: "",
        market: "",
        city: "",
        state: "",
      });
      setErrors({});
      setDuplicateWarning(null);
      setConfirmOverride(false);
    } catch (error) {
      console.error('Error saving retailer:', error);
      // Error is handled by parent component
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[100] p-3">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">Add New Retailer</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {duplicateWarning && (
            <div className={`p-3 rounded-lg border ${
              duplicateWarning.type === 'phone-address'
                ? 'bg-blue-50 border-blue-300'
                : duplicateWarning.type === 'exact' || duplicateWarning.type === 'phone'
                ? 'bg-red-50 border-red-300'
                : 'bg-yellow-50 border-yellow-300'
            }`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  duplicateWarning.type === 'phone-address'
                    ? 'text-blue-600'
                    : duplicateWarning.type === 'exact' || duplicateWarning.type === 'phone'
                    ? 'text-red-600'
                    : 'text-yellow-600'
                }`} />
                <div className="flex-1">
                  <h4 className={`font-semibold ${
                    duplicateWarning.type === 'phone-address'
                      ? 'text-blue-800'
                      : duplicateWarning.type === 'exact' || duplicateWarning.type === 'phone'
                      ? 'text-red-800'
                      : 'text-yellow-800'
                  }`}>
                    {duplicateWarning.type === 'exact' && 'Duplicate Retailer Detected'}
                    {duplicateWarning.type === 'phone' && 'Contact Found with This Number'}
                    {duplicateWarning.type === 'phone-address' && 'Contact Found - Different Address'}
                    {duplicateWarning.type === 'similar' && 'Similar Retailers Found'}
                  </h4>
                  <p className={`text-xs mt-0.5 ${
                    duplicateWarning.type === 'phone-address'
                      ? 'text-blue-700'
                      : duplicateWarning.type === 'exact' || duplicateWarning.type === 'phone'
                      ? 'text-red-700'
                      : 'text-yellow-700'
                  }`}>
                    {duplicateWarning.message}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {duplicateWarning.matches.map((match, idx) => (
                      <div key={idx} className={`text-xs p-2 rounded border ${
                        duplicateWarning.type === 'phone-address'
                          ? 'bg-blue-100 border-blue-200'
                          : duplicateWarning.type === 'exact' || duplicateWarning.type === 'phone'
                          ? 'bg-red-100 border-red-200'
                          : 'bg-yellow-100 border-yellow-200'
                      }`}>
                        <div className="font-semibold text-xs mb-0.5">
                          {match.name} {match.code && `(${match.code})`}
                        </div>
                        <div className="space-y-0.5">
                          {match.phone && <div>📱 {match.phone}</div>}
                          {match.outletName && <div>🏪 {match.outletName}</div>}
                          {match.address && <div>📍 {match.address}</div>}
                          {match.market && <div>🏢 {match.market}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {(duplicateWarning.type === 'similar' || duplicateWarning.type === 'phone') && (
                    <label className="flex items-start gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={confirmOverride}
                        onChange={(e) => setConfirmOverride(e.target.checked)}
                        className={`rounded mt-0.5 flex-shrink-0 ${
                          duplicateWarning.type === 'phone'
                            ? 'border-red-400 text-red-600 focus:ring-red-500'
                            : 'border-yellow-400 text-yellow-600 focus:ring-yellow-500'
                        }`}
                      />
                      <span className={`text-xs font-medium ${
                        duplicateWarning.type === 'phone'
                          ? 'text-red-800'
                          : 'text-yellow-800'
                      }`}>
                        {duplicateWarning.type === 'phone'
                          ? 'I confirm this is a new retailer at a different location'
                          : 'I confirm this is a new retailer, not a duplicate'
                        }
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-2.5 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Retailer Name"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Outlet Name *</label>
            <input
              name="outletName"
              value={formData.outletName}
              onChange={handleChange}
              className={`w-full px-2.5 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                errors.outletName ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Outlet Name"
            />
            {errors.outletName && (
              <p className="mt-1 text-xs text-red-600">{errors.outletName}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Address *</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={2}
              className={`w-full px-2.5 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none ${
                errors.address ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Retailer Address"
            />
            {errors.address && (
              <p className="mt-1 text-xs text-red-600">{errors.address}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mobile Number *</label>
            <input
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              maxLength={10}
              className={`w-full px-2.5 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Mobile Number"
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pincode *</label>
              <input
                name="pincode"
                type="text"
                value={formData.pincode}
                onChange={handleChange}
                maxLength={6}
                className={`w-full px-2.5 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                  errors.pincode ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Pincode"
              />
              {errors.pincode && (
                <p className="mt-1 text-xs text-red-600">{errors.pincode}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Market *</label>
              <input
                name="market"
                value={formData.market}
                onChange={handleChange}
                className={`w-full px-2.5 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                  errors.market ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Market"
              />
              {errors.market && (
                <p className="mt-1 text-xs text-red-600">{errors.market}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">City *</label>
              <input
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={`w-full px-2.5 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                  errors.city ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="City"
              />
              {errors.city && (
                <p className="mt-1 text-xs text-red-600">{errors.city}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">State *</label>
              <input
                name="state"
                value={formData.state}
                onChange={handleChange}
                className={`w-full px-2.5 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                  errors.state ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="State"
              />
              {errors.state && (
                <p className="mt-1 text-xs text-red-600">{errors.state}</p>
              )}
            </div>
          </div>

        </div>

        <div className="border-t border-gray-200 px-4 py-2.5 flex justify-end space-x-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || (duplicateWarning?.type === 'phone' && !confirmOverride) || duplicateWarning?.type === 'exact'}
            className={`px-5 py-2 text-sm rounded-lg text-white font-medium transition-colors ${
                loading || (duplicateWarning?.type === 'phone' && !confirmOverride) || duplicateWarning?.type === 'exact'
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
            {loading ? "Saving..." : "Save Retailer"}
          </button>
        </div>
      </div>
    </div>
  );
};

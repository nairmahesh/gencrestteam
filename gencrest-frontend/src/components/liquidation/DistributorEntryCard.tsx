import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Calendar, Eye } from 'lucide-react';
import Entity360View from '../Entity360View';
import { useAuth } from '../../contexts/AuthContext';

interface DistributorMetrics {
  openingStock: { volume: number; value: number };
  ytdNetSales: { volume: number; value: number };
  liquidation: { volume: number; value: number };
  balanceStock: { volume: number; value: number };
  liquidationPercentage: number;
}

interface DistributorEntryCardProps {
  id: string;
  name: string;
  code: string;
  territory: string;
  updated: string;
  status: string;
  metrics: DistributorMetrics;
  onVerifyStock: () => void;
  onViewDetails: (metric: string) => void;
}

export const DistributorEntryCard: React.FC<DistributorEntryCardProps> = ({
  id,
  name,
  code,
  territory,
  updated,
  status,
  metrics,
  onVerifyStock,
  onViewDetails
}) => {
  const { user } = useAuth();
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [savedStep, setSavedStep] = useState(0);

  // Check for saved progress on mount and when id changes
  useEffect(() => {
    const checkSavedProgress = () => {
      const savedProgress = localStorage.getItem(`verification_progress_${id}`);
      if (savedProgress) {
        try {
          const progress = JSON.parse(savedProgress);
          const savedDate = new Date(progress.date).toDateString();
          const today = new Date().toDateString();

          if (savedDate === today && progress.verificationStep > 1) {
            setHasSavedProgress(true);
            setSavedStep(progress.verificationStep);
          } else {
            setHasSavedProgress(false);
            setSavedStep(0);
          }
        } catch (error) {
          setHasSavedProgress(false);
          setSavedStep(0);
        }
      } else {
        setHasSavedProgress(false);
        setSavedStep(0);
      }
    };

    checkSavedProgress();
  }, [id]);

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 10000000) {
      return `${sign}${(absValue / 10000000).toFixed(2)}`;
    } else if (absValue >= 100000) {
      return `${sign}${(absValue / 100000).toFixed(2)}`;
    } else if (absValue >= 1000) {
      return `${sign}${(absValue / 1000).toFixed(2)}`;
    }
    return `${sign}${absValue.toFixed(2)}`;
  };

  const formatVolume = (volume: number) => {
    return `${volume.toLocaleString()} Kg/Ltr`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} / ${hours}:${minutes}:${seconds}`;
  };


  const getLiquidationColor = (percentage: number) => {
    if (percentage >= 50) return 'text-green-600';
    if (percentage >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLiquidationBarColor = (percentage: number) => {
    if (percentage >= 50) return 'bg-green-500';
    if (percentage >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const [show360View, setShow360View] = React.useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow" data-distributor-id={id}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className="bg-purple-100 p-2 rounded-lg flex-shrink-0">
            <Building2 className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2 cursor-pointer hover:text-blue-500" onClick={()=>setShow360View(true)}>
              <span className="truncate capitalize">{name}</span>
              <Eye className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600 flex-shrink-0" />
            </h3>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-gray-600">
              <span className="flex items-center gap-1">
                ID: {code}
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                Territory: {territory}
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                Last Updated Balance Stock - {new Date(updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end gap-2">
          <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
            status === 'In Active' ? 'bg-green-100 text-green-700' :
            status === 'Verified' ? 'bg-blue-100 text-blue-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <div className="bg-orange-50 rounded-lg p-2 sm:p-3">
          <p className="text-xs text-orange-700 font-semibold mb-2">Opening Stock</p>
          <p className="text-base sm:text-lg font-bold text-orange-900">{formatCurrency(metrics.openingStock.value)}</p>
          <p className="text-xs text-orange-600">(Rs. Lakhs)</p>
          <p className="text-xs text-orange-600">{formatVolume(metrics.openingStock.volume)}</p>
          <button
            onClick={() => onViewDetails('opening')}
            className="mt-2 text-xs text-gray-600 hover:text-gray-700 flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            View Details
          </button>
        </div>

        <div className="bg-blue-50 rounded-lg p-2 sm:p-3">
          <p className="text-xs text-blue-700 font-semibold mb-2">YTD Net Sales</p>
          <p className="text-base sm:text-lg font-bold text-blue-900">{formatCurrency(metrics.ytdNetSales.value)}</p>
          <p className="text-xs text-blue-600">(Rs. Lakhs)</p>
          <p className="text-xs text-blue-600">{formatVolume(metrics.ytdNetSales.volume)}</p>
          <button
            onClick={() => onViewDetails('sales')}
            className="mt-2 text-xs text-gray-600 hover:text-gray-700 flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            View Details
          </button>
        </div>

        <div className="bg-green-50 rounded-lg p-2 sm:p-3">
          <p className="text-xs text-green-700 font-semibold mb-2">Liquidation</p>
          <p className="text-base sm:text-lg font-bold text-green-900">{formatCurrency(metrics.liquidation.value)}</p>
          <p className="text-xs text-green-600">(Rs. Lakhs)</p>
          <p className="text-xs text-green-600">{formatVolume(metrics.liquidation.volume)}</p>
          <button
            onClick={() => onViewDetails('liquidation')}
            className="mt-2 text-xs text-gray-600 hover:text-gray-700 flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            View Details
          </button>
        </div>

        <div className="bg-purple-50 rounded-lg p-2 sm:p-3">
          <p className="text-xs text-purple-700 font-semibold mb-2">Balance Stock</p>
          <p className="text-base sm:text-lg font-bold text-purple-900">{formatCurrency(metrics.balanceStock.value)}</p>
          <p className="text-xs text-purple-600">(Rs. Lakhs)</p>
          <p className="text-xs text-purple-600">{formatVolume(metrics.balanceStock.volume)}</p>
          {hasSavedProgress && (
            <div className="mt-2 mb-1 px-2 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800 text-center">
              Step {savedStep} in progress
            </div>
          )}
          <button
            onClick={onVerifyStock}
            className={`mt-2 px-2 sm:px-3 py-1 ${
              hasSavedProgress
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-green-600 hover:bg-green-700'
            } text-white text-xs rounded flex items-center gap-1 justify-center w-full`}
          >
            {hasSavedProgress ? 'Continue Verification' : 'Verify Stock'}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-700">Liquidation Rate</span>
          <span className={`text-lg font-bold ${getLiquidationColor(metrics.liquidationPercentage)}`}>
            {metrics.liquidationPercentage}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getLiquidationBarColor(metrics.liquidationPercentage)} transition-all duration-300`}
            style={{ width: `${Math.min(metrics.liquidationPercentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>0%</span>
          <span>Target: 50%</span>
          <span>100%</span>
        </div>
      </div>
      {show360View&&<Entity360View distributorCode={code} distributorName={name} userRole={user?.role || 'MDO'} onClose={()=>setShow360View(false)}/>}
    </div>
  );
};

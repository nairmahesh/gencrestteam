import { supabase } from '../lib/supabase';

interface SKUVerification {
  id: string;
  sku_code: string;
  sku_name: string;
  product_name: string;
  product_code?: string;
  previous_stock: number;
  verified_stock: number;
  unit: string;
  value?: number;
}

interface RetailerAllocation {
  name: string;
  amount: number;
}

interface SKUAllocation {
  farmer: number;
  retailers: RetailerAllocation[];
}

interface VerificationData {
  retailerId: string;
  retailerName: string;
  retailerLocation: string;
  distributorId?: string;
  distributorName?: string;
  skuVerifications: SKUVerification[];
  allocations: Record<string, SKUAllocation>;
  signature?: string;
  photos?: File[];
  recordedBy: string;
  recordedByRole: string;
  latitude?: number;
  longitude?: number;
}

export const saveStockVerification = async (data: VerificationData) => {
  if (!supabase) {
    console.warn('Supabase not available, data not saved:', data);
    return { success: false, error: 'Database not configured' };
  }

  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const recordedBy = currentUser.name || data.recordedBy;
    const recordedByRole = currentUser.role || data.recordedByRole;

    // 1. Upload photos to storage (if any)
    const proofDocuments: Array<{ type: string; url: string; name: string }> = [];
    if (data.photos && data.photos.length > 0) {
      for (const photo of data.photos) {
        try {
          const fileName = `${data.retailerId}_${Date.now()}_${photo.name}`;
          const filePath = `verification-proofs/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('verification-documents')
            .upload(filePath, photo);

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage
              .from('verification-documents')
              .getPublicUrl(filePath);

            proofDocuments.push({
              type: 'photo',
              url: urlData.publicUrl,
              name: photo.name
            });
          }
        } catch (error) {
          console.error('Photo upload failed:', error);
        }
      }
    }

    // Add signature if provided
    if (data.signature) {
      proofDocuments.push({
        type: 'signature',
        url: data.signature,
        name: 'signature.png'
      });
    }

    // 2. Create verification request
    const skusVerified = data.skuVerifications.map(sku => ({
      sku_code: sku.sku_code,
      sku_name: sku.sku_name,
      product_name: sku.product_name,
      previous_stock: sku.previous_stock,
      verified_stock: sku.verified_stock,
      unit: sku.unit,
      difference: sku.verified_stock - sku.previous_stock
    }));

    const stockChanges = {
      total_skus: data.skuVerifications.length,
      total_verified_value: data.skuVerifications.reduce((sum, sku) => sum + (sku.value || 0), 0),
      changes: skusVerified.filter(sku => sku.difference !== 0)
    };

    const { data: verificationRequest, error: requestError } = await supabase
      .from('verification_requests')
      .insert({
        request_type: 'retailer_verification',
        entity_id: data.retailerId,
        entity_name: data.retailerName,
        entity_location: data.retailerLocation,
        submitted_by_id: currentUser.id || recordedBy,
        submitted_by_name: recordedBy,
        submitted_by_role: recordedByRole,
        status: 'pending',
        verification_data: {
          distributor_id: data.distributorId,
          distributor_name: data.distributorName,
          allocations: data.allocations,
          latitude: data.latitude,
          longitude: data.longitude
        },
        skus_verified: skusVerified,
        total_skus_count: data.skuVerifications.length,
        stock_changes: stockChanges,
        proof_documents: proofDocuments
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating verification request:', requestError);
      return { success: false, error: requestError.message };
    }

    // 3. Update retailer_inventory with verified stock
    for (const sku of data.skuVerifications) {
      const { error: inventoryError } = await supabase
        .from('retailer_inventory')
        .upsert({
          retailer_id: data.retailerId,
          retailer_name: data.retailerName,
          retailer_business_name: data.retailerName,
          retailer_location: data.retailerLocation,
          distributor_id: data.distributorId,
          distributor_name: data.distributorName,
          product_code: sku.product_code || sku.sku_code.split('-')[0],
          product_name: sku.product_name,
          sku_code: sku.sku_code,
          sku_name: sku.sku_name,
          current_stock: sku.verified_stock,
          unit: sku.unit,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'retailer_id,product_code,sku_code'
        });

      if (inventoryError) {
        console.error('Error updating retailer inventory:', inventoryError);
      }
    }

    // 4. Create stock transfer records for allocations
    const stockTransfers = [];
    for (const [skuId, allocation] of Object.entries(data.allocations)) {
      const sku = data.skuVerifications.find(s => s.id === skuId);
      if (!sku) continue;

      // Farmer allocation
      if (allocation.farmer > 0) {
        stockTransfers.push({
          transfer_type: 'retailer_to_farmer',
          transfer_date: new Date().toISOString(),
          from_entity_type: 'retailer',
          from_entity_id: data.retailerId,
          from_entity_name: data.retailerName,
          to_entity_type: 'farmer',
          to_entity_id: 'FARMER_GENERIC',
          to_entity_name: 'Farmer',
          product_code: sku.product_code || sku.sku_code.split('-')[0],
          product_name: sku.product_name,
          sku_code: sku.sku_code,
          sku_name: sku.sku_name,
          quantity: allocation.farmer,
          unit: sku.unit,
          latitude: data.latitude,
          longitude: data.longitude,
          recorded_by: recordedBy,
          notes: 'Stock allocation during verification'
        });
      }

      // Retailer allocations
      for (const retailerAlloc of allocation.retailers) {
        if (retailerAlloc.amount > 0) {
          stockTransfers.push({
            transfer_type: 'retailer_return',
            transfer_date: new Date().toISOString(),
            from_entity_type: 'retailer',
            from_entity_id: data.retailerId,
            from_entity_name: data.retailerName,
            to_entity_type: 'retailer',
            to_entity_id: 'RETAILER_' + retailerAlloc.name.replace(/\s/g, '_').toUpperCase(),
            to_entity_name: retailerAlloc.name,
            product_code: sku.product_code || sku.sku_code.split('-')[0],
            product_name: sku.product_name,
            sku_code: sku.sku_code,
            sku_name: sku.sku_name,
            quantity: retailerAlloc.amount,
            unit: sku.unit,
            latitude: data.latitude,
            longitude: data.longitude,
            recorded_by: recordedBy,
            notes: 'Stock transfer during verification'
          });
        }
      }
    }

    if (stockTransfers.length > 0) {
      const { error: transferError } = await supabase
        .from('stock_transfers')
        .insert(stockTransfers);

      if (transferError) {
        console.error('Error creating stock transfers:', transferError);
      }
    }

    console.log('✅ Stock verification saved successfully');
    return {
      success: true,
      verificationId: verificationRequest.id,
      message: 'Verification submitted for approval'
    };

  } catch (error) {
    console.error('Error saving stock verification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

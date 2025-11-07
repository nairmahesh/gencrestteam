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

    // 4. Save to stock_verification_history
    const skusChecked = data.skuVerifications.map(sku => {
      const allocation = data.allocations[sku.id] || { farmer: 0, retailers: [] };
      return {
        sku_code: sku.sku_code,
        sku_name: sku.sku_name,
        product_name: sku.product_name,
        product_code: sku.product_code || sku.sku_code.split('-')[0],
        unit: sku.unit,
        old_stock: sku.previous_stock,
        new_stock: sku.verified_stock,
        difference: sku.verified_stock - sku.previous_stock,
        farmer_allocation: allocation.farmer,
        retailer_allocation: sku.verified_stock - allocation.farmer,
        allocated_retailers: allocation.retailers.map(r => ({
          name: r.name,
          amount: r.amount
        }))
      };
    });

    // Only save if we have SKUs to verify
    if (skusChecked.length > 0) {
      const { error: historyError } = await supabase
        .from('stock_verification_history')
        .insert({
          verification_date: new Date().toISOString(),
          retailer_id: data.retailerId,
          retailer_name: data.retailerName,
          distributor_id: data.distributorId || null,
          distributor_name: data.distributorName || null,
          skus_checked: skusChecked,
          total_skus_count: data.skuVerifications.length,
          verified_by_id: currentUser.id || recordedBy || 'unknown',
          verified_by_name: recordedBy || 'Unknown',
          verified_by_role: recordedByRole || 'Staff',
          proof_type: data.signature && proofDocuments.length > 0 ? 'both' : data.signature ? 'signature' : 'photo',
          signature_image: data.signature || null,
          proof_photos: proofDocuments.filter(p => p.type === 'photo'),
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          notes: `Verified ${data.skuVerifications.length} SKUs`
        });

      if (historyError) {
        console.error('Error saving verification history:', historyError);
        console.error('History error details:', JSON.stringify(historyError, null, 2));
      } else {
        console.log('✅ Verification history saved successfully');
      }
    } else {
      console.warn('No SKUs to save to verification history');
    }

    // 5. Create stock transfer records for allocations
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

      // Retailer allocations - FROM DISTRIBUTOR TO RETAILER
      for (const retailerAlloc of allocation.retailers) {
        if (retailerAlloc.amount > 0) {
          stockTransfers.push({
            transfer_type: 'distributor_to_retailer',
            transfer_date: new Date().toISOString(),
            from_entity_type: 'distributor',
            from_entity_id: data.distributorId || data.retailerId,
            from_entity_name: data.distributorName || data.retailerName,
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
            notes: 'Stock allocated from distributor to retailer during verification'
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

      // Update retailer_inventory for allocated retailers
      for (const [skuId, allocation] of Object.entries(data.allocations)) {
        const sku = data.skuVerifications.find(s => s.id === skuId);
        if (!sku) continue;

        for (const retailerAlloc of allocation.retailers) {
          if (retailerAlloc.amount > 0) {
            const retailerId = 'RETAILER_' + retailerAlloc.name.replace(/\s/g, '_').toUpperCase();

            // Try to get existing inventory
            const { data: existingInventory } = await supabase
              .from('retailer_inventory')
              .select('*')
              .eq('retailer_id', retailerId)
              .eq('sku_code', sku.sku_code)
              .maybeSingle();

            if (existingInventory) {
              // Update existing inventory
              await supabase
                .from('retailer_inventory')
                .update({
                  current_stock: existingInventory.current_stock + retailerAlloc.amount,
                  total_received: existingInventory.total_received + retailerAlloc.amount,
                  last_received_quantity: retailerAlloc.amount,
                  last_received_date: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingInventory.id);
            } else {
              // Create new inventory record
              await supabase
                .from('retailer_inventory')
                .insert({
                  retailer_id: retailerId,
                  retailer_name: retailerAlloc.name,
                  retailer_business_name: retailerAlloc.name,
                  retailer_location: data.retailerLocation || 'Unknown',
                  distributor_id: data.distributorId,
                  distributor_name: data.distributorName,
                  product_code: sku.product_code || sku.sku_code.split('-')[0],
                  product_name: sku.product_name,
                  sku_code: sku.sku_code,
                  sku_name: sku.sku_name,
                  current_stock: retailerAlloc.amount,
                  unit: sku.unit,
                  total_received: retailerAlloc.amount,
                  last_received_quantity: retailerAlloc.amount,
                  last_received_date: new Date().toISOString()
                });
            }
          }
        }
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

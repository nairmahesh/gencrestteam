# Retailer Stock Verification Process - Complete Flow Documentation

## Overview
This document explains the complete flow of the Retailer Stock Verification feature, including when and how API calls are made, data flow, and the 4-step verification process.

---

## Table of Contents
1. [Initial Page Load](#initial-page-load)
2. [Opening Verify Stock Modal](#opening-verify-stock-modal)
3. [4-Step Verification Process](#4-step-verification-process)
4. [API Calls & Database Operations](#api-calls--database-operations)
5. [Data Flow Diagram](#data-flow-diagram)

---

## 1. Initial Page Load

### Component: `RetailerStockVerification.tsx`

### When Page Loads
```typescript
useEffect(() => {
  fetchRetailersData();
}, []);
```

### API Call #1: Fetch Retailer Inventory
**File:** `RetailerStockVerification.tsx` (Line 153-322)
**Function:** `fetchRetailersData()`

```typescript
const { data: inventoryData, error } = await supabase
  .from('retailer_inventory')
  .select('*');
```

**What Happens:**
1. **Fetches all retailer inventory** from the `retailer_inventory` table
2. **Groups data by retailer** - Creates a map where each retailer has:
   - Basic info (name, location, ID)
   - Array of inventory items (SKUs)
   - Calculated metrics (opening stock, allocated, liquidation, balance)
3. **Calculates overall metrics** - Aggregates all retailer data for the overview cards
4. **Renders the page** - Shows list of retailers with their stock information

**Response Data Structure:**
```javascript
{
  id: '1',
  retailer_id: 'RET001',
  retailer_name: 'Vasudha Swaraj Pvt Ltd',
  retailer_location: 'Khandwa',
  distributor_id: 'DIST001',
  distributor_name: 'ABC Distributors',
  product_code: 'FGCMGM0093',
  product_name: 'Agrosatva',
  sku_code: 'AGR-1L',
  sku_name: 'Agrosatva',
  current_stock: 8000,
  unit: '1 Ltr',
  last_received_date: '2025-11-06',
  last_received_quantity: 10000,
  total_received: 15000,
  total_sold: 7000
}
```

---

## 2. Opening Verify Stock Modal

### User Action: Click "Verify Current Stock" Button
**Location:** Line 757-764 in `RetailerStockVerification.tsx`

```typescript
<button onClick={() => {
  setSelectedRetailerForVerify(retailer);
  setShowVerifyModal(true);
}}>
  Verify Current Stock
</button>
```

### What Happens:
1. **Sets selected retailer** - Stores the clicked retailer in state
2. **Opens modal** - Sets `showVerifyModal` to `true`
3. **Modal component renders** - `SimplifiedVerifyStockModal` component mounts

### API Call #2: Fetch Available Retailers (for allocation)
**File:** `SimplifiedVerifyStockModal.tsx` (Line 172-220)
**When:** Modal opens (`useEffect` triggers on `isOpen`)

```typescript
const { data: outlets, error } = await supabase
  .from('outlets')
  .select('outlet_code, outlet_name, owner_name, contact_phone, address')
  .eq('is_active', true);
```

**Purpose:**
- Fetches list of all active retailers/outlets
- Used in Step 2 (Farmer Allocation) for allocating stock to other retailers
- Displays in dropdown when user types retailer name

---

## 3. 4-Step Verification Process

### Overview of Steps
```
Step 1: Verify Stock    → Update stock quantities
Step 2: Allocate        → Allocate to farmers/retailers
Step 3: E-Sign          → Capture electronic signature
Step 4: Pic-Verify      → Capture photo proof
```

---

### Step 1: Verify Stock (Verification)
**File:** `SimplifiedVerifyStockModal.tsx` (Line 673-746)

#### What User Sees:
- Table showing all SKUs for the retailer
- Input fields to update stock quantities
- Shows allocated stock vs. current stock

#### What User Does:
1. **Reviews current stock** for each SKU
2. **Enters new stock quantities** in input fields
3. **Sees real-time calculations** of stock changes

#### Technical Details:
```typescript
const updateStock = (skuId: string, value: string) => {
  const numValue = parseInt(value, 10);
  const sku = retailer.inventory.find(s => s.id === skuId);

  // Convert input to actual units (cases/bags to units)
  const unit = sku.unit.toLowerCase();
  const inputType = unit.includes('kg') ? 'bags' : 'cases';
  const actualUnits = convertInputToUnits(numValue, inputType, sku);

  setVerificationData({
    ...verificationData,
    [skuId]: actualUnits
  });
};
```

**Unit Conversion:**
- **For Kg SKUs:** User enters bags → Converts to Kg (bag size from SKU)
- **For Ltr SKUs:** User enters cases → Converts to Ltr (case size from SKU)

**Example:**
```
User enters: 10 Bags (for 50 Kg SKU)
System stores: 500 Kg (10 × 50)
```

#### Data Stored:
```javascript
verificationData = {
  'sku_1': 8000,  // verified stock in base units
  'sku_2': 1000,
  'sku_3': 500
}
```

#### No API Call at this step
- All data is stored in component state
- Calculations happen in browser
- Nothing sent to database yet

---

### Step 2: Farmer Allocation
**File:** `SimplifiedVerifyStockModal.tsx` (Line 748-822)

#### What User Sees:
- Only SKUs where stock decreased (liquidation occurred)
- Two allocation fields per SKU:
  1. **Retailer Allocations** - How much stays at retailer
  2. **Farmer Allocation** - Auto-calculated remainder

#### What User Does:
1. **Enters retailer stock** (how much stays with retailer)
2. **System auto-calculates** farmer allocation
3. **Can add allocations** to other retailers (optional)

#### Technical Details:
```typescript
const updateRetailerStock = (skuId: string, value: string) => {
  const numValue = parseInt(value, 10);
  const totalStock = sku.current_stock;

  // Auto-calculate farmer allocation
  const farmerAllocation = totalStock - numValue;

  setAllocations(prev => ({
    ...prev,
    [skuId]: {
      retailers: [],
      farmer: farmerAllocation
    }
  }));
};
```

**Example Calculation:**
```
Total Stock: 1000 Kg
Retailer keeps: 300 Kg (user enters)
Farmer gets: 700 Kg (auto-calculated)
```

#### Data Stored:
```javascript
allocations = {
  'sku_1': {
    farmer: 700,           // Amount to farmers
    retailers: [           // Array of retailer allocations
      { name: 'Retailer A', amount: 200 },
      { name: 'Retailer B', amount: 100 }
    ]
  }
}
```

#### No API Call at this step
- Allocation data stored in state
- Retailers list already fetched when modal opened

---

### Step 3: E-Sign (Electronic Signature)
**File:** `SimplifiedVerifyStockModal.tsx` (Line 824-905)

#### What User Sees:
- HTML5 Canvas element for drawing
- "Clear" button to restart signature

#### What User Does:
1. **Draws signature** with mouse/touch on canvas
2. **System captures** signature as base64 image
3. **Can clear and redraw** if needed

#### Technical Details:
```typescript
const stopDrawing = () => {
  if (isDrawing) {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      // Convert canvas to base64 image
      setSignature(canvas.toDataURL());
    }
  }
  setIsDrawing(false);
};
```

#### Data Stored:
```javascript
signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
```

#### Validation:
- **Required field** - Cannot proceed to Step 4 without signature
- Validation happens on "Next" button click

#### No API Call at this step
- Signature stored as base64 string in state
- Saved to localStorage for progress recovery

---

### Step 4: Pic-Verify (Photo Proof)
**File:** `SimplifiedVerifyStockModal.tsx` (Line 907-974)

#### What User Sees:
- "Click Picture" button
- Instructions modal (person + shop signboard)
- Camera interface
- List of captured photos

#### What User Does:
1. **Clicks "Click Picture"** button
2. **Reads instructions** about photo requirements
3. **Opens camera** and captures photo
4. **Reviews captured photos**
5. **Can capture multiple photos** (max 5)

#### Technical Details:
```typescript
const handleCameraUpload = (files: File[]) => {
  const lastFile = files[files.length - 1];
  const reader = new FileReader();
  reader.onloadend = () => {
    const newProof = {
      id: `photo_${Date.now()}`,
      type: 'photo',
      name: lastFile.name,
      url: reader.result as string  // base64
    };
    setUploadedProofs(prev => [...prev, newProof]);
  };
  reader.readAsDataURL(lastFile);
};
```

#### Data Stored:
```javascript
uploadedProofs = [
  {
    id: 'photo_1730908234567',
    type: 'photo',
    name: 'verification_photo_1.jpg',
    url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
  }
]

// Also stores actual File objects
photos = [File, File, ...]
```

#### Validation:
- **Required field** - Must capture at least 1 photo
- Validation happens on "Submit" button click

#### No API Call at this step
- Photos stored in state as base64 and File objects
- Ready for final submission

---

## 4. API Calls & Database Operations

### Final Submission - When User Clicks "Submit"
**File:** `SimplifiedVerifyStockModal.tsx` (Line 504-567)
**Function:** `handleSubmit()`

### API Call #3: Get Current Location
```typescript
await getLocation();
```
**Purpose:** Capture GPS coordinates for verification audit trail

---

### API Call #4: Upload Photos to Storage
**File:** `verificationService.ts` (Line 54-79)

```typescript
for (const photo of data.photos) {
  const fileName = `${data.retailerId}_${Date.now()}_${photo.name}`;
  const filePath = `verification-proofs/${fileName}`;

  const { data: uploadData, error } = await supabase.storage
    .from('verification-documents')
    .upload(filePath, photo);

  const { data: urlData } = supabase.storage
    .from('verification-documents')
    .getPublicUrl(filePath);

  proofDocuments.push({
    type: 'photo',
    url: urlData.publicUrl,
    name: photo.name
  });
}
```

**What Happens:**
1. **Uploads each photo** to Supabase Storage
2. **Bucket:** `verification-documents`
3. **Path:** `verification-proofs/RET001_1730908234567_photo1.jpg`
4. **Gets public URL** for each uploaded photo
5. **Stores URLs** in array for database record

---

### API Call #5: Insert Verification Request
**File:** `verificationService.ts` (Line 107-136)

```typescript
const { data: verificationRequest, error } = await supabase
  .from('verification_requests')
  .insert({
    request_type: 'retailer_verification',
    entity_id: data.retailerId,
    entity_name: data.retailerName,
    entity_location: data.retailerLocation,
    submitted_by_id: currentUser.id,
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
```

**Purpose:**
- Creates a verification request record
- **Status:** `pending` (awaiting approval)
- Stores all verification details
- Links to proof documents (photos + signature)

**Data Saved:**
```javascript
{
  request_type: 'retailer_verification',
  entity_id: 'RET001',
  entity_name: 'Vasudha Swaraj Pvt Ltd',
  status: 'pending',
  skus_verified: [
    {
      sku_code: 'AGR-1L',
      sku_name: 'Agrosatva',
      previous_stock: 8000,
      verified_stock: 7500,
      difference: -500
    }
  ],
  proof_documents: [
    { type: 'photo', url: 'https://...' },
    { type: 'signature', url: 'data:image/png...' }
  ]
}
```

---

### API Call #6: Update Retailer Inventory
**File:** `verificationService.ts` (Line 139-163)

```typescript
for (const sku of data.skuVerifications) {
  const { error } = await supabase
    .from('retailer_inventory')
    .upsert({
      retailer_id: data.retailerId,
      retailer_name: data.retailerName,
      product_code: sku.product_code,
      product_name: sku.product_name,
      sku_code: sku.sku_code,
      sku_name: sku.sku_name,
      current_stock: sku.verified_stock,  // NEW STOCK
      unit: sku.unit,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'retailer_id,product_code,sku_code'
    });
}
```

**Purpose:**
- **Updates current stock** with verified quantities
- Uses `upsert` - Updates if exists, inserts if new
- **Conflict resolution:** Based on retailer + product + SKU combination

**Before:**
```javascript
current_stock: 8000  // Old stock
```

**After:**
```javascript
current_stock: 7500  // Verified stock
updated_at: '2025-11-06T14:30:00Z'
```

---

### API Call #7: Save Verification History
**File:** `verificationService.ts` (Line 166-217)

```typescript
const { error } = await supabase
  .from('stock_verification_history')
  .insert({
    verification_date: new Date().toISOString(),
    retailer_id: data.retailerId,
    retailer_name: data.retailerName,
    distributor_id: data.distributorId,
    distributor_name: data.distributorName,
    skus_checked: skusChecked,  // Detailed SKU info
    total_skus_count: data.skuVerifications.length,
    verified_by_id: currentUser.id,
    verified_by_name: recordedBy,
    verified_by_role: recordedByRole,
    proof_type: 'both',  // signature + photo
    signature_image: data.signature,
    proof_photos: proofDocuments.filter(p => p.type === 'photo'),
    latitude: data.latitude,
    longitude: data.longitude,
    notes: `Verified ${data.skuVerifications.length} SKUs`
  });
```

**Purpose:**
- Creates historical record of verification
- Stores detailed breakdown per SKU
- Includes allocations (farmer + retailer)
- Links proof documents
- GPS coordinates for audit

**SKUs Checked Structure:**
```javascript
skus_checked: [
  {
    sku_code: 'AGR-1L',
    sku_name: 'Agrosatva',
    old_stock: 8000,
    new_stock: 7500,
    difference: -500,
    farmer_allocation: 300,
    retailer_allocation: 7200,
    allocated_retailers: [
      { name: 'Retailer A', amount: 200 }
    ]
  }
]
```

---

### API Call #8: Create Stock Transfer Records
**File:** `verificationService.ts` (Line 220-283)

```typescript
// For each allocation, create transfer records
const stockTransfers = [];

// Farmer allocations
if (allocation.farmer > 0) {
  stockTransfers.push({
    transfer_type: 'retailer_to_farmer',
    from_entity_type: 'retailer',
    from_entity_id: data.retailerId,
    from_entity_name: data.retailerName,
    to_entity_type: 'farmer',
    to_entity_id: 'FARMER_GENERIC',
    to_entity_name: 'Farmer',
    product_code: sku.product_code,
    sku_code: sku.sku_code,
    quantity: allocation.farmer,
    unit: sku.unit,
    transfer_date: new Date().toISOString()
  });
}

// Retailer allocations
for (const retailerAlloc of allocation.retailers) {
  stockTransfers.push({
    transfer_type: 'distributor_to_retailer',
    from_entity_type: 'distributor',
    from_entity_id: data.distributorId,
    to_entity_type: 'retailer',
    to_entity_id: 'RETAILER_' + retailerAlloc.name,
    quantity: retailerAlloc.amount
  });
}

const { error } = await supabase
  .from('stock_transfers')
  .insert(stockTransfers);
```

**Purpose:**
- Creates audit trail of stock movements
- Tracks WHERE stock went (farmers vs. retailers)
- Used for liquidation reports
- Enables traceability

**Transfer Types:**
1. **`retailer_to_farmer`** - Stock sold to farmers
2. **`distributor_to_retailer`** - Stock transferred to other retailers

---

### API Call #9: Update Allocated Retailer Inventory
**File:** `verificationService.ts` (Line 286-338)

```typescript
for (const retailerAlloc of allocation.retailers) {
  const retailerId = 'RETAILER_' + retailerAlloc.name;

  // Check if retailer already has this SKU
  const { data: existingInventory } = await supabase
    .from('retailer_inventory')
    .select('*')
    .eq('retailer_id', retailerId)
    .eq('sku_code', sku.sku_code)
    .maybeSingle();

  if (existingInventory) {
    // Update existing
    await supabase
      .from('retailer_inventory')
      .update({
        current_stock: existingInventory.current_stock + retailerAlloc.amount,
        total_received: existingInventory.total_received + retailerAlloc.amount,
        last_received_quantity: retailerAlloc.amount,
        last_received_date: new Date().toISOString()
      })
      .eq('id', existingInventory.id);
  } else {
    // Create new inventory record
    await supabase
      .from('retailer_inventory')
      .insert({
        retailer_id: retailerId,
        retailer_name: retailerAlloc.name,
        sku_code: sku.sku_code,
        current_stock: retailerAlloc.amount,
        total_received: retailerAlloc.amount
      });
  }
}
```

**Purpose:**
- Updates inventory for retailers who received stock
- **If retailer exists:** Adds to their current stock
- **If new retailer:** Creates inventory record
- Tracks last received date and quantity

---

### After All API Calls Complete

#### Success Response:
```typescript
return {
  success: true,
  verificationId: verificationRequest.id,
  message: 'Verification submitted for approval'
};
```

#### Modal Closes and Refreshes Data:
**File:** `SimplifiedVerifyStockModal.tsx` (Line 548-557)

```typescript
if (result.success) {
  showNotification('Stock verification submitted successfully!', 'success');

  // Clear saved progress
  localStorage.removeItem(`verification_progress_${retailer.retailer_id}`);

  // Trigger success callback
  setTimeout(() => {
    onSuccess();  // Calls parent refresh
    onClose();    // Closes modal
  }, 1000);
}
```

#### Parent Component Refreshes:
**File:** `RetailerStockVerification.tsx` (Line 1205-1230)

```typescript
onSuccess={() => {
  const retailerId = selectedRetailerForVerify.retailer_id;

  // Refresh data
  fetchRetailersData();  // API Call #10: Reload all retailer data

  // Highlight the updated card
  setHighlightedRetailerId(retailerId);

  // Scroll to card
  setTimeout(() => {
    const cardElement = retailerRefs.current[retailerId];
    cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}
```

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                             │
└─────────────────────────────────────────────────────────────────┘

1. PAGE LOAD
   │
   ├── API CALL: Fetch retailer_inventory
   │   └── Response: List of all retailers + inventory
   │
   └── RENDER: Retailer cards with metrics

2. CLICK "VERIFY STOCK" BUTTON
   │
   ├── API CALL: Fetch outlets (for allocation dropdowns)
   │   └── Response: List of active retailers
   │
   └── OPEN MODAL: SimplifiedVerifyStockModal

3. STEP 1: VERIFY STOCK
   │
   ├── User enters new stock quantities
   ├── System converts units (bags/cases → base units)
   └── Store in state: verificationData

4. STEP 2: ALLOCATE
   │
   ├── User allocates stock to retailer
   ├── System auto-calculates farmer allocation
   ├── User can add retailer allocations (optional)
   └── Store in state: allocations

5. STEP 3: E-SIGN
   │
   ├── User draws signature on canvas
   ├── System converts to base64 image
   └── Store in state: signature

6. STEP 4: PIC-VERIFY
   │
   ├── User captures photo(s)
   ├── System converts to base64 + stores File object
   └── Store in state: uploadedProofs, photos

7. CLICK "SUBMIT"
   │
   ├── API CALL: Get current location (GPS)
   │   └── Response: { latitude, longitude }
   │
   ├── API CALL: Upload photos to storage
   │   ├── Upload to: verification-documents bucket
   │   └── Response: Public URLs for photos
   │
   ├── API CALL: Insert verification_requests
   │   └── Creates pending approval request
   │
   ├── API CALL: Update retailer_inventory (upsert)
   │   └── Updates current_stock with verified quantities
   │
   ├── API CALL: Insert stock_verification_history
   │   └── Creates historical record with full details
   │
   ├── API CALL: Insert stock_transfers
   │   └── Records stock movements (farmer + retailer allocations)
   │
   └── API CALL: Update allocated retailer inventories
       └── Adds stock to retailers who received allocations

8. SUCCESS
   │
   ├── Show success notification
   ├── Clear localStorage progress
   ├── Close modal
   │
   └── API CALL: Refresh retailer_inventory
       ├── Fetches updated data
       ├── Re-calculates metrics
       ├── Highlights updated retailer card
       └── Scrolls to updated card

┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE TABLES USED                        │
└─────────────────────────────────────────────────────────────────┘

1. retailer_inventory
   - Read: On page load, after verification
   - Write: Update verified stock quantities

2. outlets
   - Read: When modal opens (for allocation dropdown)

3. verification_requests
   - Write: Create pending approval request

4. stock_verification_history
   - Write: Create historical verification record

5. stock_transfers
   - Write: Record stock movements to farmers/retailers

6. Storage: verification-documents
   - Write: Upload verification photos
```

---

## 6. Auto-Save & Progress Recovery

### Auto-Save Feature
**File:** `SimplifiedVerifyStockModal.tsx` (Line 141-158)

```typescript
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

  localStorage.setItem(
    `verification_progress_${retailer.retailer_id}`,
    JSON.stringify(progressData)
  );
}, [currentStep, verificationData, allocations, signature, uploadedProofs]);
```

**What Gets Auto-Saved:**
- Current step number
- All verification data
- All allocations
- Signature (if captured)
- Uploaded photos
- Timestamp

**Storage Location:** Browser localStorage

**Key:** `verification_progress_${retailerId}`

---

### Progress Recovery
**When:** Modal opens for same retailer

**Checks:**
1. Is there saved progress in localStorage?
2. Is progress less than 24 hours old?
3. Is user past Step 1?

**If Yes:**
- Shows "Continue Verification?" modal
- User can choose:
  - **Continue** - Restores all data and returns to saved step
  - **Start Fresh** - Clears progress and starts from Step 1

---

## 7. Error Handling

### Validation Errors
1. **Step 3:** Signature required before proceeding
2. **Step 4:** At least 1 photo required before submit

### API Errors
All handled with try-catch blocks and user notifications:

```typescript
try {
  const result = await saveStockVerification(data);
  if (result.success) {
    showNotification('Success!', 'success');
  } else {
    showNotification(result.error, 'error');
  }
} catch (error) {
  showNotification('Error submitting verification', 'error');
}
```

### Network Failures
- Shows error notification
- Progress remains saved in localStorage
- User can retry submission

---

## 8. Summary of API Calls

| # | When | Function | Purpose | Table/Bucket |
|---|------|----------|---------|--------------|
| 1 | Page load | `fetchRetailersData()` | Get all retailers | `retailer_inventory` |
| 2 | Modal open | Fetch outlets | Get retailer list for allocation | `outlets` |
| 3 | Submit | `getLocation()` | Get GPS coordinates | Browser API |
| 4 | Submit | Upload photos | Store verification photos | `verification-documents` (Storage) |
| 5 | Submit | Insert request | Create verification request | `verification_requests` |
| 6 | Submit | Upsert inventory | Update verified stock | `retailer_inventory` |
| 7 | Submit | Insert history | Save verification details | `stock_verification_history` |
| 8 | Submit | Insert transfers | Record stock movements | `stock_transfers` |
| 9 | Submit | Update allocated inventories | Add stock to receiving retailers | `retailer_inventory` |
| 10 | Success | `fetchRetailersData()` | Refresh page data | `retailer_inventory` |

---

## 9. Key Features

### Real-time Calculations
- Stock differences calculated as user types
- Farmer allocation auto-calculated from retailer input
- Unit conversions (bags/cases → base units)

### Progress Persistence
- All data auto-saved to localStorage
- Can close modal and continue later
- 24-hour validity for saved progress

### Audit Trail
- GPS location captured
- Photos uploaded to cloud storage
- Signature stored as proof
- Complete history in database
- All stock movements tracked

### User Experience
- 4-step wizard with clear progress indicator
- Input validation at each step
- Success animations and feedback
- Auto-scroll to updated retailer
- Visual highlight of verified retailer

---

## 10. Business Logic

### When Stock Decreases (Liquidation)
- **Step 2 shows allocation screen**
- User must specify where stock went:
  - To farmers (direct sales)
  - To other retailers (stock transfer)

### When Stock Increases
- **No allocation needed**
- Could be new stock received
- Simply updates inventory

### Multi-SKU Support
- Can verify multiple products in one session
- Each SKU has independent allocation
- Supports different units (Kg, Ltr, etc.)

---

## Conclusion

The Retailer Stock Verification process is a comprehensive 4-step workflow that:
1. Verifies current stock levels
2. Tracks stock movements (liquidation)
3. Captures proof (signature + photos)
4. Maintains complete audit trail

All data is saved to Supabase database with full traceability, GPS coordinates, and supporting documents for compliance and reporting purposes.

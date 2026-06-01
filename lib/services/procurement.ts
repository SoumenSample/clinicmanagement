import connectDB from '@/lib/db';
import Distributor from '@/lib/models/Distributor';
import Medicine from '@/lib/models/Medicine';
import PurchaseItem from '@/lib/models/PurchaseItem';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import { writeAuditLog } from '@/lib/services/audit';

export interface DistributorPayload {
  name: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
  billingAddress?: Record<string, string>;
  shippingAddress?: Record<string, string>;
  serviceAreas?: string[];
  paymentTermsDays?: number;
  status?: 'active' | 'inactive';
  notes?: string;
}

export interface PurchaseOrderItemPayload {
  medicineId: string;
  quantity: number;
  unitCost: number;
  taxRate?: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface PurchaseOrderPayload {
  distributorId: string;
  expectedDeliveryDate?: string;
  notes?: string;
  invoiceFile?: {
    fileUrl?: string;
    fileName?: string;
  };
  items: PurchaseOrderItemPayload[];
}

function generatePoNumber() {
  const datePortion = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomPortion = Math.floor(Math.random() * 9000 + 1000).toString();
  return `PO-${datePortion}-${randomPortion}`;
}

export async function listDistributors(tenantId: string) {
  await connectDB();
  return Distributor.find({ tenantId }).sort({ createdAt: -1 });
}

export async function createDistributor(tenantId: string, actorUserId: string, payload: DistributorPayload) {
  await connectDB();

  const distributor = await Distributor.create({
    tenantId,
    ...payload,
  });

  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'procurement',
    action: 'create',
    entityType: 'Distributor',
    entityId: distributor._id.toString(),
    after: distributor.toObject(),
  });

  return distributor;
}

export async function updateDistributor(
  tenantId: string,
  actorUserId: string,
  distributorId: string,
  payload: Partial<DistributorPayload>
) {
  await connectDB();

  const before = await Distributor.findOne({ _id: distributorId, tenantId });
  if (!before) {
    return null;
  }

  const distributor = await Distributor.findOneAndUpdate(
    { _id: distributorId, tenantId },
    { $set: payload },
    { new: true }
  );

  if (distributor) {
    await writeAuditLog({
      tenantId,
      actorUserId,
      module: 'procurement',
      action: 'update',
      entityType: 'Distributor',
      entityId: distributorId,
      before: before.toObject(),
      after: distributor.toObject(),
    });
  }

  return distributor;
}

export async function deleteDistributor(tenantId: string, actorUserId: string, distributorId: string) {
  await connectDB();

  const distributor = await Distributor.findOneAndDelete({ _id: distributorId, tenantId });
  if (!distributor) {
    return null;
  }

  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'procurement',
    action: 'delete',
    entityType: 'Distributor',
    entityId: distributorId,
    before: distributor.toObject(),
  });

  return distributor;
}

export async function listPurchaseOrders(tenantId: string) {
  await connectDB();
  return PurchaseOrder.find({ tenantId })
    .populate('distributorId', 'name companyName phone email gstNumber')
    .sort({ createdAt: -1 });
}
export async function createPurchaseOrder(
  tenantId: string,
  actorUserId: string,
  payload: PurchaseOrderPayload
) {
  await connectDB();

  const poNumber = generatePoNumber();

  const subtotal = payload.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  const taxTotal = payload.items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitCost * ((item.taxRate ?? 0) / 100),
    0
  );

  const totalAmount = subtotal + taxTotal;

  const purchaseOrder = await PurchaseOrder.create({
    tenantId,
    poNumber,
    distributorId: payload.distributorId,
    expectedDeliveryDate: payload.expectedDeliveryDate,
    notes: payload.notes,
    invoiceFile: payload.invoiceFile,
    subtotal,
    taxTotal,
    discountTotal: 0,
    totalAmount,
    amountPaid: 0,
    balanceDue: totalAmount,
    createdBy: actorUserId,
  });

  // ✅ FIX: fetch all medicines FIRST
  const medicineMap = new Map();

  const medicineIds = payload.items.map((item) => item.medicineId);

  const medicines = await Medicine.find({
    _id: { $in: medicineIds },
    tenantId,
  });

  medicines.forEach((med) => {
    medicineMap.set(med._id.toString(), med);
  });

  // ✅ FIX: insert with proper snapshot
  const items = await PurchaseItem.insertMany(
    payload.items.map((item) => {
      const med = medicineMap.get(item.medicineId);

      if (!med) {
        throw new Error(`Medicine not found: ${item.medicineId}`);
      }

      return {
        tenantId,
        purchaseOrderId: purchaseOrder._id,
        medicineId: item.medicineId,

        // ✅ FIXED HERE
        medicineNameSnapshot: med.name,

        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate
          ? new Date(item.expiryDate)
          : undefined,

        qtyOrdered: item.quantity,
        qtyReceived: 0,
        unitCost: item.unitCost,
        taxRate: item.taxRate ?? 0,
        lineTotal: item.quantity * item.unitCost,
        receivedStatus: 'pending',
      };
    })
  );

  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'procurement',
    action: 'create',
    entityType: 'PurchaseOrder',
    entityId: purchaseOrder._id.toString(),
    after: purchaseOrder.toObject(),
  });

  return {
    purchaseOrder,
    items,
  };
}

// export async function createPurchaseOrder(tenantId: string, actorUserId: string, payload: PurchaseOrderPayload) {
//   await connectDB();

//   const poNumber = generatePoNumber();
//   const subtotal = payload.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
//   const taxTotal = payload.items.reduce((sum, item) => sum + item.quantity * item.unitCost * ((item.taxRate ?? 0) / 100), 0);
//   const totalAmount = subtotal + taxTotal;

//   const purchaseOrder = await PurchaseOrder.create({
//     tenantId,
//     poNumber,
//     distributorId: payload.distributorId,
//     expectedDeliveryDate: payload.expectedDeliveryDate,
//     notes: payload.notes,
//     invoiceFile: payload.invoiceFile,
//     subtotal,
//     taxTotal,
//     discountTotal: 0,
//     totalAmount,
//     amountPaid: 0,
//     balanceDue: totalAmount,
//     createdBy: actorUserId,
//   });

//   const items = await PurchaseItem.insertMany(
//     payload.items.map((item) => ({
//       tenantId,
//       purchaseOrderId: purchaseOrder._id,
//       medicineId: item.medicineId,
//       medicineNameSnapshot: '',
//       batchNumber: item.batchNumber,
//       expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
//       qtyOrdered: item.quantity,
//       qtyReceived: 0,
//       unitCost: item.unitCost,
//       taxRate: item.taxRate ?? 0,
//       lineTotal: item.quantity * item.unitCost,
//       receivedStatus: 'pending' as const,
//     }))
//   );

//   for (const item of items) {
//     const medicine = await Medicine.findOne({ _id: item.medicineId, tenantId });
//     if (medicine) {
//       item.medicineNameSnapshot = medicine.name;
//       await item.save();
//     }
//   }

//   await writeAuditLog({
//     tenantId,
//     actorUserId,
//     module: 'procurement',
//     action: 'create',
//     entityType: 'PurchaseOrder',
//     entityId: purchaseOrder._id.toString(),
//     after: purchaseOrder.toObject(),
//   });

//   return {
//     purchaseOrder,
//     items,
//   };
// }

export async function updatePurchaseOrder(
  tenantId: string,
  actorUserId: string,
  purchaseOrderId: string,
  payload: Partial<PurchaseOrderPayload> & { status?: 'pending' | 'shipped' | 'delivered' | 'cancelled' }
) {
  await connectDB();

  const before = await PurchaseOrder.findOne({ _id: purchaseOrderId, tenantId });
  if (!before) {
    return null;
  }

  const subtotal = payload.items
    ? payload.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
    : undefined;
  const taxTotal = payload.items
    ? payload.items.reduce(
        (sum, item) => sum + item.quantity * item.unitCost * ((item.taxRate ?? 0) / 100),
        0
      )
    : undefined;
  const totalAmount = subtotal !== undefined && taxTotal !== undefined ? subtotal + taxTotal : undefined;

  const update: Record<string, unknown> = {
    distributorId: payload.distributorId,
    expectedDeliveryDate: payload.expectedDeliveryDate,
    notes: payload.notes,
    invoiceFile: payload.invoiceFile,
  };

  if (payload.status) {
    update.status = payload.status;
  }
  if (totalAmount !== undefined) {
    update.subtotal = subtotal;
    update.taxTotal = taxTotal;
    update.totalAmount = totalAmount;
    update.balanceDue = totalAmount - (before.amountPaid ?? 0);
  }

  const purchaseOrder = await PurchaseOrder.findOneAndUpdate(
    { _id: purchaseOrderId, tenantId },
    { $set: update },
    { new: true }
  );

  if (purchaseOrder && payload.items?.length) {
    await PurchaseItem.deleteMany({ purchaseOrderId, tenantId });
    await PurchaseItem.insertMany(
      payload.items.map((item) => ({
        tenantId,
        purchaseOrderId,
        medicineId: item.medicineId,
        medicineNameSnapshot: '',
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        qtyOrdered: item.quantity,
        qtyReceived: 0,
        unitCost: item.unitCost,
        taxRate: item.taxRate ?? 0,
        lineTotal: item.quantity * item.unitCost,
        receivedStatus: 'pending' as const,
      }))
    );
  }

  if (purchaseOrder) {
    await writeAuditLog({
      tenantId,
      actorUserId,
      module: 'procurement',
      action: 'update',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrderId,
      before: before.toObject(),
      after: purchaseOrder.toObject(),
    });
  }

  return purchaseOrder;
}

export async function receivePurchaseOrder(
  tenantId: string,
  actorUserId: string,
  purchaseOrderId: string,
  payload: { receivedItems: Array<{ purchaseItemId: string; quantityReceived: number }> }
) {
  await connectDB();

  const purchaseOrder = await PurchaseOrder.findOne({ _id: purchaseOrderId, tenantId });
  if (!purchaseOrder) {
    return null;
  }

  const purchaseItems = await PurchaseItem.find({
    _id: { $in: payload.receivedItems.map((item) => item.purchaseItemId) },
    tenantId,
    purchaseOrderId,
  });

  for (const receivedItem of payload.receivedItems) {
    const purchaseItem = purchaseItems.find((item) => item._id.toString() === receivedItem.purchaseItemId);
    if (!purchaseItem) {
      continue;
    }

    purchaseItem.qtyReceived = receivedItem.quantityReceived;
    purchaseItem.receivedStatus =
      receivedItem.quantityReceived >= purchaseItem.qtyOrdered ? 'received' : 'partial';
    await purchaseItem.save();

    await Medicine.findOneAndUpdate(
      { _id: purchaseItem.medicineId, tenantId },
      {
        $inc: { quantity: receivedItem.quantityReceived },
        $set: {
          costPrice: purchaseItem.unitCost,
          preferredDistributorId: purchaseOrder.distributorId,
        },
      },
      { new: true }
    );
  }

  const allItems = await PurchaseItem.find({ purchaseOrderId, tenantId });
  const allReceived = allItems.every((item) => item.receivedStatus === 'received');
  const updateResult = await PurchaseOrder.findOneAndUpdate(
    { _id: purchaseOrderId, tenantId },
    {
      $set: {
        status: allReceived ? 'delivered' : 'shipped',
        receivedAt: new Date(),
      },
    },
    { new: true }
  );

  await writeAuditLog({
    tenantId,
    actorUserId,
    module: 'procurement',
    action: 'receive-stock',
    entityType: 'PurchaseOrder',
    entityId: purchaseOrderId,
    after: updateResult?.toObject(),
  });

  return updateResult;
}
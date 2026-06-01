import { z } from 'zod';

const addressSchema = z
  .object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  })
  .optional();

export const distributorSchema = z.object({
  name: z.string().min(1),
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  gstNumber: z.string().optional(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  serviceAreas: z.array(z.string()).optional(),
  paymentTermsDays: z.number().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().optional(),
});

export const purchaseOrderItemSchema = z.object({
  medicineId: z.string().min(1),
  quantity: z.number().min(1),
  unitCost: z.number().min(0),
  taxRate: z.number().min(0).optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const purchaseOrderSchema = z.object({
  distributorId: z.string().min(1),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  invoiceFile: z
    .object({
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
    })
    .optional(),
  items: z.array(purchaseOrderItemSchema).min(1),
});

export const receiveStockSchema = z.object({
  receivedItems: z
    .array(
      z.object({
        purchaseItemId: z.string().min(1),
        quantityReceived: z.number().min(0),
      })
    )
    .min(1),
});
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Category from '@/lib/models/Category';
import Medicine from '@/lib/models/Medicine';
import Shelf from '@/lib/models/Shelf';
import StockAlert from '@/lib/models/StockAlert';
import { withAdminAuth, withAuth } from '@/middleware/auth';
import { z } from 'zod';

const medicineSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  batchNumber: z.string().min(1),
  barcode: z.string().optional().or(z.literal('')),
  quantity: z.number().min(0),
  mrp: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  expiryDate: z.string(),
  dosage: z.string().min(1),
  category: z.string().min(1),
  minimumStock: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  shelfId: z.string().optional().or(z.literal('')),
});

async function createAlert(medicineId: string, medicine: any) {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Check for expired medicines
  if (medicine.expiryDate < now) {
    await StockAlert.create({
      tenantId: medicine.tenantId,
      medicineId,
      medicineName: medicine.name,
      alertType: 'expired',
      message: `${medicine.name} has expired (Expiry: ${medicine.expiryDate.toDateString()})`,
    });
  }
  // Check for medicines expiring soon
  else if (medicine.expiryDate < thirtyDaysLater) {
    await StockAlert.create({
      tenantId: medicine.tenantId,
      medicineId,
      medicineName: medicine.name,
      alertType: 'expiry_soon',
      message: `${medicine.name} will expire soon (Expiry: ${medicine.expiryDate.toDateString()})`,
    });
  }

  // Check for low stock
  if (medicine.quantity < medicine.minimumStock) {
    await StockAlert.create({
      tenantId: medicine.tenantId,
      medicineId,
      medicineName: medicine.name,
      alertType: 'low_stock',
      message: `${medicine.name} stock is low (Current: ${medicine.quantity}, Minimum: ${medicine.minimumStock})`,
    });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;

      const searchParams = req.nextUrl.searchParams;
      const search = searchParams.get('search');

      let query: any = {};
      if (auth?.tenantId) {
        query.tenantId = auth.tenantId;
      }
      if (search) {
        query = {
          ...query,
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } },
            { barcode: { $regex: search, $options: 'i' } },
          ],
        };
      }

      const [medicines, shelves] = await Promise.all([
        Medicine.find(query).sort({ createdAt: -1 }).lean(),
        Shelf.find({ tenantId: auth.tenantId }).lean(),
      ]);
      const categories = await Category.find({ tenantId: auth.tenantId }).lean();

      const shelfMap = new Map(
        shelves.map((shelf: any) => [String(shelf._id), shelf])
      );
      const categoryMap = new Map(
        categories.map((category: any) => [String(category.name).trim().toLowerCase(), category])
      );

      const normalizedMedicines = medicines.map((medicine: any) => {
        const shelf = medicine.shelfId ? shelfMap.get(String(medicine.shelfId)) : null;
        const mrp = Number(medicine.mrp ?? medicine.price ?? 0);
        const category = categoryMap.get(String(medicine.category || '').trim().toLowerCase());

        return {
          ...medicine,
          mrp,
          price: mrp,
          categoryGstPercentage: category?.gstPercentage ?? 0,
          shelfId: medicine.shelfId ? String(medicine.shelfId) : null,
          shelfLabel: shelf ? `${shelf.code} · ${shelf.label}` : 'Unassigned',
        };
      });

      return NextResponse.json(normalizedMedicines, { status: 200 });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to fetch medicines' },
        { status: 500 }
      );
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return withAdminAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;

      const body = await req.json();
      const data = medicineSchema.parse(body);
      const mrp = Number(data.mrp ?? data.price ?? 0);

      const category = await Category.findOne({
        tenantId: auth?.tenantId,
        name: data.category.trim(),
      });

      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      if (data.shelfId) {
        const shelf = await Shelf.findOne({ _id: data.shelfId, tenantId: auth?.tenantId });
        if (!shelf) {
          return NextResponse.json({ error: 'Shelf not found' }, { status: 404 });
        }
      }

      const medicine = new Medicine({
        tenantId: auth?.tenantId,
        ...data,
        barcode: data.barcode?.trim() || null,
        expiryDate: new Date(data.expiryDate),
        mrp,
        price: mrp,
        minimumStock: data.minimumStock || 10,
        costPrice: data.costPrice || mrp,
        reorderLevel: data.reorderLevel ?? data.minimumStock ?? 10,
        shelfId: data.shelfId || null,
      });

      await medicine.save();
      await createAlert(medicine._id.toString(), medicine);

      return NextResponse.json(medicine, { status: 201 });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to create medicine' },
        { status: 500 }
      );
    }
  })(request);
}

export async function PUT(request: NextRequest) {
  return withAdminAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;

      const id = req.nextUrl.searchParams.get('id');
      if (!id) {
        return NextResponse.json(
          { error: 'Medicine ID is required' },
          { status: 400 }
        );
      }

      const body = await req.json();
      const data = medicineSchema.parse(body);
      const mrp = Number(data.mrp ?? data.price ?? 0);

      const category = await Category.findOne({
        tenantId: auth?.tenantId,
        name: data.category.trim(),
      });

      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      if (data.shelfId) {
        const shelf = await Shelf.findOne({ _id: data.shelfId, tenantId: auth?.tenantId });
        if (!shelf) {
          return NextResponse.json({ error: 'Shelf not found' }, { status: 404 });
        }
      }

      const medicine = await Medicine.findOneAndUpdate(
        { _id: id, tenantId: auth?.tenantId },
        {
          ...data,
          barcode: data.barcode?.trim() || null,
          expiryDate: new Date(data.expiryDate),
          mrp,
          price: mrp,
          costPrice: data.costPrice || mrp,
          reorderLevel: data.reorderLevel ?? data.minimumStock ?? 10,
          shelfId: data.shelfId || null,
        },
        { new: true }
      );

      if (!medicine) {
        return NextResponse.json(
          { error: 'Medicine not found' },
          { status: 404 }
        );
      }

      // Clear old alerts and create new ones
      await StockAlert.deleteMany({ medicineId: id, tenantId: auth?.tenantId });
      await createAlert(id, medicine);

      return NextResponse.json(medicine, { status: 200 });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to update medicine' },
        { status: 500 }
      );
    }
  })(request);
}

export async function DELETE(request: NextRequest) {
  return withAdminAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;

      const id = req.nextUrl.searchParams.get('id');
      if (!id) {
        return NextResponse.json(
          { error: 'Medicine ID is required' },
          { status: 400 }
        );
      }

      const medicine = await Medicine.findOneAndDelete({ _id: id, tenantId: auth?.tenantId });

      if (!medicine) {
        return NextResponse.json(
          { error: 'Medicine not found' },
          { status: 404 }
        );
      }

      await StockAlert.deleteMany({ medicineId: id, tenantId: auth?.tenantId });

      return NextResponse.json(
        { message: 'Medicine deleted successfully' },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to delete medicine' },
        { status: 500 }
      );
    }
  })(request);
}

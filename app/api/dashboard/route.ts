import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Medicine from '@/lib/models/Medicine';
import Sale from '@/lib/models/Sale';
import StockAlert from '@/lib/models/StockAlert';
import { withAuth } from '@/middleware/auth';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;
      const tenantQuery = auth?.tenantId ? { tenantId: auth.tenantId } : {};

      // Total stock value
      const medicines = await Medicine.find(tenantQuery);
      const totalStockValue = medicines.reduce(
        (sum, med) => sum + med.quantity * Number(med.mrp ?? med.price ?? 0),
        0
      );

      // Total medicines count
      const totalMedicines = medicines.length;

      // Low stock count
      const lowStockCount = medicines.filter(
        (med) => med.quantity < med.minimumStock
      ).length;

      // Expired medicines count
      const now = new Date();
      const expiredCount = medicines.filter(
        (med) => med.expiryDate < now
      ).length;

      // Today's revenue
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      const todaySales = await Sale.find({
        ...tenantQuery,
        saleDate: {
          $gte: todayStart,
          $lt: todayEnd,
        },
      });

      const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);

      // Monthly revenue (last 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const monthlySales = await Sale.find({
        ...tenantQuery,
        saleDate: {
          $gte: thirtyDaysAgo,
          $lte: now,
        },
      });

      const monthlyRevenue = monthlySales.reduce((sum, sale) => sum + sale.totalAmount, 0);

      // Unresolved alerts
      const unresolvedAlerts = await StockAlert.countDocuments({ ...tenantQuery, isResolved: false });

      // Top selling medicines
      const topSelling = medicines
        .sort((a, b) => {
          const aTotal = todaySales.reduce((sum, sale) => {
            const item = sale.items.find((item: any) => item.medicineId.toString() === a._id.toString());
            return sum + (item ? item.quantity : 0);
          }, 0);

          const bTotal = todaySales.reduce((sum, sale) => {
            const item = sale.items.find((item: any) => item.medicineId.toString() === b._id.toString());
            return sum + (item ? item.quantity : 0);
          }, 0);

          return bTotal - aTotal;
        })
        .slice(0, 5);

      return NextResponse.json(
        {
          totalStockValue,
          totalMedicines,
          lowStockCount,
          expiredCount,
          todayRevenue,
          monthlyRevenue,
          unresolvedAlerts,
          topSelling: topSelling.map((med) => ({
            name: med.name,
            quantity: med.quantity,
            price: Number(med.mrp ?? med.price ?? 0),
          })),
        },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to fetch dashboard data' },
        { status: 500 }
      );
    }
  })(request);
}

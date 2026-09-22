export interface ReportSummary {
  revenue7: number
  revenue30: number
  todayRevenue: number
  orders7: number
  orders30: number
  todayOrders: number
  todayOrdersDelivered: number
  avgOrder: number
  topProduct: string
  stockUnits: number
  totalVariants: number
  todayInDelivery: number
  todayConfirmed: number
  lowStock: number
  outOfStock: number
  pendingReservations: number
  totalReservations: number
  deliveriesInProgress: number
  totalDeliveries: number
  deliveredToday: number
  todayDeliveries: number
  todayReservations: number
  todayReservationsPending: number
  cashExpected: number
  cashGap: number
  totalProduced: number
  totalLoss: number
}

export interface DayPoint {
  name: string
  date: string
  revenu: number
  commandes: number
}

export interface SalesDayPoint extends DayPoint {
  ventes: number
}

export interface TopProduct {
  name: string
  quantity: number
  revenue: number
}

export interface PaymentBreakdownPoint {
  method: string
  total: number
  count: number
}

export interface StockAlert {
  variantId: string
  productName: string
  format: string
  stock: number
  categoryName: string
}

export interface StockCategoryPoint {
  name: string
  totalStock: number
  variants: number
}

export interface StockVariantPoint {
  productName: string
  format: string
  stock: number
  price: number
  categoryName: string
}

export interface SupplyTypePoint {
  type: string
  quantity: number
  count: number
}

export interface SupplyMovement {
  id: string
  type: string
  quantity: number
  reason: string
  reference: string
  productName: string
  format: string
  pointOfSale: string | null
  createdAt: string
}

export interface SupplyDayPoint {
  name: string
  date: string
  quantity: number
}

export interface OrderStatusPoint {
  status: string
  count: number
  total: number
}

export interface OrderDayPoint {
  name: string
  date: string
  commandes: number
  revenu: number
}

export interface ReservationsByStatus {
  pending: number
  confirmed: number
  cancelled: number
  total: number
}

export interface ReservationPoint {
  id: string
  client: string
  type: string
  date: string
  heure: string
  status: string
}

export interface ReservationDayPoint {
  name: string
  date: string
  reservations: number
}

export interface WeeklyOrderDay {
  name: string
  date: string
  commandes: number
  montant: number
  details: {
    orderNumber: string
    customerName: string
    total: number
    paymentMethod: string
  }[]
}

export interface WeeklyReservationDay {
  name: string
  date: string
  precommandes: number
}

export interface WeeklyDeliveryDay {
  name: string
  date: string
  livraisons: number
  livrees: number
  details: {
    orderNumber: string
    customer: string
    status: string
    address: string
  }[]
}

export interface ProductionSummary {
  totalProduced: number
  productionCount: number
  totalIn: number
  totalLoss: number
  totalAdjustOut: number
}

export interface ProductionDayPoint {
  name: string
  date: string
  quantity: number
}

export interface ProductionLotPoint {
  id: string
  lotNumber: string
  initialQuantity: number
  remainingQuantity: number
  productionDate: string
  expiryDate: string | null
  status: string
  notes: string | null
  createdAt: string
  productName: string
  format: string
  categoryName: string | null
  allocationCount: number
}

export interface LotSummary {
  totalLots: number
  activeLots: number
  totalRemaining: number
  totalProduced: number
}

export interface CashSessionDay {
  name: string
  date: string
  sessions: number
  openingTotal: number
  closingTotal: number | null
  gap: number | null
}

export interface CashSessionsSummary {
  totalSessions: number
  openSessions: number
  closedSessions: number
  totalOpening: number
  totalClosing: number
}

export interface DeliveryPoint {
  id: string
  orderNumber: string
  customer: string
  status: string
  address: string
}

export interface ReportPayload {
  period: string
  periodLabel: string
  weekOffset: number
  weekStart: string
  weekEnd: string
  livraisonWeekStart: string
  livraisonWeekEnd: string
  summary: ReportSummary
  daily7: DayPoint[]
  daily30: DayPoint[]
  salesByDay: SalesDayPoint[]
  topProducts: TopProduct[]
  paymentBreakdown: PaymentBreakdownPoint[]
  paymentBreakdown30: PaymentBreakdownPoint[]
  stockAlerts: StockAlert[]
  stockByCategory: StockCategoryPoint[]
  allStockVariants: StockVariantPoint[]
  supplyByDay: SupplyDayPoint[]
  supplyByType: SupplyTypePoint[]
  supplyMovements: SupplyMovement[]
  ordersByStatus: OrderStatusPoint[]
  ordersByDay: OrderDayPoint[]
  reservationsByStatus: ReservationsByStatus
  reservationsByDay: ReservationDayPoint[]
  reservations: ReservationPoint[]
  weeklyCommandes: WeeklyOrderDay[]
  weeklyPrecommandes: WeeklyReservationDay[]
  weeklyLivraisons: WeeklyDeliveryDay[]
  productionByDay: ProductionDayPoint[]
  productionSummary: ProductionSummary
  productionMovements: SupplyMovement[]
  lots: ProductionLotPoint[]
  lotSummary: LotSummary
  cashSessionsByDay: CashSessionDay[]
  cashSessionsSummary: CashSessionsSummary
  recentMovements: SupplyMovement[]
  deliveries: DeliveryPoint[]
}
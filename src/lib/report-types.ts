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
  /** Stock réel par point de vente (id -> quantité). */
  stockByPos: Record<string, number>
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

export interface PointOfSaleComparison {
  id: string
  name: string
  code: string
  /** CA de la période (commandes en livraison ou livrées). */
  revenue: number
  orders: number
  stockUnits: number
}

// ─── RAPPORT D'UNE JOURNÉE (onglet « Journée ») ───────────────

export interface JourneeOrder {
  id: string
  orderNumber: string
  createdAt: string
  customerName: string | null
  status: string
  paymentMethod: string | null
  paymentStatus: string
  total: number
  items: number
  pointOfSale: string | null
  cashier: string | null
}

export interface JourneeCashSession {
  id: string
  pointOfSale: string
  cashier: string | null
  status: string
  openedAt: string
  closedAt: string | null
  openingBalance: number
  closingBalance: number | null
  gap: number | null
  reportReference: string | null
}

export interface JourneeReport {
  date: string
  label: string
  generatedAt: string
  pointsOfSale: { id: string; name: string }[]
  selectedPos: { id: string; name: string } | null
  summary: {
    revenue: number
    orders: number
    items: number
    avgOrder: number
    cancelled: number
    paidOrders: number
  }
  paymentBreakdown: { method: string; count: number; amount: number }[]
  ordersByStatus: { status: string; count: number; total: number }[]
  topProducts: { name: string; quantity: number; amount: number }[]
  byPointOfSale: { id: string; name: string; revenue: number; orders: number }[]
  byCashier: { id: string; name: string; revenue: number; orders: number }[]
  cashSessions: JourneeCashSession[]
  cashSummary: {
    sessions: number
    open: number
    closed: number
    totalOpening: number
    totalClosing: number
    totalGap: number
  }
  orders: JourneeOrder[]
}

export interface ReportPayload {
  period: string
  periodLabel: string
  pointsOfSale: { id: string; name: string }[]
  /** null = tous les points de vente. */
  selectedPos: { id: string; name: string } | null
  byPointOfSale: PointOfSaleComparison[]
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
  trendWeeks: { label: string; range?: string; commandes: number; montant: number; details: { orderNumber: string; customerName: string; total: number; paymentMethod: string }[] }[]
  trendMonths: { label: string; commandes: number; montant: number }[]
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

/* ------------------------------------------------------------------ *
 * Rapport GLOBAL : synthèse consolidée de TOUS les processus sur la
 * période sélectionnée (journée / semaine / mois / trimestre).
 * ------------------------------------------------------------------ */

export interface GlobalKpi {
  /** Ventes encaissées de la période (FCFA). */
  revenue: number
  /** Commandes actives (hors annulées) de la période. */
  orders: number
  /** Commandes encaissées (chiffre d'affaires). */
  paidOrders: number
  /** Commandes annulées de la période. */
  cancelledOrders: number
  /** Articles vendus (unités) sur la période. */
  items: number
  /** Panier moyen (FCFA), arrondi. */
  avgOrder: number
}

export interface GlobalStockKpi {
  /** Unités en stock (stock physique = somme PointOfSaleStock). */
  units: number
  variants: number
  lowStock: number
  outOfStock: number
}

export interface GlobalSupplyKpi {
  /** Entrées (IN + RETURN). */
  inbound: number
  /** Production (unités). */
  produced: number
  /** Pertes. */
  loss: number
  /** Sorties d'ajustement. */
  adjustOut: number
}

export interface GlobalReservationKpi {
  total: number
  pending: number
  confirmed: number
  cancelled: number
}

export interface GlobalDeliveryKpi {
  total: number
  inProgress: number
  delivered: number
}

export interface GlobalCashKpi {
  sessions: number
  open: number
  closed: number
  totalOpening: number
  totalClosing: number
  totalGap: number
}

export interface GlobalB2bDocumentCount {
  type: string
  count: number
  total: number
}

export interface GlobalB2bKpi {
  devis: number
  commandes: number
  factures: number
  documents: GlobalB2bDocumentCount[]
  /** Créances (factures émises non soldées). */
  creanceTotal: number
  creanceOverdue: number
  debtorClients: number
  openInvoices: number
}

export interface GlobalReport {
  period: string
  periodLabel: string
  from: string
  to: string
  generatedAt: string
  pointsOfSale: { id: string; name: string }[]
  selectedPos: { id: string; name: string } | null
  kpi: GlobalKpi
  paymentBreakdown: PaymentBreakdownPoint[]
  topProducts: TopProduct[]
  ordersByStatus: OrderStatusPoint[]
  byPointOfSale: PointOfSaleComparison[]
  stock: GlobalStockKpi
  stockAlerts: StockAlert[]
  stockByCategory: StockCategoryPoint[]
  supply: GlobalSupplyKpi
  supplyByType: SupplyTypePoint[]
  production: ProductionSummary
  lots: LotSummary
  reservations: GlobalReservationKpi
  deliveries: GlobalDeliveryKpi
  cash: GlobalCashKpi
  b2b: GlobalB2bKpi
}
/** Seuil de stock critique, le même pour tous les produits et tous les écrans (caisse, stock, tableau de bord, rapports). */
export const LOW_STOCK_THRESHOLD = 15

/** Stock critique : encore en stock, mais au seuil ou en dessous. */
export const isLowStock = (stock: number) => stock > 0 && stock <= LOW_STOCK_THRESHOLD

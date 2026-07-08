import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
})

export const registerSchema = z.object({
  name: z.string().min(2, "Minimum 2 caractères"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(8, "Numéro invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
})

export const addressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(3, "Adresse requise"),
  city: z.string().min(2, "Ville requise"),
  district: z.string().optional(),
  isDefault: z.boolean().default(false),
})

export const checkoutSchema = z.object({
  customerName: z.string().min(2, "Nom requis"),
  customerEmail: z.string().email("Email invalide"),
  customerPhone: z.string().min(8, "Numéro invalide"),
  address: z.string().min(5, "Adresse requise"),
  city: z.string().min(2, "Ville requise"),
  district: z.string().optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(["CARD", "MOBILE_MONEY", "CASH_ON_DELIVERY"]),
})

export const productSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  categoryId: z.string().optional(),
  isFeatured: z.boolean().default(false),
  variants: z.array(z.object({
    format: z.string().min(1, "Format requis"),
    price: z.number().positive("Prix positif requis"),
    stock: z.number().int().default(0),
    unit: z.string().optional(),
  })).min(1, "Au moins un format"),
})

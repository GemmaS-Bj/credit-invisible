import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Format E.164 requis (ex: +22961234567)'),
    pin: z.string().length(4, 'Le PIN doit faire exactement 4 chiffres').regex(/^\d+$/, 'Le PIN ne doit contenir que des chiffres'),
    name: z.string().min(2, 'Le nom doit contenir entre 2 et 100 caractères').max(100),
    businessName: z.string().max(150).optional(),
    sector: z.enum(['alimentation', 'textile', 'cosmetique', 'electronique', 'autre']).optional(),
    location: z.string().max(100).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    phone: z.string().min(1, 'Numéro de téléphone requis'),
    pin: z.string().length(4, 'Le PIN doit faire 4 chiffres'),
  }),
});
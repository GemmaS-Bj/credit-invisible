import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient' ; 
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../schemas/auth.schema';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret';

// POST /auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { phone, pin, name, businessName, sector, location } = req.body;

    // Check if merchant phone exists
    const { data: existingMerchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingMerchant) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Numéro de téléphone déjà enregistré' }
      });
    }

    // Hash the PIN for security
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);

    // Insert using snake_case for DB columns, mapping from camelCase request body
    const { data: newMerchant, error } = await supabase
      .from('merchants')
      .insert([{ 
        phone, 
        pin: pinHash, 
        name, 
        business_name: businessName, 
        sector, 
        location 
      }])
      .select('*')
      .single();

    if (error) throw error;

    // Generate JWT Token
    const token = jwt.sign({ id: newMerchant.id, phone: newMerchant.phone }, JWT_SECRET, { expiresIn: '1d' });

    return res.status(201).json({
      success: true,
      data: {
        merchant: {
          id: newMerchant.id,
          phone: newMerchant.phone,
          name: newMerchant.name,
          businessName: newMerchant.business_name,
          sector: newMerchant.sector,
          location: newMerchant.location,
          createdAt: newMerchant.created_at
        },
        token
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// POST /auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { phone, pin } = req.body;

    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error || !merchant) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Téléphone inconnu ou PIN incorrect' }
      });
    }

    // Verify PIN match
    const isPinValid = await bcrypt.compare(pin, merchant.pin);
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Téléphone inconnu ou PIN incorrect' }
      });
    }

    const token = jwt.sign({ id: merchant.id, phone: merchant.phone }, JWT_SECRET, { expiresIn: '1d' });

    return res.status(200).json({
      success: true,
      data: {
        merchant: {
          id: merchant.id,
          phone: merchant.phone,
          name: merchant.name
        },
        token
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

export default router;
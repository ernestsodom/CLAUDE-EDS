import { z } from 'zod';

/**
 * Esquemas de administracion de usuarios.
 *
 * Solo se usan desde `actions/users.ts`, que ademas exige el permiso
 * `settings.manage` antes de aceptar cualquiera de estos datos (§84).
 */

export const UserSchema = z.object({
  full_name: z.string().trim().min(2, 'El nombre es obligatorio').max(200),
  email: z.string().trim().toLowerCase().email('Email invalido').max(255),
  phone: z.string().trim().max(50).optional(),
  job_title: z.string().trim().max(100).optional(),
  role_id: z.string().uuid('Selecciona un rol'),
  active: z.boolean().default(true),
});

export type UserInput = z.infer<typeof UserSchema>;

/**
 * Minimo 8 caracteres: es el minimo que exige Supabase Auth por defecto.
 * No se valida complejidad adicional aqui; eso ya lo hace GoTrue.
 */
export const PasswordSchema = z.object({
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres').max(72),
});

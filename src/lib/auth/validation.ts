import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
});

export const ComparisonSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(10000, 'Prompt is too long'),
  models: z.array(z.string()).min(1).max(3).optional(),
  stream: z.boolean().optional().default(true),
  save: z.boolean().optional().default(false),
  comparisonId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Invalid comparison ID format'
    )
    .optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ComparisonInput = z.infer<typeof ComparisonSchema>;

export async function validateLoginInput(data: unknown) {
  return LoginSchema.parse(data);
}

export async function validateRegisterInput(data: unknown) {
  return RegisterSchema.parse(data);
}

export async function validateComparisonInput(data: unknown) {
  return ComparisonSchema.parse(data);
}

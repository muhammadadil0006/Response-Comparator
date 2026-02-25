import {
  LoginSchema,
  RegisterSchema,
  ComparisonSchema,
} from '@/lib/auth/validation';

describe('Validation Schemas', () => {
  describe('LoginSchema', () => {
    it('should validate correct login data', () => {
      const result = LoginSchema.safeParse({
        email: 'user@example.com',
        password: 'Password123!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = LoginSchema.safeParse({
        email: 'not-an-email',
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = LoginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RegisterSchema', () => {
    it('should validate correct registration data', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject short password', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: '12345',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(false);
    });

    it('should allow optional names', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'Password123!',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ComparisonSchema', () => {
    it('should validate correct comparison data', () => {
      const result = ComparisonSchema.safeParse({
        prompt: 'Explain quantum computing',
        models: ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-latest', 'xai/grok-2-latest'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty prompt', () => {
      const result = ComparisonSchema.safeParse({
        prompt: '',
        models: ['openai/gpt-4o'],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty models array', () => {
      const result = ComparisonSchema.safeParse({
        prompt: 'Hello',
        models: [],
      });
      expect(result.success).toBe(false);
    });

    it('should use default models if not provided', () => {
      const result = ComparisonSchema.safeParse({
        prompt: 'Hello world',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.models).toBeDefined();
        expect(result.data.models!.length).toBeGreaterThan(0);
      }
    });
  });
});

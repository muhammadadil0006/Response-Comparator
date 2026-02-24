import {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/lib/auth/jwt';

// Set env vars before tests
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-12345';

describe('JWT Utilities', () => {
  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(testUser.id, testUser.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(testUser.id, testUser.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = generateTokens(testUser);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(testUser.id, testUser.email);
      const payload = verifyAccessToken(token);
      expect(payload.user_id).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
      expect(payload.type).toBe('access');
    });

    it('should reject an invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow(
        'Invalid access token'
      );
    });

    it('should reject a refresh token used as access token', () => {
      const token = generateRefreshToken(testUser.id, testUser.email);
      expect(() => verifyAccessToken(token)).toThrow('Invalid access token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(testUser.id, testUser.email);
      const payload = verifyRefreshToken(token);
      expect(payload.user_id).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
      expect(payload.type).toBe('refresh');
    });

    it('should reject an invalid token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow(
        'Invalid refresh token'
      );
    });

    it('should reject an access token used as refresh token', () => {
      const token = generateAccessToken(testUser.id, testUser.email);
      expect(() => verifyRefreshToken(token)).toThrow('Invalid refresh token');
    });
  });
});

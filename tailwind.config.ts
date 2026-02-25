import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Pro-SaaS dark palette
        background: '#0B0F17',
        surface: '#161B22',
        'surface-hover': '#1C2128',
        border: '#30363D',
        foreground: '#F0F6FC',
        muted: '#8B949E',
        action: '#3B82F6',
        destructive: '#F85149',
        // Model branding
        openai: '#10A37F',
        anthropic: '#D97757',
        xai: '#E5E7EB',
        // Primary (action blue)
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 130, 246, 0.35)',
        'glow-sm': '0 0 10px rgba(59, 130, 246, 0.25)',
        'glow-openai': '0 0 20px rgba(16, 163, 127, 0.3)',
        'glow-anthropic': '0 0 20px rgba(217, 119, 87, 0.3)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.35s ease-out forwards',
        'shimmer': 'shimmer 1.6s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'ping-once': 'ping 0.6s cubic-bezier(0, 0, 0.2, 1) 1',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(59, 130, 246, 0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(59, 130, 246, 0.5)' },
        },
      },
      backgroundImage: {
        'shimmer-gradient': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        'hero-gradient': 'radial-gradient(ellipse at 50% 0%, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(135deg, #161B22 0%, #1C2128 100%)',
        'glow-border': 'linear-gradient(135deg, #3B82F6, #10A37F, #D97757)',
      },
    },
  },
  plugins: [],
};

export default config;

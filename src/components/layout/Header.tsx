'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectIsAuthenticated, selectCurrentUser, clearCredentials } from '@/store/slices/authSlice';
import { useLogoutMutation } from '@/store/api/authApi';
import { baseApi } from '@/store/api/baseApi';
import { Button } from '@/components/ui/Button';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectCurrentUser);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Logout on client side even if server fails
    } finally {
      dispatch(clearCredentials());
      dispatch(baseApi.util.resetApiState());
      router.replace('/login');
    }
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/compare', label: 'Compare' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#30363D] bg-[#0B0F17]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-openai text-white font-bold text-xs shadow-glow-sm group-hover:shadow-glow transition-all duration-300">
            AI
          </div>
          <span className="text-base font-bold text-[#F0F6FC] tracking-tight">
            Model <span className="text-primary-400">Playground</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                pathname === link.href
                  ? 'bg-[#1C2128] text-[#F0F6FC] border border-[#30363D]'
                  : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#1C2128]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Auth Actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* User pill */}
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#30363D] bg-[#161B22] px-3 py-1.5">
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary-500 to-[#10A37F] flex items-center justify-center text-white text-[10px] font-bold">
                  {user?.first_name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="text-xs font-medium text-[#F0F6FC]">
                  {user?.first_name} {user?.last_name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                isLoading={isLoggingOut}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

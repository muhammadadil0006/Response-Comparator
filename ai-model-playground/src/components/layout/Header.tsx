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
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold text-sm">
            AI
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            Model Playground
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Auth Actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400">
                {user?.first_name} {user?.last_name}
              </span>
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

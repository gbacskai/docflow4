import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth service to finish loading
  while (authService.isLoading()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to landing page if not authenticated
  router.navigate(['/']);
  return false;
};

// Guard for landing page - redirect authenticated users to dashboard
export const landingGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth service to finish loading
  while (authService.isLoading()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // If user is authenticated, redirect to home
  if (authService.isAuthenticated()) {
    router.navigate(['/home']);
    return false;
  }

  // Allow access to landing page for non-authenticated users
  return true;
};

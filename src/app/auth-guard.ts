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

// Guard to allow anyone to access landing/home page 
export const landingGuard: CanActivateFn = async (route, state) => {
  // Always allow access to landing/home page regardless of auth status
  return true;
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to landing page if not authenticated
  router.navigate(['/']);
  return false;
};

// Guard to redirect authenticated users from landing page to dashboard
export const landingGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    // If authenticated, redirect to dashboard
    router.navigate(['/dashboard']);
    return false;
  }

  // Allow access to landing page if not authenticated
  return true;
};

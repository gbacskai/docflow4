import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { UserDataService } from './services/user-data.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const userDataService = inject(UserDataService);
  const router = inject(Router);

  // First check if user is authenticated
  if (!authService.isAuthenticated()) {
    router.navigate(['/']);
    return false;
  }

  // Then check if user is admin
  if (!userDataService.isCurrentUserAdmin()) {
    // Redirect to reporting if authenticated but not admin
    router.navigate(['/reporting']);
    return false;
  }

  return true;
};

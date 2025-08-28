import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-user-menu',
  imports: [CommonModule],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.less'
})
export class UserMenu {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  showMenu = signal(false);
  
  // Expose auth service signals
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  isLoading = this.authService.isLoading;

  toggleMenu() {
    this.showMenu.update(show => !show);
  }

  closeMenu() {
    this.showMenu.set(false);
  }

  async logout() {
    this.closeMenu();
    await this.authService.signOut();
    // Redirect to root path after logout (which will show landing page for unauthenticated users)
    this.router.navigate(['/']);
  }

  onMyAccount() {
    this.closeMenu();
    this.router.navigate(['/my-account']);
  }

  onLogin() {
    // These won't be called since when not authenticated, the auth component shows
    // But keeping for completeness
    console.log('Login clicked');
  }

  onSignup() {
    // These won't be called since when not authenticated, the auth component shows
    // But keeping for completeness
    console.log('Signup clicked');
  }

  // Close menu when clicking outside
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.closeMenu();
    }
  }
}
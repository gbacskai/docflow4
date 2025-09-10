import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Navigation } from './navigation/navigation';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navigation],
  templateUrl: './app.html',
  styleUrl: './app.less'
})
export class App {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  // Expose auth state to template
  isAuthenticated = this.authService.isAuthenticated;
  isLoading = this.authService.isLoading;
  
  // Mobile sidebar state
  sidebarOpen = signal(false);
  
  // Current route tracking
  currentRoute = signal('/');
  
  // Check if on reporting page
  isOnReportingPage = computed(() => this.currentRoute() === '/reporting');
  
  constructor() {
    // Track route changes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute.set(event.url);
      });
  }
  
  toggleSidebar() {
    this.sidebarOpen.update(open => !open);
  }
  
  closeSidebar() {
    this.sidebarOpen.set(false);
  }
  
  // New Project functionality - this will trigger an event
  openNewProjectModal() {
    // Emit a custom event that the reporting component can listen to
    window.dispatchEvent(new CustomEvent('openNewProjectModal'));
  }
}

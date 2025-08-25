import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navigation } from './navigation/navigation';
import { Auth } from './auth/auth';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navigation, Auth],
  templateUrl: './app.html',
  styleUrl: './app.less'
})
export class App {
  private authService = inject(AuthService);
  
  // Expose auth state to template
  isAuthenticated = this.authService.isAuthenticated;
  isLoading = this.authService.isLoading;
  
  // Mobile sidebar state
  sidebarOpen = signal(false);
  
  toggleSidebar() {
    this.sidebarOpen.update(open => !open);
  }
  
  closeSidebar() {
    this.sidebarOpen.set(false);
  }
}

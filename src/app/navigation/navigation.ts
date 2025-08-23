import { Component, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserMenu } from '../user-menu/user-menu';
import { UserDataService } from '../services/user-data.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-navigation',
  imports: [RouterLink, RouterLinkActive, UserMenu, CommonModule],
  templateUrl: './navigation.html',
  styleUrl: './navigation.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Navigation {
  private userDataService = inject(UserDataService);
  private authService = inject(AuthService);
  
  navigationClick = output<void>();
  
  onNavigationClick() {
    this.navigationClick.emit();
  }

  isCurrentUserAdmin(): boolean {
    return this.userDataService.isCurrentUserAdmin();
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }
}

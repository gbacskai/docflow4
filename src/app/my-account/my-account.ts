import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-my-account',
  imports: [CommonModule],
  templateUrl: './my-account.html',
  styleUrl: './my-account.less'
})
export class MyAccount {
  private authService = inject(AuthService);
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  currentDate = new Date().toLocaleDateString();
}

import { Injectable, signal, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  private authService = inject(AuthService);
  private _currentUserData = signal<Schema['User']['type'] | null>(null);
  private _loading = signal(true);

  // Public readonly signals
  currentUserData = this._currentUserData.asReadonly();
  loading = this._loading.asReadonly();

  constructor() {
    // Initialize user data when service is created
    this.loadCurrentUserData();
    
    // Watch for authentication changes
    this.watchAuthChanges();
  }

  private watchAuthChanges() {
    // Simple polling to check if auth state changed
    // In a production app, you'd want a more sophisticated approach
    setInterval(() => {
      if (this.authService.isAuthenticated() && !this._currentUserData()) {
        this.loadCurrentUserData();
      } else if (!this.authService.isAuthenticated() && this._currentUserData()) {
        this._currentUserData.set(null);
      }
    }, 1000);
  }

  async loadCurrentUserData() {
    try {
      this._loading.set(true);
      const currentUserId = this.authService.getUserId();
      if (!currentUserId) {
        this._currentUserData.set(null);
        return;
      }

      const client = generateClient<Schema>();
      const { data: users } = await client.models.User.list();
      
      const currentUser = users.find(user => user.cognitoUserId === currentUserId);
      this._currentUserData.set(currentUser || null);
    } catch (error) {
      console.error('Error loading current user data:', error);
      this._currentUserData.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  isCurrentUserAdmin(): boolean {
    const currentUser = this._currentUserData();
    return currentUser?.userType === 'admin';
  }

  getCurrentUserData(): Schema['User']['type'] | null {
    return this._currentUserData();
  }

  async refreshUserData() {
    await this.loadCurrentUserData();
  }
}
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.less',
  standalone: true
})
export class Dashboard {
  private authService = inject(AuthService);

  // Dashboard data signals
  loading = signal(false);
  fullUserData = signal<Schema['User']['type'] | null>(null);
  
  // Mock data for demonstration
  mockProjects = signal([
    { id: '1', name: 'Website Redesign', status: 'active', createdAt: '2024-01-15', updatedAt: '2024-01-20', defaultDomain: '1' },
    { id: '2', name: 'Mobile App', status: 'active', createdAt: '2024-01-10', updatedAt: '2024-01-18', defaultDomain: '2' },
    { id: '3', name: 'Documentation Update', status: 'completed', createdAt: '2024-01-05', updatedAt: '2024-01-15', defaultDomain: '1' },
    { id: '4', name: 'API Integration', status: 'archived', createdAt: '2023-12-20', updatedAt: '2024-01-01', defaultDomain: '3' }
  ]);
  
  mockDomains = signal([
    { id: '1', name: 'Development' },
    { id: '2', name: 'Marketing' },
    { id: '3', name: 'Operations' }
  ]);
  
  mockDocumentTypes = signal([
    { id: '1', name: 'Requirements' },
    { id: '2', name: 'Design' },
    { id: '3', name: 'Technical Specs' },
    { id: '4', name: 'Test Plans' },
    { id: '5', name: 'User Manuals' }
  ]);
  
  mockUsers = signal([
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
    { id: '3', name: 'Bob Johnson' },
    { id: '4', name: 'Alice Brown' }
  ]);

  // KPI computations
  totalProjects = computed(() => this.mockProjects().length);
  activeProjects = computed(() => this.mockProjects().filter(p => p.status === 'active').length);
  completedProjects = computed(() => this.mockProjects().filter(p => p.status === 'completed').length);
  totalDomains = computed(() => this.mockDomains().length);
  totalDocumentTypes = computed(() => this.mockDocumentTypes().length);
  totalUsers = computed(() => this.mockUsers().length);

  // Recent activity
  recentProjects = computed(() => 
    this.mockProjects()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 5)
  );

  // Project status distribution
  projectStatusData = computed(() => {
    const total = this.totalProjects();
    const active = this.activeProjects();
    const completed = this.completedProjects();
    const archived = total - active - completed;
    
    return [
      { label: 'Active', count: active, percentage: total > 0 ? this.mathRound((active / total) * 100) : 0, color: '#27ae60' },
      { label: 'Completed', count: completed, percentage: total > 0 ? this.mathRound((completed / total) * 100) : 0, color: '#3498db' },
      { label: 'Archived', count: archived, percentage: total > 0 ? this.mathRound((archived / total) * 100) : 0, color: '#95a5a6' }
    ];
  });

  currentUser = computed(() => this.authService.currentUser());

  // Computed display name: FirstName LastName or email fallback
  displayName = computed(() => {
    const userData = this.fullUserData();
    if (userData?.firstName || userData?.lastName) {
      return `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    }
    return this.currentUser()?.email || this.currentUser()?.username || 'User';
  });

  constructor() {
    // Load full user data when component initializes
    this.loadUserData();
  }

  private async loadUserData() {
    try {
      const cognitoUserId = this.authService.getUserId();
      if (cognitoUserId) {
        const client = generateClient<Schema>();
        const { data: users } = await client.models.User.list();

        const user = users.find(u => u.cognitoUserId === cognitoUserId);
        if (user) {
          this.fullUserData.set(user);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  getDomainName(domainId: string): string {
    const domain = this.mockDomains().find(d => d.id === domainId);
    return domain?.name || 'Unknown Domain';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString();
  }

  mathMax(a: number, b: number): number {
    return Math.max(a, b);
  }

  mathRound(value: number): number {
    return Math.round(value);
  }

  toFixed(value: number, digits: number): string {
    return value.toFixed(digits);
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }
}

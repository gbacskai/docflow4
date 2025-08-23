import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [CommonModule],
  templateUrl: './landing.html',
  styleUrl: './landing.less',
  standalone: true
})
export class Landing {
  private router = inject(Router);

  navigateToLogin() {
    this.router.navigate(['/auth']);
  }

  features = [
    {
      icon: '📋',
      title: 'Project Management',
      description: 'Organize and manage your document flow projects with ease. Create projects, assign teams, and track progress.'
    },
    {
      icon: '📄',
      title: 'Document Types',
      description: 'Define custom document types with specific requirements. Streamline your document collection process.'
    },
    {
      icon: '👥',
      title: 'User Management',
      description: 'Manage users with different roles: admins, clients, and providers. Control access and permissions.'
    },
    {
      icon: '🏢',
      title: 'Domain Organization',
      description: 'Organize your work by domains. Keep different areas of business separated and well-structured.'
    },
    {
      icon: '🔒',
      title: 'Secure & Reliable',
      description: 'Built with security in mind. Your documents and data are protected with enterprise-grade security.'
    },
    {
      icon: '☁️',
      title: 'Cloud-Based',
      description: 'Access your documents from anywhere. Everything is stored securely in the cloud with automatic backups.'
    }
  ];
}
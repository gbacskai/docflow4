import { Injectable } from '@angular/core';
import type { Schema } from '../../../amplify/data/resource';

@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  private projects: Array<Schema['Project']['type']> = [
    {
      id: '1',
      name: 'Corporate Website Redesign',
      description: 'Complete overhaul of company website with modern design and improved UX',
      defaultDomain: 'corporate.example.com',
      ownerId: 'user-123',
      adminUsers: ['user-123', 'user-456'],
      status: 'active',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      name: 'Mobile App Development',
      description: 'Native iOS and Android app for customer engagement',
      defaultDomain: 'mobile-api.example.com',
      ownerId: 'user-789',
      adminUsers: ['user-789'],
      status: 'active',
      createdAt: '2024-02-01T14:30:00Z',
      updatedAt: '2024-02-10T09:15:00Z'
    },
    {
      id: '3',
      name: 'Data Migration Project',
      description: 'Migrate legacy database to modern cloud infrastructure',
      defaultDomain: 'data.example.com',
      ownerId: 'user-456',
      adminUsers: ['user-456', 'user-123'],
      status: 'completed',
      createdAt: '2023-11-20T08:45:00Z',
      updatedAt: '2024-01-30T16:20:00Z'
    }
  ];

  async listProjects(): Promise<{ data: Array<Schema['Project']['type']> }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return { data: [...this.projects] };
  }

  async createProject(project: Omit<Schema['Project']['type'], 'id' | 'createdAt' | 'updatedAt'>): Promise<{ data: Schema['Project']['type'] }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const newProject: Schema['Project']['type'] = {
      ...project,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.projects.push(newProject);
    return { data: newProject };
  }

  async updateProject(id: string, updates: Partial<Omit<Schema['Project']['type'], 'id' | 'createdAt'>>): Promise<{ data: Schema['Project']['type'] }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Project not found');
    }
    
    this.projects[index] = {
      ...this.projects[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    return { data: this.projects[index] };
  }

  async deleteProject(id: string): Promise<{ data: Schema['Project']['type'] }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Project not found');
    }
    
    const deletedProject = this.projects[index];
    this.projects.splice(index, 1);
    return { data: deletedProject };
  }
}
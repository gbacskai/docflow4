import { Component, OnInit, signal, inject } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';
import { MockDataService } from '../services/mock-data.service';

@Component({
  selector: 'app-projects',
  imports: [CommonModule],
  templateUrl: './projects.html',
  styleUrl: './projects.less'
})
export class Projects implements OnInit {
  projects = signal<Array<Schema['Project']['type']>>([]);
  loading = signal(true);
  usingMockData = signal(false);
  
  private mockDataService = inject(MockDataService);

  async ngOnInit() {
    await this.loadProjects();
  }

  async loadProjects() {
    try {
      this.loading.set(true);
      
      // Try to use Amplify client first
      try {
        const client = generateClient<Schema>();
        
        const { data } = await client.models.Project.list();
        this.projects.set(data);
        this.usingMockData.set(false);
      } catch (amplifyError) {
        console.warn('Amplify client not available, using mock data:', amplifyError);
        // Fallback to mock data service
        const { data } = await this.mockDataService.listProjects();
        this.projects.set(data);
        this.usingMockData.set(true);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async createProject(project: Omit<Schema['Project']['type'], 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      if (this.usingMockData()) {
        await this.mockDataService.createProject(project);
      } else {
        const client = generateClient<Schema>();
        await client.models.Project.create({
          ...project,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      await this.loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }
}

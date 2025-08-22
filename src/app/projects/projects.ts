import { Component, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.less'
})
export class Projects implements OnInit {
  projects = signal<Array<Schema['Project']['type']>>([]);
  users = signal<Array<Schema['User']['type']>>([]);
  domains = signal<Array<Schema['Domain']['type']>>([]);
  loading = signal(true);
  loadingUsers = signal(false);
  loadingDomains = signal(false);
  showNewProjectForm = signal(false);
  creatingProject = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedProject = signal<Schema['Project']['type'] | null>(null);
  updatingProject = signal(false);
  
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  
  newProjectForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    defaultDomain: ['', [Validators.required]],
    ownerId: ['', [Validators.required]],
    adminUsers: [''],
    status: ['active', [Validators.required]]
  });

  async ngOnInit() {
    await Promise.all([this.loadProjects(), this.loadUsers(), this.loadDomains()]);
  }

  async loadProjects() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Project.list();
      this.projects.set(data);
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadUsers() {
    try {
      this.loadingUsers.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.User.list();
      this.users.set(data);
    } catch (error) {
      console.error('Error loading users:', error);
      this.users.set([]);
    } finally {
      this.loadingUsers.set(false);
    }
  }

  async loadDomains() {
    try {
      this.loadingDomains.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Domain.list();
      // Only show active domains for selection
      this.domains.set(data.filter(domain => domain.status === 'active'));
    } catch (error) {
      console.error('Error loading domains:', error);
      this.domains.set([]);
    } finally {
      this.loadingDomains.set(false);
    }
  }

  getOwnerName(ownerId: string): string {
    const user = this.users().find(u => u.id === ownerId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown User';
  }

  getDomainName(domainId: string): string {
    const domain = this.domains().find(d => d.id === domainId);
    return domain ? domain.name : 'Unknown Domain';
  }

  async toggleNewProjectForm() {
    this.showNewProjectForm.set(!this.showNewProjectForm());
    if (!this.showNewProjectForm()) {
      this.newProjectForm.reset();
      this.newProjectForm.patchValue({ status: 'active' });
      this.currentMode.set('create');
      this.selectedProject.set(null);
    } else {
      this.currentMode.set('create');
      this.selectedProject.set(null);
      // Auto-populate owner with current user
      await this.setCurrentUserAsOwner();
    }
  }

  openEditProject(project: Schema['Project']['type']) {
    this.currentMode.set('edit');
    this.selectedProject.set(project);
    this.showNewProjectForm.set(true);
    
    // Populate form with project data
    this.newProjectForm.patchValue({
      name: project.name,
      description: project.description,
      defaultDomain: project.defaultDomain,
      ownerId: project.ownerId,
      adminUsers: project.adminUsers?.join(', ') || '',
      status: project.status
    });
  }

  openViewProject(project: Schema['Project']['type']) {
    this.currentMode.set('view');
    this.selectedProject.set(project);
    this.showNewProjectForm.set(true);
    
    // Populate form with project data but disable it
    this.newProjectForm.patchValue({
      name: project.name,
      description: project.description,
      defaultDomain: project.defaultDomain,
      ownerId: project.ownerId,
      adminUsers: project.adminUsers?.join(', ') || '',
      status: project.status
    });
    
    // Disable form in view mode
    this.newProjectForm.disable();
  }

  closeForm() {
    this.showNewProjectForm.set(false);
    this.currentMode.set('create');
    this.selectedProject.set(null);
    this.newProjectForm.reset();
    this.newProjectForm.patchValue({ status: 'active' });
    this.newProjectForm.enable();
  }

  async setCurrentUserAsOwner() {
    const currentUser = this.authService.currentUser();
    if (currentUser?.email) {
      // First, check if current user exists in the users list
      let currentUserId = this.users().find(u => u.email === currentUser.email)?.id;
      
      // If user doesn't exist in the database, create them
      if (!currentUserId) {
        currentUserId = await this.createCurrentUser();
      }
      
      if (currentUserId) {
        this.newProjectForm.patchValue({ 
          ownerId: currentUserId,
          status: 'active' 
        });
      }
    }
  }

  async createCurrentUser(): Promise<string | undefined> {
    const currentUser = this.authService.currentUser();
    if (!currentUser?.email) return undefined;

    try {
      const client = generateClient<Schema>();
      
      // Extract first and last name from email if not available
      const emailName = currentUser.email.split('@')[0];
      const nameParts = emailName.split('.');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts[1] || '';

      const { data } = await client.models.User.create({
        email: currentUser.email,
        firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
        lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Refresh users list
      await this.loadUsers();
      
      return data?.id;
    } catch (error) {
      console.error('Error creating user:', error);
      return undefined;
    }
  }

  async onSubmitProject() {
    if (this.newProjectForm.valid) {
      if (this.currentMode() === 'create') {
        this.creatingProject.set(true);
      } else if (this.currentMode() === 'edit') {
        this.updatingProject.set(true);
      }
      
      const formValue = this.newProjectForm.value;
      const adminUsersArray = formValue.adminUsers 
        ? formValue.adminUsers.split(',').map((user: string) => user.trim()).filter((user: string) => user)
        : [];

      const projectData = {
        name: formValue.name,
        description: formValue.description,
        defaultDomain: formValue.defaultDomain,
        ownerId: formValue.ownerId,
        adminUsers: adminUsersArray,
        status: formValue.status as 'active' | 'completed' | 'archived'
      };

      if (this.currentMode() === 'create') {
        await this.createProject(projectData);
      } else if (this.currentMode() === 'edit' && this.selectedProject()) {
        await this.updateProject(this.selectedProject()!.id, projectData);
      }
      
      this.creatingProject.set(false);
      this.updatingProject.set(false);
      this.closeForm();
    }
  }

  async createProject(project: Omit<Schema['Project']['type'], 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Project.create({
        ...project,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await this.loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }

  async updateProject(id: string, updates: Omit<Partial<Schema['Project']['type']>, 'id' | 'ownerId' | 'createdAt'>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Project.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
      await this.loadProjects();
    } catch (error) {
      console.error('Error updating project:', error);
    }
  }
}

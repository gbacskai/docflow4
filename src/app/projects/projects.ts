import { Component, OnInit, signal, inject, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Projects implements OnInit {
  projects = signal<Array<Schema['Project']['type']>>([]);
  users = signal<Array<Schema['User']['type']>>([]);
  domains = signal<Array<Schema['Domain']['type']>>([]);
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  filteredUsers = signal<Array<Schema['User']['type']>>([]);
  loading = signal(true);
  loadingUsers = signal(false);
  loadingDomains = signal(false);
  searchingUsers = signal(false);
  showNewProjectForm = signal(false);
  creatingProject = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedProject = signal<Schema['Project']['type'] | null>(null);
  updatingProject = signal(false);
  showAdminUsersSidebar = signal(false);
  tempSelectedAdminUsers = signal<string[]>([]);
  userSearchQuery = signal<string>('');
  
  @ViewChild('userSearchInput') userSearchInput!: ElementRef<HTMLInputElement>;
  
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private searchTimeout: any = null;
  
  newProjectForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    defaultDomain: ['', [Validators.required]],
    ownerId: ['', [Validators.required]],
    adminUsers: [[]],
    status: ['active', [Validators.required]]
  });

  async ngOnInit() {
    await Promise.all([this.loadProjects(), this.loadUsers(), this.loadDomains(), this.loadDocumentTypes()]);
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

  async loadDocumentTypes() {
    try {
      const client = generateClient<Schema>();
      const { data } = await client.models.DocumentType.list();
      this.documentTypes.set(data.filter(docType => docType.isActive));
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
    }
  }

  getOwnerName(ownerId: string): string {
    const user = this.users().find(u => u.id === ownerId);
    if (!user) return 'Unknown User';
    
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.email || 'Unknown User';
  }

  getDomainName(domainId: string): string {
    const domain = this.domains().find(d => d.id === domainId);
    return domain ? domain.name : 'Unknown Domain';
  }

  getAdminUserNames(adminUserIds: (string | null)[] | null | undefined): string {
    if (!adminUserIds || adminUserIds.length === 0) return 'No admin users assigned';
    
    const validIds = adminUserIds.filter((id): id is string => id !== null);
    if (validIds.length === 0) return 'No admin users assigned';
    
    const names = validIds.map(id => {
      const user = this.users().find(u => u.id === id);
      if (!user) return 'Unknown User';
      
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      return fullName || user.email || 'Unknown User';
    });
    return names.join(', ');
  }

  // Debug method to check document types and their domain associations
  debugDocumentTypes() {
    console.log('=== DEBUG: Document Types and Domain Associations ===');
    console.log('Total document types:', this.documentTypes().length);
    console.log('Total domains:', this.domains().length);
    
    this.documentTypes().forEach(docType => {
      console.log(`Document Type: ${docType.name}`);
      console.log(`  - ID: ${docType.id}`);
      console.log(`  - Domain IDs: `, docType.domainIds);
      console.log(`  - Active: `, docType.isActive);
    });
    
    this.domains().forEach(domain => {
      console.log(`Domain: ${domain.name} (${domain.id})`);
      const associatedTypes = this.documentTypes().filter(dt => 
        dt.domainIds && dt.domainIds.filter(id => id !== null).includes(domain.id)
      );
      console.log(`  - Associated document types: `, associatedTypes.map(dt => dt.name));
    });
  }

  // Admin Users Sidebar Methods
  openAdminUsersSidebar() {
    const currentAdminUsers: string[] = this.newProjectForm.get('adminUsers')?.value || [];
    console.log('Opening admin users sidebar with current users:', currentAdminUsers);
    this.tempSelectedAdminUsers.set([...currentAdminUsers]);
    
    setTimeout(() => {
      this.filteredUsers.set(this.users());
    }, 0);
    
    this.showAdminUsersSidebar.set(true);
  }

  closeAdminUsersSidebar() {
    this.showAdminUsersSidebar.set(false);
    this.tempSelectedAdminUsers.set([]);
    this.userSearchQuery.set('');
    this.filteredUsers.set([]);
  }

  toggleAdminUserInSidebar(userId: string) {
    console.log('🔥 toggleAdminUserInSidebar called with userId:', userId);
    const currentTemp = this.tempSelectedAdminUsers();
    console.log('Before toggle:', currentTemp);
    
    let newTemp: string[];
    if (currentTemp.includes(userId)) {
      newTemp = currentTemp.filter(id => id !== userId);
      console.log('Removing admin user, new temp will be:', newTemp);
    } else {
      newTemp = [...currentTemp, userId];
      console.log('Adding admin user, new temp will be:', newTemp);
    }
    
    this.tempSelectedAdminUsers.set(newTemp);
    console.log('Signal updated - final temp state:', this.tempSelectedAdminUsers());
  }

  isAdminUserSelectedInSidebar(userId: string): boolean {
    return this.tempSelectedAdminUsers().includes(userId);
  }

  onUserItemClick(userId: string, userName: string) {
    console.log('🎯 Admin user item clicked:', userName, 'ID:', userId);
  }

  trackUserById(index: number, user: Schema['User']['type']): string {
    return user.id;
  }

  applyAdminUserSelection() {
    const tempAdminUsers = this.tempSelectedAdminUsers();
    console.log('Applying admin users:', tempAdminUsers);
    
    this.newProjectForm.patchValue({
      adminUsers: [...tempAdminUsers]
    });
    
    console.log('Form updated with admin users:', this.newProjectForm.get('adminUsers')?.value);
    this.closeAdminUsersSidebar();
  }

  cancelAdminUserSelection() {
    this.closeAdminUsersSidebar();
  }

  // Admin Users Search Methods
  getFilteredUsers() {
    return this.filteredUsers();
  }

  onUserSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value;
    
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    if (!query || query.trim() === '') {
      this.searchTimeout = setTimeout(() => {
        this.userSearchQuery.set('');
        this.filteredUsers.set(this.users());
        setTimeout(() => {
          if (this.userSearchInput) {
            this.userSearchInput.nativeElement.focus();
          }
        }, 0);
      }, 200);
      return;
    }
    
    this.searchTimeout = setTimeout(async () => {
      this.userSearchQuery.set(query);
      await this.searchUsers(query.trim());
    }, 1000);
  }

  async clearUserSearch() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.userSearchQuery.set('');
    this.filteredUsers.set(this.users());
    
    if (this.userSearchInput) {
      this.userSearchInput.nativeElement.value = '';
      this.userSearchInput.nativeElement.focus();
    }
  }

  async searchUsers(query: string) {
    try {
      this.searchingUsers.set(true);
      console.log('🔍 Searching users with query:', query);
      
      const searchInputFocused = this.userSearchInput?.nativeElement === document.activeElement;
      
      // Get all users and filter client-side for case-insensitive search
      const allUsers = this.users();
      const queryLower = query.toLowerCase();
      
      const filteredData = allUsers.filter(user => {
        const firstNameMatch = user.firstName && user.firstName.toLowerCase().includes(queryLower);
        const lastNameMatch = user.lastName && user.lastName.toLowerCase().includes(queryLower);
        const emailMatch = user.email && user.email.toLowerCase().includes(queryLower);
        const fullNameMatch = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(queryLower);
        
        return firstNameMatch || lastNameMatch || emailMatch || fullNameMatch;
      });
      
      console.log('🔍 Filtered user results:', filteredData.length);
      this.filteredUsers.set(filteredData);
      
      if (searchInputFocused && this.userSearchInput) {
        setTimeout(() => {
          this.userSearchInput.nativeElement.focus();
        }, 0);
      }
      
    } catch (error) {
      console.error('Error searching users:', error);
      this.filteredUsers.set(this.users());
      
      if (this.userSearchInput) {
        setTimeout(() => {
          this.userSearchInput.nativeElement.focus();
        }, 0);
      }
    } finally {
      this.searchingUsers.set(false);
    }
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
      // Debug associations
      this.debugDocumentTypes();
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
      adminUsers: project.adminUsers || [],
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
      adminUsers: project.adminUsers || [],
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
      const adminUsersArray = Array.isArray(formValue.adminUsers) 
        ? formValue.adminUsers
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
      
      // Create the project
      const { data: createdProject } = await client.models.Project.create({
        ...project,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (createdProject) {
        console.log('Project created:', createdProject);
        console.log('Selected domain ID:', project.defaultDomain);
        console.log('Available document types:', this.documentTypes());
        
        // Find all document types associated with the selected domain
        const associatedDocumentTypes = this.documentTypes().filter(docType => {
          console.log(`Checking docType: ${docType.name}, domainIds:`, docType.domainIds);
          return docType.domainIds && docType.domainIds.filter(id => id !== null).includes(project.defaultDomain);
        });

        console.log('Associated document types found:', associatedDocumentTypes);

        if (associatedDocumentTypes.length > 0) {
          // Create documents for each associated document type
          const documentPromises = associatedDocumentTypes.map(docType => {
            console.log(`Creating document for type: ${docType.name}`);
            return client.models.Document.create({
              projectId: createdProject.id,
              documentType: docType.id,
              status: 'requested',
              assignedProviders: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          });

          // Wait for all documents to be created
          await Promise.all(documentPromises);
          
          console.log(`Successfully created ${associatedDocumentTypes.length} documents for project: ${createdProject.name}`);
        } else {
          console.log('No document types associated with domain:', project.defaultDomain);
        }
      }

      await this.loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
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

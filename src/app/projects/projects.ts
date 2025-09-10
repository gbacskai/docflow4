import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { UserDataService } from '../services/user-data.service';
import { VersionedDataService } from '../services/versioned-data.service';
import { ChatService } from '../services/chat.service';
import { DynamicFormService } from '../services/dynamic-form.service';
import { ProjectOperationsService } from '../services/project-operations.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Projects implements OnInit, OnDestroy {
  projects = signal<Array<Schema['Project']['type']>>([]);
  filteredProjects = signal<Array<Schema['Project']['type']>>([]);
  searchFilteredProjects = signal<Array<Schema['Project']['type']>>([]);
  projectSearchQuery = signal<string>('');
  showAllProjects = signal<boolean>(false); // false = show only active, true = show all
  users = signal<Array<Schema['User']['type']>>([]);
  workflows = signal<Array<Schema['Workflow']['type']>>([]);
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  filteredUsers = signal<Array<Schema['User']['type']>>([]);
  loading = signal(true);
  loadingUsers = signal(false);
  searchingUsers = signal(false);
  showNewProjectForm = signal(false);
  creatingProject = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedProject = signal<Schema['Project']['type'] | null>(null);
  updatingProject = signal(false);
  showAdminUsersSidebar = signal(false);
  tempSelectedAdminUsers = signal<string[]>([]);
  showOwnerSidebar = signal(false);
  tempSelectedOwner = signal<string>('');
  originalOwner = signal<string>(''); // Track original owner for confirmation
  ownerSearchQuery = signal<string>('');
  filteredOwnerUsers = signal<Array<Schema['User']['type']>>([]);
  searchingOwnerUsers = signal(false);
  userSearchQuery = signal<string>('');
  
  @ViewChild('userSearchInput') userSearchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('ownerSearchInput') ownerSearchInput!: ElementRef<HTMLInputElement>;
  
  private fb = inject(FormBuilder);
  private versionedDataService = inject(VersionedDataService);
  private authService = inject(AuthService);
  private userDataService = inject(UserDataService);
  private chatService = inject(ChatService);
  private dynamicFormService = inject(DynamicFormService);
  private projectOperationsService = inject(ProjectOperationsService);
  private router = inject(Router);
  private searchTimeout: any = null;
  private projectSearchTimeout: any = null;
  private ownerSearchTimeout: any = null;
  
  newProjectForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    ownerId: ['', [Validators.required]],
    adminUsers: [[]],
    workflowId: ['', [Validators.required]],
    status: ['active', [Validators.required]]
  });

  async ngOnInit() {
    await Promise.all([this.loadProjects(), this.loadUsers(), this.loadDocumentTypes(), this.loadWorkflows()]);
    
    // Wait for user data to be loaded and then reapply filtering
    const checkUserDataAndFilter = () => {
      if (!this.userDataService.loading()) {
        this.applyProjectFiltering();
      } else {
        setTimeout(checkUserDataAndFilter, 500);
      }
    };
    
    checkUserDataAndFilter();
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.projectSearchTimeout) {
      clearTimeout(this.projectSearchTimeout);
    }
    if (this.ownerSearchTimeout) {
      clearTimeout(this.ownerSearchTimeout);
    }
  }

  async loadProjects() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('Project');
      const data = result.success ? result.data || [] : [];
      this.projects.set(data);
      this.applyProjectFiltering();
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects.set([]);
      this.filteredProjects.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private applyProjectFiltering() {
    const allProjects = this.projects();
    let projectsToFilter = allProjects;
    
    // Apply status filter first (Active vs All)
    if (!this.showAllProjects()) {
      projectsToFilter = allProjects.filter(project => project.status === 'active');
    }
    
    // If user is admin, show filtered projects (by status)
    if (this.userDataService.isCurrentUserAdmin()) {
      this.filteredProjects.set(projectsToFilter);
      this.applySearch(); // Apply search filter after permission filtering
      return;
    }
    
    // For non-admin users, only show projects where they are owner or admin
    const currentUser = this.userDataService.getCurrentUserData();
    if (!currentUser?.id) {
      this.filteredProjects.set([]);
      this.searchFilteredProjects.set([]);
      return;
    }
    
    const userAccessibleProjects = projectsToFilter.filter(project => {
      // User is the owner
      const isOwner = project.ownerId === currentUser.id;
      
      // User is in adminUsers array
      const isAdmin = project.adminUsers ? project.adminUsers.includes(currentUser.id) : false;
      
      return isOwner || isAdmin;
    });
    
    this.filteredProjects.set(userAccessibleProjects);
    this.applySearch(); // Apply search filter after permission filtering
  }

  isCurrentUserAdmin(): boolean {
    return this.userDataService.isCurrentUserAdmin();
  }

  canUserEditProject(project: Schema['Project']['type']): boolean {
    // Admin users can edit any project
    if (this.userDataService.isCurrentUserAdmin()) {
      return true;
    }
    
    // Project owner can edit
    const currentUser = this.userDataService.getCurrentUserData();
    if (!currentUser?.id) {
      return false;
    }
    
    const isOwner = project.ownerId === currentUser.id;
    const isProjectAdmin = project.adminUsers ? project.adminUsers.includes(currentUser.id) : false;
    
    return isOwner || isProjectAdmin;
  }

  // Project search functionality
  onProjectSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value.toLowerCase().trim();
    this.projectSearchQuery.set(query);
    
    if (this.projectSearchTimeout) {
      clearTimeout(this.projectSearchTimeout);
    }

    this.projectSearchTimeout = setTimeout(() => {
      this.applySearch();
    }, 300);
  }

  applySearch() {
    const query = this.projectSearchQuery();
    const projectsToFilter = this.filteredProjects();
    
    if (!query) {
      this.searchFilteredProjects.set(projectsToFilter);
    } else {
      const filtered = projectsToFilter.filter(project =>
        project.name?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      );
      this.searchFilteredProjects.set(filtered);
    }
  }

  clearProjectSearch() {
    this.projectSearchQuery.set('');
    this.searchFilteredProjects.set(this.filteredProjects());
  }

  toggleProjectFilter() {
    this.showAllProjects.set(!this.showAllProjects());
    this.applyProjectFiltering();
  }

  getFilterButtonText(): string {
    return this.showAllProjects() ? 'Active' : 'All';
  }

  async loadUsers() {
    try {
      this.loadingUsers.set(true);
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('User');
      const data = result.success ? result.data || [] : [];
      this.users.set(data);
    } catch (error) {
      console.error('Error loading users:', error);
      this.users.set([]);
    } finally {
      this.loadingUsers.set(false);
    }
  }


  async loadDocumentTypes() {
    try {
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('DocumentType');
      const data = result.success ? result.data || [] : [];
      this.documentTypes.set(data.filter(docType => docType.isActive));
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
    }
  }

  async loadWorkflows() {
    try {
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('Workflow');
      const data = result.success ? result.data || [] : [];
      this.workflows.set(data.filter(workflow => workflow.isActive));
    } catch (error) {
      console.error('Error loading workflows:', error);
      this.workflows.set([]);
    }
  }

  getOwnerName(ownerId: string): string {
    const user = this.users().find(u => u.id === ownerId);
    if (!user) return 'Unknown User';
    
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.email || 'Unknown User';
  }

  getOwnerEmail(ownerId: string): string {
    const user = this.users().find(u => u.id === ownerId);
    return user ? user.email : '';
  }

  getWorkflowName(workflowId: string | null | undefined): string {
    if (!workflowId) return 'No workflow assigned';
    const workflow = this.workflows().find(w => w.id === workflowId);
    return workflow ? workflow.name : 'Unknown workflow';
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

  // Debug method to check document types
  debugDocumentTypes() {
    console.log('=== DEBUG: Document Types ===');
    console.log('Total document types:', this.documentTypes().length);
    
    this.documentTypes().forEach(docType => {
      console.log(`Document Type: ${docType.name}`);
      console.log(`  - ID: ${docType.id}`);
      console.log(`  - Active: `, docType.isActive);
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

  // Owner Selection Sidebar Methods
  openOwnerSidebar() {
    const currentOwnerId = this.newProjectForm.get('ownerId')?.value || '';
    this.tempSelectedOwner.set(currentOwnerId);
    this.originalOwner.set(currentOwnerId);
    
    // Initialize filtered owner users with all users
    setTimeout(() => {
      this.filteredOwnerUsers.set(this.users());
    }, 0);
    
    this.showOwnerSidebar.set(true);
  }

  closeOwnerSidebar() {
    this.showOwnerSidebar.set(false);
    this.tempSelectedOwner.set('');
    this.originalOwner.set('');
    this.ownerSearchQuery.set('');
    this.filteredOwnerUsers.set([]);
  }

  selectOwnerInSidebar(userId: string) {
    this.tempSelectedOwner.set(userId);
  }

  isOwnerSelectedInSidebar(userId: string): boolean {
    return this.tempSelectedOwner() === userId;
  }

  async applyOwnerSelection() {
    const newOwnerId = this.tempSelectedOwner();
    const originalOwnerId = this.originalOwner();
    
    // If owner is being changed, show confirmation
    if (newOwnerId !== originalOwnerId && originalOwnerId && newOwnerId) {
      const newOwnerName = this.getOwnerName(newOwnerId);
      const originalOwnerName = this.getOwnerName(originalOwnerId);
      
      const confirmed = confirm(
        `Are you sure you want to change the project owner from "${originalOwnerName}" to "${newOwnerName}"?`
      );
      
      if (!confirmed) {
        return; // Cancel the change
      }
    }
    
    // Apply the selection
    this.newProjectForm.patchValue({
      ownerId: newOwnerId
    });
    
    this.closeOwnerSidebar();
  }

  cancelOwnerSelection() {
    this.closeOwnerSidebar();
  }

  // Owner Search Methods
  onOwnerSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value;
    
    if (this.ownerSearchTimeout) {
      clearTimeout(this.ownerSearchTimeout);
    }
    
    if (!query || query.trim() === '') {
      this.ownerSearchTimeout = setTimeout(() => {
        this.ownerSearchQuery.set('');
        this.filteredOwnerUsers.set(this.users());
        setTimeout(() => {
          if (this.ownerSearchInput) {
            this.ownerSearchInput.nativeElement.focus();
          }
        }, 0);
      }, 200);
      return;
    }
    
    this.ownerSearchTimeout = setTimeout(async () => {
      this.ownerSearchQuery.set(query);
      await this.searchOwnerUsers(query.trim());
    }, 300);
  }

  async clearOwnerSearch() {
    if (this.ownerSearchTimeout) {
      clearTimeout(this.ownerSearchTimeout);
    }
    
    this.ownerSearchQuery.set('');
    this.filteredOwnerUsers.set(this.users());
    
    if (this.ownerSearchInput) {
      this.ownerSearchInput.nativeElement.value = '';
      this.ownerSearchInput.nativeElement.focus();
    }
  }

  async searchOwnerUsers(query: string) {
    try {
      this.searchingOwnerUsers.set(true);
      
      const searchInputFocused = this.ownerSearchInput?.nativeElement === document.activeElement;
      
      // Filter users client-side for case-insensitive search
      const allUsers = this.users();
      const queryLower = query.toLowerCase();
      
      const filteredData = allUsers.filter(user => {
        const firstNameMatch = user.firstName && user.firstName.toLowerCase().includes(queryLower);
        const lastNameMatch = user.lastName && user.lastName.toLowerCase().includes(queryLower);
        const emailMatch = user.email && user.email.toLowerCase().includes(queryLower);
        const fullNameMatch = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(queryLower);
        
        return firstNameMatch || lastNameMatch || emailMatch || fullNameMatch;
      });
      
      this.filteredOwnerUsers.set(filteredData);
      
      if (searchInputFocused && this.ownerSearchInput) {
        setTimeout(() => {
          this.ownerSearchInput.nativeElement.focus();
        }, 0);
      }
      
    } catch (error) {
      console.error('Error searching owner users:', error);
      this.filteredOwnerUsers.set(this.users());
      
      if (this.ownerSearchInput) {
        setTimeout(() => {
          this.ownerSearchInput.nativeElement.focus();
        }, 0);
      }
    } finally {
      this.searchingOwnerUsers.set(false);
    }
  }

  getFilteredOwnerUsers() {
    return this.filteredOwnerUsers();
  }

  trackOwnerUserById(index: number, user: Schema['User']['type']): string {
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
            ownerId: project.ownerId,
      adminUsers: project.adminUsers || [],
      workflowId: project.workflowId || '',
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
            ownerId: project.ownerId,
      adminUsers: project.adminUsers || [],
      workflowId: project.workflowId || '',
      status: project.status
    });
    
    // Disable form in view mode
    if (this.currentMode() === 'view') {
      this.newProjectForm.disable();
    }
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

      const result = await this.versionedDataService.createVersionedRecord('User', {
        data: {
          email: currentUser.email,
          firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
          lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1),
          userType: 'client',
          status: 'active',
        }
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create user');
      }
      
      const data = result.data;

      // Refresh users list
      await this.loadUsers();
      
      return data?.id;
    } catch (error) {
      console.error('Error creating user:', error);
      return undefined;
    }
  }

  async onSubmitProject() {
    console.log('Form submission attempted');
    console.log('Form valid:', this.newProjectForm.valid);
    console.log('Form value:', this.newProjectForm.value);
    console.log('Form errors:', this.newProjectForm.errors);
    
    // Check individual field errors
    Object.keys(this.newProjectForm.controls).forEach(key => {
      const control = this.newProjectForm.get(key);
      if (control?.errors) {
        console.log(`Field ${key} errors:`, control.errors);
      }
    });
    
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
        identifier: formValue.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'),
        description: formValue.description,
                ownerId: formValue.ownerId,
        adminUsers: adminUsersArray,
        workflowId: formValue.workflowId,
        status: formValue.status as 'active' | 'completed' | 'archived'
      };

      console.log('Project data to create:', projectData);

      try {
        if (this.currentMode() === 'create') {
          await this.createProject(projectData as any);
        } else if (this.currentMode() === 'edit' && this.selectedProject()) {
          await this.updateProject(this.selectedProject()!.id, projectData);
        }
      } catch (error) {
        console.error('Error during project operation:', error);
        alert('Failed to save project: ' + (error as Error).message);
      }
      
      this.creatingProject.set(false);
      this.updatingProject.set(false);
      this.closeForm();
    } else {
      console.log('Form is invalid, cannot submit');
      // Mark all fields as touched to show validation errors
      Object.keys(this.newProjectForm.controls).forEach(key => {
        this.newProjectForm.get(key)?.markAsTouched();
      });
    }
  }

  async createProject(project: Omit<Schema['Project']['type'], 'id' | 'version' | 'updatedAt'>) {
    try {
      console.log('Creating project with data:', project);
      const client = generateClient<Schema>();
      
      // Create the project
      const projectResult = await this.versionedDataService.createVersionedRecord('Project', {
        data: {
          ...project
        }
      });
      
      if (!projectResult.success) {
        throw new Error(projectResult.error || 'Failed to create project');
      }
      
      const createdProject = projectResult.data;
      
      console.log('Project creation result:', createdProject);

      if (createdProject) {
        console.log('Project created:', createdProject);
        console.log('Available document types:', this.documentTypes());
        
        // Get document types that are referenced in the selected workflow's rules
        const selectedWorkflow = this.workflows().find(w => w.id === this.newProjectForm.value.workflowId);
        
        console.log('🔍 Selected workflow:', selectedWorkflow);
        console.log('🔍 Workflow rules:', selectedWorkflow?.rules);
        console.log('🔍 Available document types:', this.documentTypes().map(dt => ({ name: dt.name, identifier: dt.identifier, id: dt.id })));
        
        const associatedDocumentTypes = this.getDocumentTypesFromWorkflow(selectedWorkflow);

        console.log('📋 Associated document types found:', associatedDocumentTypes.length);
        console.log('📋 Associated document types details:', associatedDocumentTypes.map(dt => ({ name: dt.name, identifier: dt.identifier, id: dt.id })));

        // FALLBACK: If no workflow-specific document types found, use all active document types
        const finalDocumentTypes = associatedDocumentTypes.length > 0 
          ? associatedDocumentTypes 
          : this.documentTypes().filter(dt => dt.isActive !== false);
          
        if (finalDocumentTypes !== associatedDocumentTypes) {
          console.log('⚠️  No workflow-specific document types found, falling back to all active document types');
          console.log('📋 Using all active document types:', finalDocumentTypes.map(dt => ({ name: dt.name, identifier: dt.identifier, id: dt.id })));
        }

        if (finalDocumentTypes.length > 0) {
          // Create documents for each document type with validation
          const documentPromises = finalDocumentTypes.map(async (docType: Schema['DocumentType']['type']) => {
            console.log(`Creating document for type: ${docType.name}`);
            
            try {
              // Parse document type definition to create initial form data
              let initialFormData: any = {};
              if (docType.definition) {
                try {
                  const definition = JSON.parse(docType.definition);
                  if (definition.fields && Array.isArray(definition.fields)) {
                    // Initialize form data with default values from definition
                    definition.fields.forEach((field: any) => {
                      if (field.defaultValue !== undefined) {
                        initialFormData[field.name] = field.defaultValue;
                      } else if (field.type === 'boolean' || field.type === 'checkbox') {
                        initialFormData[field.name] = false;
                      } else {
                        // Leave other fields undefined to trigger validation rules
                        initialFormData[field.name] = undefined;
                      }
                    });
                  }
                } catch (parseError) {
                  console.warn(`Failed to parse definition for ${docType.name}:`, parseError);
                }
              }
              
              // Create a temporary FormGroup for validation
              const tempForm = this.fb.group(initialFormData);
              
              // Execute validation rules if they exist
              if (docType.validationRules) {
                try {
                  console.log(`Executing validation rules for ${docType.name}...`);
                  
                  // Parse validation rules (they're stored as text, not JSON)
                  const rulesText = docType.validationRules;
                  const rules = this.parseValidationRulesFromText(rulesText);
                  
                  // Apply validation rules to update form data
                  const updatedFormData = await this.applyValidationRules(rules, tempForm, initialFormData);
                  initialFormData = { ...initialFormData, ...updatedFormData };
                  
                  console.log(`Validation applied for ${docType.name}, final data:`, initialFormData);
                } catch (validationError) {
                  console.warn(`Validation failed for ${docType.name}:`, validationError);
                }
              }
              
              // Create the document with validated form data
              return this.versionedDataService.createVersionedRecord('Document', {
                data: {
                  projectId: createdProject.id,
                  documentType: docType.id,
                  formData: JSON.stringify(initialFormData),
                }
              });
            } catch (error) {
              console.error(`Error processing document for ${docType.name}:`, error);
              // Fallback to basic document creation
              return this.versionedDataService.createVersionedRecord('Document', {
                data: {
                  projectId: createdProject.id,
                  documentType: docType.id,
                }
              });
            }
          });

          // Wait for all documents to be created
          await Promise.all(documentPromises);
          
          console.log(`Successfully created ${finalDocumentTypes.length} documents for project: ${createdProject.name}`);
        } else {
          console.log('No document types found.');
        }
      }

      await this.loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  async updateProject(id: string, updates: Omit<Partial<Schema['Project']['type']>, 'id' | 'ownerId'>) {
    try {
      const result = await this.versionedDataService.updateVersionedRecord('Project', id, updates);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update project');
      }
      
      const updatedProject = result.data;
      console.log('Project updated:', updatedProject);

      // Check and create missing documents if workflow is assigned
      if (updatedProject && updatedProject.workflowId) {
        console.log('Checking for missing documents in updated project...');
        await this.ensureProjectDocuments(updatedProject);
      }
      
      await this.loadProjects();
    } catch (error) {
      console.error('Error updating project:', error);
    }
  }

  /**
   * Ensure all required documents exist for a project based on its workflow.
   * This method ONLY ADDS missing documents and NEVER updates existing ones.
   */
  async ensureProjectDocuments(project: Schema['Project']['type']) {
    try {
      console.log('📋 Ensuring documents for project:', project.name);
      console.log('📋 This operation will ONLY ADD missing documents, never update existing ones');
      
      // Get workflow-specific document types
      const selectedWorkflow = this.workflows().find(w => w.id === project.workflowId);
      const requiredDocumentTypes = this.getDocumentTypesFromWorkflow(selectedWorkflow);
      
      console.log('📋 Required document types:', requiredDocumentTypes.map(dt => dt.name));
      
      if (requiredDocumentTypes.length === 0) {
        console.log('📋 No document types required by workflow');
        return;
      }

      // Get existing documents for this project
      const client = generateClient<Schema>();
      const allDocumentsResult = await client.models.Document.list();
      const existingDocuments = allDocumentsResult.data?.filter((doc: any) => doc.projectId === project.id) || [];
      console.log('📋 Existing documents:', existingDocuments.map((doc: any) => doc.documentType));

      // Find missing document types  
      const existingDocumentTypes = new Set(existingDocuments.map((doc: any) => doc.documentType));
      const missingDocumentTypes = requiredDocumentTypes.filter(docType => 
        !existingDocumentTypes.has(docType.id)
      );

      console.log('📋 Missing document types:', missingDocumentTypes.map(dt => dt.name));

      if (missingDocumentTypes.length === 0) {
        console.log('📋 All required documents already exist - no new documents will be created');
        return;
      }

      // Create ONLY the missing documents (existing documents are left untouched)
      console.log(`📋 Will create ${missingDocumentTypes.length} new documents (${existingDocuments.length} existing documents will remain unchanged)`);
      
      const documentPromises = missingDocumentTypes.map(async (docType: Schema['DocumentType']['type']) => {
        console.log(`📋 Creating NEW document for type: ${docType.name}`);
        
        try {
          // Parse document type definition to create initial form data
          let initialFormData: any = {};
          if (docType.definition) {
            try {
              const definition = JSON.parse(docType.definition);
              if (definition.fields && Array.isArray(definition.fields)) {
                // Initialize form data with default values from definition
                definition.fields.forEach((field: any) => {
                  if (field.defaultValue !== undefined) {
                    initialFormData[field.name] = field.defaultValue;
                  } else if (field.type === 'boolean' || field.type === 'checkbox') {
                    initialFormData[field.name] = false;
                  } else {
                    initialFormData[field.name] = undefined;
                  }
                });
              }
            } catch (parseError) {
              console.warn(`Failed to parse definition for ${docType.name}:`, parseError);
            }
          }
          
          const documentResult = await this.versionedDataService.createVersionedRecord('Document', {
            data: {
              projectId: project.id,
              documentType: docType.id,
              formData: JSON.stringify(initialFormData),
            }
          });

          console.log(`📄 Document creation result for ${docType.name}:`, {
            success: documentResult.success,
            data: documentResult.data,
            error: documentResult.error,
            fullResult: documentResult
          });

          if (documentResult.success) {
            console.log(`✅ Created missing document: ${docType.name}`);
            return documentResult.data;
          } else {
            console.error(`❌ Failed to create document for ${docType.name}:`, documentResult.error);
            return null;
          }
        } catch (error) {
          console.error(`❌ Error creating document for ${docType.name}:`, error);
          return null;
        }
      });

      // Wait for all missing documents to be created
      const createdDocuments = await Promise.all(documentPromises);
      
      console.log('📋 Raw creation results details:');
      createdDocuments.forEach((doc, index) => {
        console.log(`  [${index}]:`, {
          result: doc,
          type: typeof doc,
          isNull: doc === null,
          isUndefined: doc === undefined,
          isTruthy: !!doc,
          stringified: JSON.stringify(doc, null, 2)
        });
      });
      
      const successfullyCreated = createdDocuments.filter(doc => doc !== null && doc !== undefined);
      
      console.log(`📋 Document creation results:`, {
        attempted: missingDocumentTypes.length,
        succeeded: successfullyCreated.length,
        failed: createdDocuments.length - successfullyCreated.length
      });
      
      console.log(`📋 Document operation completed for project: ${project.name}`);
      console.log(`📋 ✅ Created: ${successfullyCreated.length} new documents`);
      console.log(`📋 🔒 Preserved: ${existingDocuments.length} existing documents (untouched)`);
      console.log(`📋 Summary: Only new documents were added, existing documents remain unchanged`);
      
      // No need to reload documents in projects component
      // Documents will be automatically available when the documents component loads
      
    } catch (error) {
      console.error('❌ Error ensuring project documents:', error);
    }
  }

  async openProjectChat(project: Schema['Project']['type']) {
    try {
      console.log('🗣️ Opening chat for project:', project.name);
      console.log('🗣️ Project data:', project);
      
      // Get the current user's ID for chat (using database User ID, not Cognito ID)
      const currentUserData = this.userDataService.getCurrentUserData();
      const currentChatUserId = currentUserData?.id;
      console.log('🗣️ Current user data for chat:', currentUserData);
      console.log('🗣️ Current user ID for chat:', currentChatUserId);
      
      if (!currentChatUserId) {
        console.error('❌ No current user ID found - cannot create chat room');
        alert('Unable to create chat room - user not found. Please try logging in again.');
        return;
      }
      
      // Create project chat room with all admin users
      const adminUsers = project.adminUsers?.filter(id => id !== null) as string[] || [];
      const allParticipants = [project.ownerId, ...adminUsers, currentChatUserId]
        .filter((id): id is string => id !== null && id !== undefined) // Type-safe filter
        .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates
      
      console.log('🗣️ Participants for chat room:', allParticipants);
      
      // First check if a chat room already exists for this project
      console.log('🔍 Checking for existing chat room...');
      let chatRoom = await this.chatService.findExistingProjectChatRoom(project.id);
      
      if (chatRoom) {
        console.log('✅ Using existing chat room:', chatRoom.title);
        // Ensure current user is added as participant if not already included
        chatRoom = await this.chatService.ensureUserInChatRoom(chatRoom, allParticipants);
      } else {
        console.log('🆕 Creating new chat room for project');
        chatRoom = await this.chatService.createProjectChatRoom({
          projectId: project.id,
          projectName: project.name,
          roomType: 'project',
          title: `${project.name} Chat`,
          description: `Project discussion for ${project.name}`,
          adminUsers: allParticipants,
          providerUsers: []
        });
        
        console.log('✅ Chat room created successfully:', chatRoom);
        console.log('✅ Chat room ID:', chatRoom.id);
      }
      
      // Navigate to chat with the specific room
      console.log('🧭 Navigating to chat with room ID:', chatRoom.id);
      this.router.navigate(['/chat'], { 
        queryParams: { 
          room: chatRoom.id,
          from: 'projects'
        } 
      });
      
    } catch (error) {
      console.error('❌ Error creating project chat room:', error);
      console.error('❌ Error details:', error);
      alert(`Failed to create chat room: ${error}. Please try again.`);
    }
  }

  private parseValidationRulesFromText(rulesText: string): Array<{ validation: string, action: string }> {
    const rules: Array<{ validation: string, action: string }> = [];
    
    // Split by lines and parse each rule
    const lines = rulesText.split('\n').map(line => line.trim()).filter(line => line);
    
    for (const line of lines) {
      const match = line.match(/validation:\s*(.+?)\s+action:\s*(.+)/);
      if (match) {
        const [, validation, action] = match;
        rules.push({
          validation: validation.trim(),
          action: action.trim()
        });
      }
    }
    
    return rules;
  }

  private async applyValidationRules(
    rules: Array<{ validation: string, action: string }>, 
    formGroup: FormGroup, 
    initialData: any
  ): Promise<any> {
    const updatedData: any = {};
    
    try {
      // Use the DynamicFormService to evaluate validation rules
      for (const rule of rules) {
        const condition = rule.validation;
        const actions = rule.action;
        
        // Check if the validation condition is met
        const conditionMet = this.dynamicFormService.evaluateCondition(condition, formGroup, {});
        
        if (conditionMet) {
          console.log(`✅ Rule condition met: ${condition} -> ${actions}`);
          
          // Parse and apply actions
          const actionUpdates = this.parseValidationActions(actions);
          Object.assign(updatedData, actionUpdates);
          
          // Update the FormGroup with new values for subsequent rule evaluations
          Object.keys(actionUpdates).forEach(key => {
            if (formGroup.get(key)) {
              formGroup.get(key)?.setValue(actionUpdates[key]);
            } else {
              formGroup.addControl(key, this.fb.control(actionUpdates[key]));
            }
          });
        } else {
          console.log(`❌ Rule condition not met: ${condition}`);
        }
      }
    } catch (error) {
      console.error('Error applying validation rules:', error);
    }
    
    return updatedData;
  }

  private parseValidationActions(actionsText: string): any {
    const updates: any = {};
    
    // Parse actions like "status = 'queued', files.hidden = true"
    const actionParts = actionsText.split(',').map(part => part.trim());
    
    for (const actionPart of actionParts) {
      const assignmentMatch = actionPart.match(/(\w+(?:\.\w+)?)\s*=\s*(.+)/);
      if (assignmentMatch) {
        const [, fieldPath, value] = assignmentMatch;
        
        // Handle simple field assignments (ignore complex field.property for now)
        if (!fieldPath.includes('.')) {
          let parsedValue: any = value.trim() as any;
          
          // Remove quotes from string values
          if ((parsedValue.startsWith('"') && parsedValue.endsWith('"')) ||
              (parsedValue.startsWith("'") && parsedValue.endsWith("'"))) {
            parsedValue = parsedValue.slice(1, -1);
          } else if (parsedValue === 'true') {
            parsedValue = true;
          } else if (parsedValue === 'false') {
            parsedValue = false;
          } else if (!isNaN(Number(parsedValue))) {
            parsedValue = Number(parsedValue);
          }
          
          updates[fieldPath] = parsedValue;
        }
      }
    }
    
    return updates;
  }

  /**
   * Extract document types that are referenced in a workflow's rules
   */
  getDocumentTypesFromWorkflow(workflow?: Schema['Workflow']['type'] | null): Array<Schema['DocumentType']['type']> {
    if (!workflow || !workflow.rules || workflow.rules.length === 0) {
      console.log('No workflow or workflow rules found, returning empty array');
      return [];
    }

    const docTypeNames = new Set<string>();
    
    // Extract document type names from workflow rules
    workflow.rules.forEach((ruleString: any) => {
      try {
        const rule = typeof ruleString === 'string' ? JSON.parse(ruleString) : ruleString;
        const validation = rule.validation || '';
        const action = rule.action || '';
        
        // Extract document types from validation and action rules
        this.extractDocTypeNamesFromText(validation, docTypeNames);
        this.extractDocTypeNamesFromText(action, docTypeNames);
      } catch (error) {
        console.error('Error parsing workflow rule:', ruleString, error);
      }
    });

    console.log('Document type names extracted from workflow:', Array.from(docTypeNames));

    // Find matching DocumentType objects from the available document types
    const matchedDocTypes = this.documentTypes().filter(docType => {
      const isActive = docType.isActive;
      
      // Try multiple matching strategies, prioritizing identifier
      let isReferenced = false;
      let matchedBy = '';
      
      // Strategy 1: Match by identifier first (primary matching method)
      if (docType.identifier && docTypeNames.has(docType.identifier)) {
        isReferenced = true;
        matchedBy = 'identifier exact';
      }
      
      // Strategy 2: Normalize identifier and compare (remove spaces, lowercase)
      if (!isReferenced && docType.identifier) {
        const normalizedIdentifier = docType.identifier.replace(/\s+/g, '').toLowerCase();
        
        for (const extractedName of docTypeNames) {
          const normalizedExtracted = extractedName.replace(/\s+/g, '').toLowerCase();
          if (normalizedExtracted === normalizedIdentifier) {
            isReferenced = true;
            matchedBy = 'identifier normalized';
            console.log(`✅ Matched "${docType.name}" (identifier: "${docType.identifier}") with extracted "${extractedName}" via identifier normalization`);
            break;
          }
        }
      }
      
      // Strategy 3: Fallback to name matching only if no identifier match
      if (!isReferenced) {
        if (docTypeNames.has(docType.name)) {
          isReferenced = true;
          matchedBy = 'name exact';
        }
      }
      
      // Strategy 4: Normalize name as final fallback
      if (!isReferenced) {
        const normalizedDocTypeName = docType.name.replace(/\s+/g, '').toLowerCase();
        
        for (const extractedName of docTypeNames) {
          const normalizedExtracted = extractedName.replace(/\s+/g, '').toLowerCase();
          if (normalizedExtracted === normalizedDocTypeName) {
            isReferenced = true;
            matchedBy = 'name normalized';
            console.log(`✅ Matched "${docType.name}" with extracted "${extractedName}" via name normalization`);
            break;
          }
        }
      }
      
      console.log(`Document type ${docType.name} (identifier: ${docType.identifier}): isActive=${isActive}, isReferenced=${isReferenced} (${matchedBy})`);
      return isActive && isReferenced;
    });

    console.log('Matched document types for workflow:', matchedDocTypes.map(dt => dt.name));
    return matchedDocTypes;
  }

  /**
   * Extract document type names from workflow rule text
   */
  private extractDocTypeNamesFromText(text: string, docTypeNames: Set<string>) {
    console.log(`🔍 Extracting doc types from text: "${text}"`);
    
    // Pattern: document.DocumentTypeName.status or DocumentTypeName.status
    const docTypePatterns = [
      /document\.([A-Z][a-zA-Z0-9]*)\./g,  // document.DocumentTypeName.status
      /([A-Z][a-zA-Z0-9]+)\.(?:status|value|hidden|disabled)/g  // DocumentTypeName.status
    ];
    
    docTypePatterns.forEach((pattern, index) => {
      console.log(`🔍 Trying pattern ${index + 1}: ${pattern}`);
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const docTypeName = match[1];
        console.log(`✅ Found document type name: "${docTypeName}" using pattern ${index + 1}`);
        docTypeNames.add(docTypeName);
      }
    });
  }
}

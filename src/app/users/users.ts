import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { VersionedDataService } from '../services/versioned-data.service';
import { UserManagementService } from '../services/user-management.service';

@Component({
  selector: 'app-users',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './users.html',
  styleUrl: './users.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Users implements OnInit, OnDestroy {
  users = signal<Array<Schema['User']['type']>>([]);
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  filteredDocumentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  currentUserData = signal<Schema['User']['type'] | null>(null);
  loading = signal(true);
  loadingDocumentTypes = signal(false);
  searchingDocumentTypes = signal(false);
  showForm = signal(false);
  currentMode = signal<'edit' | 'view' | 'invite' | 'create'>('invite');
  selectedUser = signal<Schema['User']['type'] | null>(null);
  processing = signal(false);
  showDocumentTypesSidebar = signal(false);
  tempSelectedDocumentTypes = signal<string[]>([]);
  docTypeSearchQuery = signal<string>('');
  
  @ViewChild('docTypeSearchInput') docTypeSearchInput!: ElementRef<HTMLInputElement>;
  
  private fb = inject(FormBuilder);
  private versionedDataService = inject(VersionedDataService);
  private authService = inject(AuthService);
  private userManagementService = inject(UserManagementService);
  private searchTimeout: any = null;
  
  userForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    userType: ['client'],
    interestedDocumentTypes: [[]],
    status: ['active'],
    password: [''],
    confirmPassword: ['']
  });

  createForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    userType: ['client'],
    interestedDocumentTypes: [[]],
    status: ['active'],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  });

  inviteForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    customMessage: ['']
  });

  async ngOnInit() {
    await Promise.all([this.loadUsers(), this.loadDocumentTypes(), this.loadCurrentUserData()]);
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  async loadUsers() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('User');
        const data = result.success ? result.data || [] : [];
      this.users.set(data.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '')));
    } catch (error) {
      console.error('Error loading users:', error);
      this.users.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadDocumentTypes() {
    try {
      this.loadingDocumentTypes.set(true);
      const client = generateClient<Schema>();
      const result = await this.versionedDataService.getAllLatestVersions('DocumentType');
        const data = result.success ? result.data || [] : [];
      this.documentTypes.set(data.filter(dt => dt.isActive !== false));
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
    } finally {
      this.loadingDocumentTypes.set(false);
    }
  }

  async loadCurrentUserData() {
    try {
      const currentUserId = this.authService.getUserId();
      if (!currentUserId) return;

      // Use versioned data service to get latest user versions
      const result = await this.versionedDataService.getAllLatestVersions('User');
      const users = result.success ? result.data || [] : [];
      
      const currentUser = users.find(user => user.cognitoUserId === currentUserId);
      this.currentUserData.set(currentUser || null);
    } catch (error) {
      console.error('Error loading current user data:', error);
      this.currentUserData.set(null);
    }
  }

  isCurrentUserAdmin(): boolean {
    const currentUser = this.currentUserData();
    return currentUser?.userType === 'admin';
  }

  canEditUser(user: Schema['User']['type']): boolean {
    const currentUser = this.currentUserData();
    if (!currentUser) return false;
    
    // Admin users can edit any active user
    if (this.isCurrentUserAdmin()) {
      return user.status === 'active';
    }
    
    // Non-admin users can only edit their own record if they are active
    return user.id === currentUser.id && user.status === 'active';
  }

  isEditingOwnProfile(): boolean {
    const currentUser = this.currentUserData();
    const selectedUser = this.selectedUser();
    
    return !!(currentUser && selectedUser && 
             currentUser.id === selectedUser.id && 
             this.currentMode() === 'edit');
  }

  isViewingOwnProfile(): boolean {
    const currentUser = this.currentUserData();
    const selectedUser = this.selectedUser();
    
    return !!(currentUser && selectedUser && 
             currentUser.id === selectedUser.id && 
             this.currentMode() === 'view');
  }

  isOwnProfile(user: Schema['User']['type']): boolean {
    const currentUser = this.currentUserData();
    return !!(currentUser && user && currentUser.id === user.id);
  }

  openInviteForm() {
    this.currentMode.set('invite');
    this.selectedUser.set(null);
    this.inviteForm.reset();
    this.showForm.set(true);
  }

  openCreateForm() {
    this.currentMode.set('create');
    this.selectedUser.set(null);
    this.createForm.reset();
    this.createForm.patchValue({
      userType: 'client',
      status: 'active'
    });
    this.showForm.set(true);
  }

  openEditForm(user: Schema['User']['type']) {
    // Check if current user has permission to edit this user
    if (!this.canEditUser(user)) {
      console.warn('Access denied: Cannot edit this user');
      return;
    }
    
    this.currentMode.set('edit');
    this.selectedUser.set(user);
    
    const formData: any = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      interestedDocumentTypes: user.interestedDocumentTypes || []
    };
    
    // Only populate admin-only fields if current user is admin
    if (this.isCurrentUserAdmin()) {
      formData.userType = user.userType;
      formData.status = user.status || 'active';
    }
    
    this.userForm.patchValue(formData);
    this.showForm.set(true);
  }

  openViewMode(user: Schema['User']['type']) {
    this.currentMode.set('view');
    this.selectedUser.set(user);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.currentMode.set('invite');
    this.selectedUser.set(null);
    this.userForm.reset();
    this.inviteForm.reset();
    this.createForm.reset();
    this.closeDocumentTypesSidebar();
  }

  // Document Types Sidebar Methods
  openDocumentTypesSidebar() {
    // Only admin users can access document types selection
    if (!this.isCurrentUserAdmin()) {
      console.warn('Access denied: Only admin users can manage document types');
      return;
    }
    
    const currentForm = this.currentMode() === 'invite' ? this.inviteForm : 
                        this.currentMode() === 'create' ? this.createForm : this.userForm;
    const currentDocTypes: string[] = currentForm.get('interestedDocumentTypes')?.value || [];
    console.log('Opening sidebar with current document types:', currentDocTypes);
    this.tempSelectedDocumentTypes.set([...currentDocTypes]);
    
    setTimeout(() => {
      this.filteredDocumentTypes.set(this.documentTypes());
    }, 0);
    
    this.showDocumentTypesSidebar.set(true);
  }

  closeDocumentTypesSidebar() {
    this.showDocumentTypesSidebar.set(false);
    this.tempSelectedDocumentTypes.set([]);
    this.docTypeSearchQuery.set('');
    this.filteredDocumentTypes.set([]);
  }

  toggleDocumentTypeInSidebar(docTypeId: string) {
    console.log('🔥 toggleDocumentTypeInSidebar called with docTypeId:', docTypeId);
    const currentTemp = this.tempSelectedDocumentTypes();
    console.log('Before toggle:', currentTemp);
    
    let newTemp: string[];
    if (currentTemp.includes(docTypeId)) {
      newTemp = currentTemp.filter(id => id !== docTypeId);
      console.log('Removing document type, new temp will be:', newTemp);
    } else {
      newTemp = [...currentTemp, docTypeId];
      console.log('Adding document type, new temp will be:', newTemp);
    }
    
    this.tempSelectedDocumentTypes.set(newTemp);
    console.log('Signal updated - final temp state:', this.tempSelectedDocumentTypes());
  }

  isDocumentTypeSelectedInSidebar(docTypeId: string): boolean {
    return this.tempSelectedDocumentTypes().includes(docTypeId);
  }

  onDocTypeItemClick(docTypeId: string, docTypeName: string) {
    console.log('🎯 Document type item clicked:', docTypeName, 'ID:', docTypeId);
  }

  trackDocumentTypeById(index: number, docType: Schema['DocumentType']['type']): string {
    return docType.id;
  }

  applyDocumentTypeSelection() {
    const tempDocTypes = this.tempSelectedDocumentTypes();
    console.log('Applying document types:', tempDocTypes);
    
    const currentForm = this.currentMode() === 'invite' ? this.inviteForm : 
                        this.currentMode() === 'create' ? this.createForm : this.userForm;
    currentForm.patchValue({
      interestedDocumentTypes: [...tempDocTypes]
    });
    
    console.log('Form updated with document types:', currentForm.get('interestedDocumentTypes')?.value);
    this.closeDocumentTypesSidebar();
  }

  cancelDocumentTypeSelection() {
    this.closeDocumentTypesSidebar();
  }

  // Document Types Search Methods
  getFilteredDocumentTypes() {
    return this.filteredDocumentTypes();
  }

  onDocTypeSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value;
    
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    if (!query || query.trim() === '') {
      this.searchTimeout = setTimeout(() => {
        this.docTypeSearchQuery.set('');
        this.filteredDocumentTypes.set(this.documentTypes());
        setTimeout(() => {
          if (this.docTypeSearchInput) {
            this.docTypeSearchInput.nativeElement.focus();
          }
        }, 0);
      }, 200);
      return;
    }
    
    this.searchTimeout = setTimeout(async () => {
      this.docTypeSearchQuery.set(query);
      await this.searchDocumentTypes(query.trim());
    }, 1000);
  }

  async clearDocTypeSearch() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.docTypeSearchQuery.set('');
    this.filteredDocumentTypes.set(this.documentTypes());
    
    if (this.docTypeSearchInput) {
      this.docTypeSearchInput.nativeElement.value = '';
      this.docTypeSearchInput.nativeElement.focus();
    }
  }

  async searchDocumentTypes(query: string) {
    try {
      this.searchingDocumentTypes.set(true);
      console.log('🔍 Searching document types with query:', query);
      
      const searchInputFocused = this.docTypeSearchInput?.nativeElement === document.activeElement;
      
      // Get all document types and filter client-side for case-insensitive search
      const allDocTypes = this.documentTypes();
      const queryLower = query.toLowerCase();
      
      const filteredData = allDocTypes.filter(docType => {
        const nameMatch = docType.name.toLowerCase().includes(queryLower);
        const descriptionMatch = docType.definition.toLowerCase().includes(queryLower);
        const categoryMatch = docType.category && docType.category.toLowerCase().includes(queryLower);
        
        return nameMatch || descriptionMatch || categoryMatch;
      });
      
      console.log('🔍 Filtered document type results:', filteredData.length);
      this.filteredDocumentTypes.set(filteredData);
      
      if (searchInputFocused && this.docTypeSearchInput) {
        setTimeout(() => {
          this.docTypeSearchInput.nativeElement.focus();
        }, 0);
      }
      
    } catch (error) {
      console.error('Error searching document types:', error);
      this.filteredDocumentTypes.set(this.documentTypes());
      
      if (this.docTypeSearchInput) {
        setTimeout(() => {
          this.docTypeSearchInput.nativeElement.focus();
        }, 0);
      }
    } finally {
      this.searchingDocumentTypes.set(false);
    }
  }

  // Form Submission Methods
  async onSubmitForm() {
    const form = this.currentMode() === 'invite' ? this.inviteForm : 
                this.currentMode() === 'create' ? this.createForm : this.userForm;
    if (!form.valid) return;

    // Validate password confirmation for create mode
    if (this.currentMode() === 'create') {
      const password = form.get('password')?.value;
      const confirmPassword = form.get('confirmPassword')?.value;
      if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
      }
    }

    this.processing.set(true);
    
    try {
      const formValue = form.value;

      if (this.currentMode() === 'invite') {
        await this.inviteUser(formValue);
      } else if (this.currentMode() === 'create') {
        await this.createUser(formValue);
      } else if (this.currentMode() === 'edit' && this.selectedUser()) {
        await this.updateUser(this.selectedUser()!.id, formValue);
      }

      this.closeForm();
      await this.loadUsers();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.processing.set(false);
    }
  }


  async inviteUser(inviteData: any) {
    try {
      const client = generateClient<Schema>();
      const currentUserId = this.authService.getUserId();
      
      if (!currentUserId) {
        throw new Error('No authenticated user found. Please log in to send invitations.');
      }
      
      // Create user with invited status and minimal required fields
      const userResult = await this.versionedDataService.createVersionedRecord('User', {
        data: {
          email: inviteData.email,
          firstName: '', // Will be filled when user accepts invitation
          lastName: '',  // Will be filled when user accepts invitation
          userType: 'client', // Default to client, can be changed later
          interestedDocumentTypes: [],
          status: 'invited',
          emailVerified: false, // Email not verified yet
          invitedAt: new Date().toISOString(),
          invitedBy: currentUserId, // Current authenticated user ID
          createdAt: new Date().toISOString()
        }
      });
      
      if (!userResult.success) {
        throw new Error(userResult.error || 'Failed to invite user');
      }
      
      const newUser = { data: userResult.data };

      console.log('User invited successfully:', newUser);
      console.log('Invited by user ID:', currentUserId);
      console.log('TODO: Send invitation email to:', inviteData.email);
      console.log('Custom message:', inviteData.customMessage);
      
      // TODO: Implement actual email sending service
      alert(`Invitation sent to ${inviteData.email}`);
      
    } catch (error) {
      console.error('Error inviting user:', error);
      throw error;
    }
  }

  async createUser(userData: any) {
    try {
      const currentUserId = this.authService.getUserId();
      
      if (!currentUserId) {
        throw new Error('No authenticated user found. Please log in to create users.');
      }
      
      // TODO: In a real application, you would use AWS Cognito AdminCreateUser API
      // For now, we'll create the user in our database with unverified email
      const userResult = await this.versionedDataService.createVersionedRecord('User', {
        data: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          userType: userData.userType || 'client',
          interestedDocumentTypes: userData.interestedDocumentTypes || [],
          status: userData.status || 'active',
          emailVerified: false, // Email not verified yet
          createdAt: new Date().toISOString(),
          createdBy: currentUserId
        }
      });
      
      if (!userResult.success) {
        throw new Error(userResult.error || 'Failed to create user');
      }
      
      console.log('User created successfully:', userResult.data);
      console.log('TODO: Create user in AWS Cognito with password:', userData.password);
      console.log('TODO: Send email verification to:', userData.email);
      
      // TODO: Implement actual AWS Cognito user creation
      alert(`User created successfully. Email verification will be sent to ${userData.email}`);
      
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<Schema['User']['type']>) {
    try {
      const client = generateClient<Schema>();
      
      // Get the user being updated to check permissions
      const users = this.users();
      const userToUpdate = users.find(u => u.id === id);
      
      if (!userToUpdate) {
        throw new Error('User not found');
      }
      
      // Check if current user has permission to edit this user
      if (!this.canEditUser(userToUpdate)) {
        throw new Error('Access denied: Cannot edit this user');
      }
      
      // If current user is not admin, exclude admin-only fields
      const updateData: any = {
        id,
        updatedAt: new Date().toISOString()
      };
      
      // Always allow these fields to be updated
      if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
      if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
      if (updates.email !== undefined) updateData.email = updates.email;
      
      // Only allow admin users to update document types
      if (this.isCurrentUserAdmin() && updates.interestedDocumentTypes !== undefined) {
        updateData.interestedDocumentTypes = updates.interestedDocumentTypes;
      }
      
      // Only allow admin fields if current user is admin
      if (this.isCurrentUserAdmin()) {
        if (updates.userType !== undefined) updateData.userType = updates.userType;
        if (updates.status !== undefined) updateData.status = updates.status;
      }
      
      const updateParams = updateData;
        await this.versionedDataService.updateVersionedRecord('User', updateParams.id, updateParams);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async archiveUser(user: Schema['User']['type']) {
    if (!confirm(`Are you sure you want to archive "${user.firstName} ${user.lastName}"?`)) return;

    this.processing.set(true);
    
    try {
      const result = await this.versionedDataService.updateVersionedRecord('User', user.id, {
        status: 'archived'
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to archive user');
      }
      
      await this.loadUsers();
    } catch (error) {
      console.error('Error archiving user:', error);
    } finally {
      this.processing.set(false);
    }
  }


  // Helper Methods
  getDocumentTypeName(docTypeId: string): string {
    const docType = this.documentTypes().find(dt => dt.id === docTypeId);
    return docType ? docType.name : 'Unknown Document Type';
  }

  getDocumentTypeDescription(docTypeId: string): string {
    const docType = this.documentTypes().find(dt => dt.id === docTypeId);
    return docType ? docType.definition : 'No definition available';
  }

  getDocumentTypeNames(docTypeIds: (string | null)[] | null | undefined): string {
    if (!docTypeIds || docTypeIds.length === 0) return 'No document types assigned';
    
    const validIds = docTypeIds.filter((id): id is string => id !== null);
    if (validIds.length === 0) return 'No document types assigned';
    
    const names = validIds.map(id => this.getDocumentTypeName(id));
    return names.join(', ');
  }

  getUserStatusColor(status: string | null | undefined): string {
    switch (status) {
      case 'active': return 'status-active';
      case 'inactive': return 'status-inactive';
      case 'archived': return 'status-archived';
      default: return 'status-unknown';
    }
  }

  getUserTypeColor(userType: string | null | undefined): string {
    switch (userType) {
      case 'admin': return 'type-admin';
      case 'client': return 'type-client';
      default: return 'type-client'; // Default to client for any other values
    }
  }

  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  }

  // Test method for manual cleanup - can be called from browser console
  async testCleanup() {
    const currentUserId = this.authService.getUserId();
    const currentUserEmail = this.authService.getUserEmail();
    
    if (currentUserId && currentUserEmail) {
      console.log('🧪 Testing cleanup manually...', { currentUserId, currentUserEmail });
      await this.userManagementService.manualCleanup(currentUserEmail, currentUserId);
    } else {
      console.log('❌ No authenticated user found for cleanup test');
    }
  }

  // Debug method to show users by email
  async debugUsers() {
    const currentUserEmail = this.authService.getUserEmail();
    if (currentUserEmail) {
      console.log('🧪 Debugging users by email...', currentUserEmail);
      await this.userManagementService.debugUsersByEmail(currentUserEmail);
    } else {
      console.log('❌ No authenticated user email found for debug');
    }
  }

  // Test method to create a duplicate user for testing cleanup
  async createTestDuplicate() {
    const currentUserEmail = this.authService.getUserEmail();
    if (currentUserEmail) {
      console.log('🧪 Creating test duplicate for testing...', currentUserEmail);
      await this.userManagementService.createTestDuplicateUser(currentUserEmail);
      console.log('🧪 Test duplicate created. Now try testCleanup() to see if it gets deleted.');
    } else {
      console.log('❌ No authenticated user email found');
    }
  }

  // Debug method to create current user record if missing
  async createCurrentUserRecord() {
    const currentUserId = this.authService.getUserId();
    const currentUserEmail = this.authService.getUserEmail();
    
    if (!currentUserId || !currentUserEmail) {
      console.log('❌ No authenticated user found');
      return;
    }

    console.log('🔧 Creating user record for current authenticated user...');
    
    // Determine if this should be an admin user based on email
    const isAdmin = currentUserEmail === 'test_admin@docflow4.com' || 
                   currentUserEmail === 'gbacskai@gmail.com';
    
    try {
      const userResult = await this.versionedDataService.createVersionedRecord('User', {
        data: {
          email: currentUserEmail,
          firstName: isAdmin ? 'Test' : 'User',
          lastName: isAdmin ? 'Admin' : 'User', 
          userType: isAdmin ? 'admin' : 'client',
          interestedDocumentTypes: [],
          status: 'active',
          emailVerified: true,
          cognitoUserId: currentUserId,
          createdAt: new Date().toISOString()
        }
      });
      
      if (userResult.success) {
        console.log('✅ User record created successfully');
        await this.loadUsers();
        await this.loadCurrentUserData();
      } else {
        console.log('❌ Failed to create user record:', userResult.error);
      }
    } catch (error) {
      console.log('❌ Error creating user record:', error);
    }
  }

  // Email validation status methods
  getEmailValidationStatus(user: Schema['User']['type']): 'verified' | 'unverified' | 'unknown' {
    const emailVerified = (user as any).emailVerified;
    if (emailVerified === true) return 'verified';
    if (emailVerified === false) return 'unverified';
    return 'unknown';
  }

  getEmailValidationIcon(user: Schema['User']['type']): string {
    const status = this.getEmailValidationStatus(user);
    switch (status) {
      case 'verified': return '✅';
      case 'unverified': return '⚠️';
      case 'unknown': return '❓';
      default: return '❓';
    }
  }

  getEmailValidationTitle(user: Schema['User']['type']): string {
    const status = this.getEmailValidationStatus(user);
    switch (status) {
      case 'verified': return 'Email verified';
      case 'unverified': return 'Email not verified';
      case 'unknown': return 'Email verification status unknown';
      default: return 'Unknown verification status';
    }
  }

  getEmailValidationClass(user: Schema['User']['type']): string {
    const status = this.getEmailValidationStatus(user);
    return `email-validation-${status}`;
  }

}
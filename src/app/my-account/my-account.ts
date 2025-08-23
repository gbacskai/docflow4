import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { AuthService } from '../services/auth.service';
import { UserDataService } from '../services/user-data.service';

@Component({
  selector: 'app-my-account',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './my-account.html',
  styleUrl: './my-account.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyAccount implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private userDataService = inject(UserDataService);
  private fb = inject(FormBuilder);
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  
  // Profile editing signals
  currentUserData = this.userDataService.currentUserData;
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  filteredDocumentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  loading = signal(false);
  processing = signal(false);
  showDocumentTypesSidebar = signal(false);
  tempSelectedDocumentTypes = signal<string[]>([]);
  docTypeSearchQuery = signal<string>('');
  showProfileEditForm = signal(false);
  
  @ViewChild('docTypeSearchInput') docTypeSearchInput!: ElementRef<HTMLInputElement>;
  
  private searchTimeout: any = null;
  
  userForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    interestedDocumentTypes: [[]]
  });

  async ngOnInit() {
    console.log('MyAccount ngOnInit called');
    console.log('Current user from auth:', this.currentUser());
    console.log('Current user data from service:', this.currentUserData());
    await Promise.all([this.loadDocumentTypes(), this.loadUserDataForEditing()]);
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  async loadDocumentTypes() {
    try {
      const client = generateClient<Schema>();
      const { data } = await client.models.DocumentType.list();
      this.documentTypes.set(data.filter(dt => dt.isActive !== false));
      this.filteredDocumentTypes.set(this.documentTypes());
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
    }
  }

  async loadUserDataForEditing() {
    const userData = this.currentUserData();
    if (userData) {
      this.userForm.patchValue({
        email: userData.email || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        interestedDocumentTypes: (userData.interestedDocumentTypes || []).filter(id => id !== null)
      });
    }
  }

  toggleProfileEditForm() {
    this.showProfileEditForm.update(show => !show);
    if (this.showProfileEditForm()) {
      this.loadUserDataForEditing();
    }
  }

  async onSubmitProfileForm() {
    if (this.userForm.invalid || this.processing()) return;
    
    try {
      this.processing.set(true);
      const userData = this.currentUserData();
      if (!userData?.id) {
        console.error('No current user data found');
        return;
      }

      const client = generateClient<Schema>();
      const formData = this.userForm.value;

      const { data: updatedUser, errors } = await client.models.User.update({
        id: userData.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        interestedDocumentTypes: formData.interestedDocumentTypes || []
      });

      if (errors) {
        console.error('Error updating user profile:', errors);
        return;
      }

      console.log('✅ Profile updated successfully:', updatedUser);
      
      // Refresh user data
      await this.userDataService.refreshUserData();
      
      // Close the form
      this.showProfileEditForm.set(false);
      
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      this.processing.set(false);
    }
  }

  // Document Types Selection Methods
  openDocumentTypesSidebar() {
    this.tempSelectedDocumentTypes.set([...this.userForm.get('interestedDocumentTypes')?.value || []]);
    this.showDocumentTypesSidebar.set(true);
    this.docTypeSearchQuery.set('');
    this.filteredDocumentTypes.set(this.documentTypes());
    
    // Focus the search input after a short delay
    setTimeout(() => {
      if (this.docTypeSearchInput?.nativeElement) {
        this.docTypeSearchInput.nativeElement.focus();
      }
    }, 100);
  }

  cancelDocumentTypeSelection() {
    this.showDocumentTypesSidebar.set(false);
    this.tempSelectedDocumentTypes.set([]);
    this.docTypeSearchQuery.set('');
  }

  applyDocumentTypeSelection() {
    const selectedTypes = this.tempSelectedDocumentTypes();
    this.userForm.patchValue({
      interestedDocumentTypes: selectedTypes
    });
    this.showDocumentTypesSidebar.set(false);
    this.tempSelectedDocumentTypes.set([]);
    this.docTypeSearchQuery.set('');
  }

  toggleDocumentTypeInSidebar(docTypeId: string) {
    this.tempSelectedDocumentTypes.update(currentSelected => {
      if (currentSelected.includes(docTypeId)) {
        return currentSelected.filter(id => id !== docTypeId);
      } else {
        return [...currentSelected, docTypeId];
      }
    });
  }

  isDocumentTypeSelectedInSidebar(docTypeId: string): boolean {
    return this.tempSelectedDocumentTypes().includes(docTypeId);
  }

  onDocTypeSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value.toLowerCase().trim();
    this.docTypeSearchQuery.set(query);
    
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      if (!query) {
        this.filteredDocumentTypes.set(this.documentTypes());
      } else {
        const filtered = this.documentTypes().filter(docType =>
          docType.name?.toLowerCase().includes(query) ||
          docType.description?.toLowerCase().includes(query) ||
          docType.category?.toLowerCase().includes(query)
        );
        this.filteredDocumentTypes.set(filtered);
      }
    }, 300);
  }

  clearDocTypeSearch() {
    this.docTypeSearchQuery.set('');
    this.filteredDocumentTypes.set(this.documentTypes());
    if (this.docTypeSearchInput?.nativeElement) {
      this.docTypeSearchInput.nativeElement.focus();
    }
  }

  getFilteredDocumentTypes() {
    return this.filteredDocumentTypes();
  }

  trackDocumentTypeById(index: number, docType: Schema['DocumentType']['type']) {
    return docType.id;
  }

  onDocTypeItemClick(docTypeId: string, docTypeName: string) {
    // This method is called when clicking on a document type item
    console.log(`Document type clicked: ${docTypeName} (${docTypeId})`);
  }

  // Helper methods for display
  getDocumentTypeName(docTypeId: string): string {
    const docType = this.documentTypes().find(dt => dt.id === docTypeId);
    return docType?.name || 'Unknown Document Type';
  }

  getDocumentTypeDescription(docTypeId: string): string {
    const docType = this.documentTypes().find(dt => dt.id === docTypeId);
    return docType?.description || '';
  }

  getDocumentTypeNames(docTypeIds: string[]): string {
    if (!docTypeIds || docTypeIds.length === 0) return 'None selected';
    
    const names = docTypeIds
      .map(id => this.getDocumentTypeName(id))
      .filter(name => name !== 'Unknown Document Type');
    
    return names.length > 0 ? names.join(', ') : 'None selected';
  }

  getCurrentUserDocumentTypeNames(): string {
    const userData = this.currentUserData();
    if (!userData?.interestedDocumentTypes) return 'None selected';
    
    const filteredIds = userData.interestedDocumentTypes.filter(id => id !== null) as string[];
    return this.getDocumentTypeNames(filteredIds);
  }
}

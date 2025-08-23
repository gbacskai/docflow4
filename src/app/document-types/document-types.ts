import { Component, OnInit, OnDestroy, signal, inject, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-types',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './document-types.html',
  styleUrl: './document-types.less',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentTypes implements OnInit, OnDestroy {
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  domains = signal<Array<Schema['Domain']['type']>>([]);
  filteredDomains = signal<Array<Schema['Domain']['type']>>([]);
  loading = signal(true);
  loadingDomains = signal(false);
  searchingDomains = signal(false);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedDocumentType = signal<Schema['DocumentType']['type'] | null>(null);
  processing = signal(false);
  showDomainSidebar = signal(false);
  tempSelectedDomains = signal<string[]>([]);
  domainSearchQuery = signal<string>('');
  
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  
  private fb = inject(FormBuilder);
  
  documentTypeForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    domainIds: [[]], // Domain IDs array - optional
    isActive: [true, [Validators.required]]
  });

  async ngOnInit() {
    await Promise.all([this.loadDocumentTypes(), this.loadDomains()]);
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  async loadDocumentTypes() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.DocumentType.list();
      this.documentTypes.set(data);
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadDomains() {
    try {
      this.loadingDomains.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Domain.list();
      this.domains.set(data);
    } catch (error) {
      console.error('Error loading domains:', error);
      this.domains.set([]);
    } finally {
      this.loadingDomains.set(false);
    }
  }

  openCreateForm() {
    this.currentMode.set('create');
    this.selectedDocumentType.set(null);
    this.documentTypeForm.reset();
    this.documentTypeForm.patchValue({ domainIds: [], isActive: true });
    this.showForm.set(true);
  }

  openEditForm(docType: Schema['DocumentType']['type']) {
    this.currentMode.set('edit');
    this.selectedDocumentType.set(docType);
    
    this.documentTypeForm.patchValue({
      name: docType.name,
      description: docType.description,
      domainIds: docType.domainIds || [],
      isActive: docType.isActive ?? true
    });
    this.showForm.set(true);
  }

  openViewMode(docType: Schema['DocumentType']['type']) {
    this.currentMode.set('view');
    this.selectedDocumentType.set(docType);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.currentMode.set('create');
    this.selectedDocumentType.set(null);
    this.documentTypeForm.reset();
    this.documentTypeForm.patchValue({ domainIds: [], isActive: true });
    this.closeDomainSidebar();
  }

  openDomainSidebar() {
    // Copy current domain selections to temp
    const currentDomains: string[] = this.documentTypeForm.get('domainIds')?.value || [];
    console.log('Opening sidebar with current domains:', currentDomains);
    this.tempSelectedDomains.set([...currentDomains]);
    console.log('Set temp domains to:', this.tempSelectedDomains());
    
    // Initialize filtered domains with all domains - use setTimeout to prevent initial render issues
    setTimeout(() => {
      this.filteredDomains.set(this.domains());
    }, 0);
    
    this.showDomainSidebar.set(true);
  }

  closeDomainSidebar() {
    this.showDomainSidebar.set(false);
    this.tempSelectedDomains.set([]);
    this.domainSearchQuery.set('');
    this.filteredDomains.set([]);
  }

  toggleDomainInSidebar(domainId: string) {
    console.log('🔥 toggleDomainInSidebar called with domainId:', domainId);
    const currentTemp = this.tempSelectedDomains();
    console.log('Before toggle:', currentTemp);
    console.log('Toggling domain:', domainId);
    console.log('Current tempSelectedDomains signal value:', this.tempSelectedDomains());
    
    let newTemp: string[];
    if (currentTemp.includes(domainId)) {
      newTemp = currentTemp.filter(id => id !== domainId);
      console.log('Removing domain, new temp will be:', newTemp);
    } else {
      newTemp = [...currentTemp, domainId];
      console.log('Adding domain, new temp will be:', newTemp);
    }
    
    // Update signal
    this.tempSelectedDomains.set(newTemp);
    console.log('Signal updated - final temp state:', this.tempSelectedDomains());
  }

  isDomainSelectedInSidebar(domainId: string): boolean {
    return this.tempSelectedDomains().includes(domainId);
  }

  onDomainItemClick(domainId: string, domainName: string) {
    console.log('🎯 Domain item clicked:', domainName, 'ID:', domainId);
    // This will bubble up to the domain-info click handler
  }

  trackDomainById(index: number, domain: Schema['Domain']['type']): string {
    return domain.id;
  }

  applyDomainSelection() {
    const tempDomains = this.tempSelectedDomains();
    console.log('Applying domains:', tempDomains);
    
    this.documentTypeForm.patchValue({
      domainIds: [...tempDomains]
    });
    
    console.log('Form updated with domains:', this.documentTypeForm.get('domainIds')?.value);
    this.closeDomainSidebar();
  }

  cancelDomainSelection() {
    this.closeDomainSidebar();
  }

  getFilteredDomains() {
    return this.filteredDomains();
  }

  private searchTimeout: any = null;

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value;
    
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    if (!query || query.trim() === '') {
      // If search is empty, reset to all domains with a longer delay
      this.searchTimeout = setTimeout(() => {
        this.domainSearchQuery.set('');
        this.filteredDomains.set(this.domains());
        // Force focus restoration after clear
        setTimeout(() => {
          if (this.searchInput) {
            this.searchInput.nativeElement.focus();
          }
        }, 0);
      }, 200);
      return;
    }
    
    // Longer debounce to completely avoid updates during active typing
    this.searchTimeout = setTimeout(async () => {
      // Only update signals after user completely stops typing
      this.domainSearchQuery.set(query);
      await this.searchDomains(query.trim());
    }, 1000); // Increased to 1 second
  }

  async clearSearch() {
    // Clear timeout first
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.domainSearchQuery.set('');
    this.filteredDomains.set(this.domains());
    
    // Clear the actual input element and maintain focus
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
      this.searchInput.nativeElement.focus();
    }
  }

  async searchDomains(query: string) {
    try {
      this.searchingDomains.set(true);
      const client = generateClient<Schema>();
      
      console.log('🔍 Searching domains with query:', query);
      
      // Store current focus state
      const searchInputFocused = this.searchInput?.nativeElement === document.activeElement;
      
      // Build filter conditions - convert query to lowercase for case-insensitive search
      const queryLower = query.toLowerCase();
      const filterConditions: any[] = [
        { name: { contains: queryLower } },
        { description: { contains: queryLower } }
      ];
      
      // Add status filter if query matches enum values
      if (queryLower === 'active' || queryLower.includes('activ')) {
        filterConditions.push({ status: { eq: 'active' } });
      }
      if (queryLower === 'archived' || queryLower.includes('archiv')) {
        filterConditions.push({ status: { eq: 'archived' } });
      }
      
      // For better case-insensitive search, get broader results from API 
      // and then filter client-side for precise case-insensitive matching
      const { data } = await client.models.Domain.list();
      
      console.log('🔍 All domains from API:', data.length);
      
      // Client-side case-insensitive filtering for precise results
      const filteredData = data.filter(domain => {
        const nameMatch = domain.name.toLowerCase().includes(queryLower);
        const descriptionMatch = domain.description.toLowerCase().includes(queryLower);
        const statusMatch = domain.status && domain.status.toLowerCase().includes(queryLower);
        
        return nameMatch || descriptionMatch || statusMatch;
      });
      
      console.log('🔍 Filtered search results:', filteredData.length);
      this.filteredDomains.set(filteredData);
      
      // Restore focus after DOM updates
      if (searchInputFocused && this.searchInput) {
        setTimeout(() => {
          this.searchInput.nativeElement.focus();
        }, 0);
      }
      
    } catch (error) {
      console.error('Error searching domains:', error);
      // Fallback to client-side filtering if API search fails
      const filtered = this.domains().filter(domain => 
        domain.name.toLowerCase().includes(query.toLowerCase()) ||
        domain.description.toLowerCase().includes(query.toLowerCase()) ||
        (domain.status && domain.status.toLowerCase().includes(query.toLowerCase()))
      );
      this.filteredDomains.set(filtered);
      
      // Restore focus after DOM updates
      if (this.searchInput) {
        setTimeout(() => {
          this.searchInput.nativeElement.focus();
        }, 0);
      }
    } finally {
      this.searchingDomains.set(false);
    }
  }

  async onSubmitForm() {
    if (!this.documentTypeForm.valid) return;

    this.processing.set(true);
    
    try {
      const formValue = this.documentTypeForm.value;

      const docTypeData = {
        name: formValue.name,
        description: formValue.description,
        domainIds: formValue.domainIds || [],
        isActive: formValue.isActive
      };

      console.log('Submitting document type data:', docTypeData);
      console.log('Form value domainIds:', formValue.domainIds);

      if (this.currentMode() === 'create') {
        await this.createDocumentType(docTypeData);
      } else if (this.currentMode() === 'edit' && this.selectedDocumentType()) {
        await this.updateDocumentType(this.selectedDocumentType()!.id, docTypeData);
      }

      this.closeForm();
      await this.loadDocumentTypes();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.processing.set(false);
    }
  }

  async createDocumentType(docType: Omit<Schema['DocumentType']['type'], 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'templateCount' | 'fields'>) {
    try {
      const client = generateClient<Schema>();
      await client.models.DocumentType.create({
        ...docType,
        fields: [],
        usageCount: 0,
        templateCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating document type:', error);
      throw error;
    }
  }

  async updateDocumentType(id: string, updates: Partial<Schema['DocumentType']['type']>) {
    try {
      const client = generateClient<Schema>();
      await client.models.DocumentType.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating document type:', error);
      throw error;
    }
  }

  async deleteDocumentType(docType: Schema['DocumentType']['type']) {
    if (!confirm(`Are you sure you want to delete "${docType.name}"?`)) return;

    this.processing.set(true);
    
    try {
      const client = generateClient<Schema>();
      await client.models.DocumentType.delete({ id: docType.id });
      await this.loadDocumentTypes();
    } catch (error) {
      console.error('Error deleting document type:', error);
    } finally {
      this.processing.set(false);
    }
  }

  getDomainName(domainId: string): string {
    const domain = this.domains().find(d => d.id === domainId);
    return domain ? domain.name : 'Unknown Domain';
  }

  getDomainDescription(domainId: string): string {
    const domain = this.domains().find(d => d.id === domainId);
    return domain ? domain.description : 'No description available';
  }

  getDomainNames(domainIds: (string | null)[] | null | undefined): string {
    if (!domainIds || domainIds.length === 0) return 'No domains assigned';
    
    // Filter out null values and get domain names
    const validIds = domainIds.filter((id): id is string => id !== null);
    if (validIds.length === 0) return 'No domains assigned';
    
    const names = validIds.map(id => this.getDomainName(id));
    return names.join(', ');
  }

}

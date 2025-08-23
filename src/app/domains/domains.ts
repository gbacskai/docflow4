import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-domains',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './domains.html',
  styleUrl: './domains.less'
})
export class Domains implements OnInit, OnDestroy {
  domains = signal<Array<Schema['Domain']['type']>>([]);
  filteredDomains = signal<Array<Schema['Domain']['type']>>([]);
  searchQuery = signal<string>('');
  loading = signal(true);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedDomain = signal<Schema['Domain']['type'] | null>(null);
  processing = signal(false);
  
  private fb = inject(FormBuilder);
  private searchTimeout: any = null;
  
  domainForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    status: ['active', [Validators.required]]
  });

  async ngOnInit() {
    await this.loadDomains();
  }

  // Search functionality methods
  applySearch() {
    const query = this.searchQuery();
    if (!query) {
      this.filteredDomains.set(this.domains());
    } else {
      const filtered = this.domains().filter(domain =>
        domain.name?.toLowerCase().includes(query) ||
        domain.description?.toLowerCase().includes(query)
      );
      this.filteredDomains.set(filtered);
    }
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const query = target.value.toLowerCase().trim();
    this.searchQuery.set(query);
    
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.applySearch();
    }, 300);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.filteredDomains.set(this.domains());
  }

  async loadDomains() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Domain.list();
      this.domains.set(data);
      this.applySearch(); // Initialize filtered domains
    } catch (error) {
      console.error('Error loading domains:', error);
      this.domains.set([]);
      this.filteredDomains.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  openCreateForm() {
    this.currentMode.set('create');
    this.selectedDomain.set(null);
    this.domainForm.reset();
    this.domainForm.patchValue({ status: 'active' });
    this.showForm.set(true);
  }

  openEditForm(domain: Schema['Domain']['type']) {
    this.currentMode.set('edit');
    this.selectedDomain.set(domain);
    
    this.domainForm.patchValue({
      name: domain.name,
      description: domain.description,
      status: domain.status
    });
    this.showForm.set(true);
  }

  openViewMode(domain: Schema['Domain']['type']) {
    this.currentMode.set('view');
    this.selectedDomain.set(domain);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.currentMode.set('create');
    this.selectedDomain.set(null);
    this.domainForm.reset();
    this.domainForm.patchValue({ status: 'active' });
  }

  async onSubmitForm() {
    if (!this.domainForm.valid) return;

    this.processing.set(true);
    
    try {
      const formValue = this.domainForm.value;
      const domainData = {
        name: formValue.name,
        description: formValue.description,
        status: formValue.status as 'active' | 'archived'
      };

      if (this.currentMode() === 'create') {
        await this.createDomain(domainData);
      } else if (this.currentMode() === 'edit' && this.selectedDomain()) {
        await this.updateDomain(this.selectedDomain()!.id, domainData);
      }

      this.closeForm();
      await this.loadDomains();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.processing.set(false);
    }
  }

  async createDomain(domain: Omit<Schema['Domain']['type'], 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Domain.create({
        ...domain,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating domain:', error);
      throw error;
    }
  }

  async updateDomain(id: string, updates: Partial<Schema['Domain']['type']>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Domain.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating domain:', error);
      throw error;
    }
  }

  async deleteDomain(domain: Schema['Domain']['type']) {
    if (!confirm(`Are you sure you want to delete "${domain.name}"?`)) return;

    this.processing.set(true);
    
    try {
      const client = generateClient<Schema>();
      await client.models.Domain.delete({ id: domain.id });
      await this.loadDomains();
    } catch (error) {
      console.error('Error deleting domain:', error);
    } finally {
      this.processing.set(false);
    }
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
}

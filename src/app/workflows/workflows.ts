import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workflows',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './workflows.html',
  styleUrl: './workflows.less'
})
export class Workflows implements OnInit, OnDestroy {
  workflows = signal<Array<Schema['Workflow']['type']>>([]);
  filteredWorkflows = signal<Array<Schema['Workflow']['type']>>([]);
  searchQuery = signal<string>('');
  loading = signal(true);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedWorkflow = signal<Schema['Workflow']['type'] | null>(null);
  processing = signal(false);
  
  private fb = inject(FormBuilder);
  private searchTimeout: any = null;
  
  workflowForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    status: ['active', [Validators.required]]
  });

  async ngOnInit() {
    await this.loadWorkflows();
  }

  // Search functionality methods
  applySearch() {
    const query = this.searchQuery();
    if (!query) {
      this.filteredWorkflows.set(this.workflows());
    } else {
      const filtered = this.workflows().filter(workflow =>
        workflow.name?.toLowerCase().includes(query) ||
        workflow.description?.toLowerCase().includes(query)
      );
      this.filteredWorkflows.set(filtered);
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
    this.filteredWorkflows.set(this.workflows());
  }

  async loadWorkflows() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Workflow.list();
      this.workflows.set(data);
      this.applySearch(); // Initialize filtered workflows
    } catch (error) {
      console.error('Error loading workflows:', error);
      this.workflows.set([]);
      this.filteredWorkflows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  openCreateForm() {
    this.currentMode.set('create');
    this.selectedWorkflow.set(null);
    this.workflowForm.reset();
    this.workflowForm.patchValue({ status: 'active' });
    this.showForm.set(true);
  }

  openEditForm(workflow: Schema['Workflow']['type']) {
    this.currentMode.set('edit');
    this.selectedWorkflow.set(workflow);
    
    this.workflowForm.patchValue({
      name: workflow.name,
      description: workflow.description,
      status: workflow.status
    });
    this.showForm.set(true);
  }

  openViewMode(workflow: Schema['Workflow']['type']) {
    this.currentMode.set('view');
    this.selectedWorkflow.set(workflow);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.currentMode.set('create');
    this.selectedWorkflow.set(null);
    this.workflowForm.reset();
    this.workflowForm.patchValue({ status: 'active' });
  }

  async onSubmitForm() {
    if (!this.workflowForm.valid) return;

    this.processing.set(true);
    
    try {
      const formValue = this.workflowForm.value;
      const workflowData = {
        name: formValue.name,
        description: formValue.description,
        status: formValue.status as 'active' | 'archived'
      };

      if (this.currentMode() === 'create') {
        await this.createWorkflow(workflowData);
      } else if (this.currentMode() === 'edit' && this.selectedWorkflow()) {
        await this.updateWorkflow(this.selectedWorkflow()!.id, workflowData);
      }

      this.closeForm();
      await this.loadWorkflows();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.processing.set(false);
    }
  }

  async createWorkflow(workflow: Omit<Schema['Workflow']['type'], 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Workflow.create({
        ...workflow,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  }

  async updateWorkflow(id: string, updates: Partial<Schema['Workflow']['type']>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Workflow.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating workflow:', error);
      throw error;
    }
  }

  async deleteWorkflow(workflow: Schema['Workflow']['type']) {
    if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) return;

    this.processing.set(true);
    
    try {
      const client = generateClient<Schema>();
      await client.models.Workflow.delete({ id: workflow.id });
      await this.loadWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
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

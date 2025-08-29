import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { TestHelpers } from '../../test-helpers';
import type { Schema } from '../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/data';

import { Workflows } from './workflows';

describe('Workflows', () => {
  let component: Workflows;
  let fixture: ComponentFixture<Workflows>;
  let mockClient: any;

  const mockWorkflows: Schema['Workflow']['type'][] = [
    {
      id: 'workflow-1',
      name: 'Legal',
      description: 'Legal documents and contracts',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'workflow-2',
      name: 'Finance',
      description: 'Financial documents and reports',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(fakeAsync(() => {
    mockClient = {
      models: {
        Workflow: {
          list: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockWorkflows })),
          create: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockWorkflows[0] })),
          update: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockWorkflows[0] })),
          delete: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockWorkflows[0] }))
        }
      }
    };

    // Set up spying before module configuration

    const testConfig = TestHelpers.configureTestingModule({
      mockUser: TestHelpers.createMockUser({
        email: 'gbacskai@gmail.com',
        userId: 'admin-user-123',
        username: 'admin'
      }),
      mockIsAuthenticated: true
    });
    
    TestBed.configureTestingModule({
      imports: [Workflows, ReactiveFormsModule, ...testConfig.imports],
      providers: testConfig.providers
    });

    fixture = TestBed.createComponent(Workflows);
    component = fixture.componentInstance;
    
    // Override the component methods to use our mock client
    spyOn(component, 'loadWorkflows').and.callFake(async () => {
      component.loading.set(true);
      const { data } = await mockClient.models.Workflow.list();
      component.workflows.set(data);
      component.applySearch();
      component.loading.set(false);
    });
    
    spyOn(component, 'createWorkflow').and.callFake(async (workflow: any) => {
      await mockClient.models.Workflow.create({
        ...workflow,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    
    spyOn(component, 'updateWorkflow').and.callFake(async (id: string, updates: any) => {
      await mockClient.models.Workflow.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    });
    
    spyOn(component, 'deleteWorkflow').and.callFake(async (workflow: Schema['Workflow']['type']) => {
      if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) return;
      component.processing.set(true);
      try {
        await mockClient.models.Workflow.delete({ id: workflow.id });
        await component.loadWorkflows();
      } catch (error) {
        console.error('Error deleting workflow:', error);
      } finally {
        component.processing.set(false);
      }
    });

    fixture.detectChanges();
    tick();
  }));

  it('should create', fakeAsync(() => {
    expect(component).toBeTruthy();
    expect(component.workflows().length).toBe(2);
    expect(mockClient.models.Workflow.list).toHaveBeenCalled();
  }));

  describe('Workflow Lifecycle Tests', () => {
    it('should create a new workflow successfully', fakeAsync(() => {
      const newWorkflowData = {
        name: 'Test Engineering',
        description: 'Engineering and technical documentation workflow for testing',
        status: 'active' as const
      };

      component.openCreateForm();
      tick();

      expect(component.currentMode()).toBe('create');
      expect(component.showForm()).toBe(true);

      component.workflowForm.patchValue(newWorkflowData);
      tick();

      expect(component.workflowForm.valid).toBe(true);

      const createdWorkflow = {
        id: 'workflow-new',
        ...newWorkflowData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockClient.models.Workflow.create.and.returnValue(Promise.resolve({ data: createdWorkflow }));
      mockClient.models.Workflow.list.and.returnValue(Promise.resolve({ data: [...mockWorkflows, createdWorkflow] }));

      component.onSubmitForm();
      tick();

      expect(mockClient.models.Workflow.create).toHaveBeenCalledWith({
        name: newWorkflowData.name,
        description: newWorkflowData.description,
        status: newWorkflowData.status,
        createdAt: jasmine.any(String),
        updatedAt: jasmine.any(String)
      });

      expect(component.showForm()).toBe(false);
      expect(component.selectedWorkflow()).toBeNull();
    }));

    it('should retrieve and display workflow for editing', fakeAsync(() => {
      // Workflow should be loaded already from beforeEach
      expect(component.workflows().length).toBe(2);
      
      const testWorkflow = component.workflows()[0];
      
      component.openEditForm(testWorkflow);
      tick();

      expect(component.currentMode()).toBe('edit');
      expect(component.selectedWorkflow()).toEqual(testWorkflow);
      expect(component.showForm()).toBe(true);
      expect(component.workflowForm.get('name')?.value).toBe(testWorkflow.name);
      expect(component.workflowForm.get('description')?.value).toBe(testWorkflow.description);
      expect(component.workflowForm.get('status')?.value).toBe(testWorkflow.status);
    }));

    it('should edit workflow name and description', fakeAsync(() => {
      // Workflow should be loaded already from beforeEach
      expect(component.workflows().length).toBe(2);

      const originalWorkflow = component.workflows()[0];
      const updatedData = {
        name: 'Updated Legal Workflow',
        description: 'Updated description for legal documents and enhanced contracts management',
        status: 'active' as const
      };

      component.openEditForm(originalWorkflow);
      tick();

      component.workflowForm.patchValue(updatedData);
      tick();

      expect(component.workflowForm.valid).toBe(true);

      const updatedWorkflow = {
        ...originalWorkflow,
        ...updatedData,
        updatedAt: new Date().toISOString()
      };

      mockClient.models.Workflow.update.and.returnValue(Promise.resolve({ data: updatedWorkflow }));
      mockClient.models.Workflow.list.and.returnValue(Promise.resolve({ data: [updatedWorkflow, mockWorkflows[1]] }));

      component.onSubmitForm();
      tick();

      expect(mockClient.models.Workflow.update).toHaveBeenCalledWith({
        id: originalWorkflow.id,
        name: updatedData.name,
        description: updatedData.description,
        status: updatedData.status,
        updatedAt: jasmine.any(String)
      });

      expect(component.showForm()).toBe(false);
    }));

    it('should verify workflow changes were saved', fakeAsync(() => {
      const originalWorkflow = mockWorkflows[0];
      const updatedWorkflow = {
        ...originalWorkflow,
        name: 'Updated Legal Workflow',
        description: 'Updated description for legal documents',
        updatedAt: new Date().toISOString()
      };

      mockClient.models.Workflow.list.and.returnValue(Promise.resolve({ data: [updatedWorkflow, mockWorkflows[1]] }));

      component.loadWorkflows();
      tick();

      const workflows = component.workflows();
      const updatedWorkflowInList = workflows.find(d => d.id === originalWorkflow.id);

      expect(updatedWorkflowInList).toBeTruthy();
      expect(updatedWorkflowInList?.name).toBe('Updated Legal Workflow');
      expect(updatedWorkflowInList?.description).toBe('Updated description for legal documents');
      expect(updatedWorkflowInList?.updatedAt).not.toBe(originalWorkflow.updatedAt);
    }));

    it('should delete workflow successfully', fakeAsync(() => {
      // Workflow should be loaded already from beforeEach
      expect(component.workflows().length).toBe(2);

      const workflowToDelete = component.workflows()[0];
      
      spyOn(window, 'confirm').and.returnValue(true);

      const remainingWorkflows = mockWorkflows.filter(d => d.id !== workflowToDelete.id);
      mockClient.models.Workflow.list.and.returnValue(Promise.resolve({ data: remainingWorkflows }));

      component.deleteWorkflow(workflowToDelete);
      tick();

      expect(mockClient.models.Workflow.delete).toHaveBeenCalledWith({ id: workflowToDelete.id });
      expect(mockClient.models.Workflow.list).toHaveBeenCalledTimes(2); // once in beforeEach, once in deleteWorkflow
    }));

    it('should not delete workflow when user cancels confirmation', fakeAsync(() => {
      // Workflow should be loaded already from beforeEach
      expect(component.workflows().length).toBe(2);

      const workflowToDelete = component.workflows()[0];
      
      spyOn(window, 'confirm').and.returnValue(false);

      component.deleteWorkflow(workflowToDelete);
      tick();

      expect(mockClient.models.Workflow.delete).not.toHaveBeenCalled();
    }));

    it('should validate form correctly', fakeAsync(() => {
      component.openCreateForm();
      tick();

      component.workflowForm.patchValue({
        name: '',
        description: 'Short',
        status: 'active'
      });
      tick();

      expect(component.workflowForm.get('name')?.invalid).toBe(true);
      expect(component.workflowForm.get('description')?.invalid).toBe(true);
      expect(component.workflowForm.valid).toBe(false);

      component.workflowForm.patchValue({
        name: 'Valid Workflow Name',
        description: 'This is a valid description that meets the minimum length requirement',
        status: 'active'
      });
      tick();

      expect(component.workflowForm.valid).toBe(true);
    }));

    it('should open and close forms correctly', fakeAsync(() => {
      expect(component.showForm()).toBe(false);
      expect(component.currentMode()).toBe('create');

      component.openCreateForm();
      tick();

      expect(component.showForm()).toBe(true);
      expect(component.currentMode()).toBe('create');
      expect(component.selectedWorkflow()).toBeNull();

      const testWorkflow = mockWorkflows[0];
      component.openEditForm(testWorkflow);
      tick();

      expect(component.currentMode()).toBe('edit');
      expect(component.selectedWorkflow()).toEqual(testWorkflow);

      component.openViewMode(testWorkflow);
      tick();

      expect(component.currentMode()).toBe('view');
      expect(component.selectedWorkflow()).toEqual(testWorkflow);

      component.closeForm();
      tick();

      expect(component.showForm()).toBe(false);
      expect(component.currentMode()).toBe('create');
      expect(component.selectedWorkflow()).toBeNull();
    }));
  });
});

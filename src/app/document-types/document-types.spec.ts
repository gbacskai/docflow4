import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { TestHelpers } from '../../test-helpers';
import type { Schema } from '../../../amplify/data/resource';

import { DocumentTypes } from './document-types';

describe('DocumentTypes', () => {
  let component: DocumentTypes;
  let fixture: ComponentFixture<DocumentTypes>;
  let mockClient: any;

  const mockDocumentType: Schema['DocumentType']['type'] = {
    id: 'doc-type-1',
    name: 'Test Document',
    identifier: 'test-document',
    description: 'Test Description',
    domainIds: ['domain-1'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  const mockDomains: Schema['Domain']['type'][] = [
    {
      id: 'domain-1',
      name: 'Legal',
      description: 'Legal documents',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'domain-2',
      name: 'Finance',
      description: 'Financial documents',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(fakeAsync(() => {
    mockClient = {
      models: {
        DocumentType: {
          list: jasmine.createSpy().and.returnValue(Promise.resolve({ data: [mockDocumentType] })),
          create: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDocumentType })),
          update: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDocumentType })),
          delete: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDocumentType }))
        },
        Domain: {
          list: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDomains }))
        }
      }
    };
    
    const testConfig = TestHelpers.configureTestingModule({
      mockUser: TestHelpers.createMockUser({
        email: 'gbacskai@gmail.com',
        userId: 'admin-user-123',
        username: 'admin'
      }),
      mockIsAuthenticated: true
    });
    
    TestBed.configureTestingModule({
      imports: [DocumentTypes, ReactiveFormsModule, ...testConfig.imports],
      providers: testConfig.providers
    });

    fixture = TestBed.createComponent(DocumentTypes);
    component = fixture.componentInstance;
    
    // Override the component methods to use our mock client
    spyOn(component, 'loadDocumentTypes').and.callFake(async () => {
      component.loading.set(true);
      const { data } = await mockClient.models.DocumentType.list();
      component.documentTypes.set(data);
      component.applyDocTypeSearch();
      component.loading.set(false);
    });
    
    spyOn(component, 'loadDomains').and.callFake(async () => {
      component.loadingDomains.set(true);
      const { data } = await mockClient.models.Domain.list();
      component.domains.set(data);
      component.filteredDomains.set(data);
      component.loadingDomains.set(false);
    });
    
    spyOn(component, 'createDocumentType').and.callFake(async (docType: any) => {
      await mockClient.models.DocumentType.create({
        ...docType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    
    spyOn(component, 'updateDocumentType').and.callFake(async (id: string, updates: any) => {
      await mockClient.models.DocumentType.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    });

    fixture.detectChanges();
    tick();
  }));

  it('should create', fakeAsync(() => {
    expect(component).toBeTruthy();
    expect(component.documentTypes().length).toBe(1);
    expect(component.domains().length).toBe(2);
  }));

  describe('Document Type Domain Change Test', () => {
    it('should edit a document type and change its domain successfully', fakeAsync(() => {
      // Data should be loaded from beforeEach
      expect(component.documentTypes().length).toBeGreaterThan(0);
      expect(component.domains().length).toBe(2);
      
      const originalDocType = component.documentTypes()[0];
      
      component.openEditForm(originalDocType);
      tick();

      expect(component.currentMode()).toBe('edit');
      expect(component.selectedDocumentType()).toEqual(originalDocType);
      
      // Open the domain sidebar to initialize temp selection
      component.openDomainSidebar();
      tick();
      
      // Now domain-1 should be in tempSelectedDomains, toggle it to remove it
      component.toggleDomain('domain-1', { target: { checked: false } } as any);
      tick();

      // Toggle domain-2 to add it  
      component.toggleDomain('domain-2', { target: { checked: true } } as any);
      tick();

      // Apply the domain selection to update the form
      component.applyDomainSelection();
      
      expect(component.documentTypeForm.get('domainIds')?.value).toEqual(['domain-2']);

      const updatedDocType = {
        ...originalDocType,
        domainIds: ['domain-2'],
        updatedAt: new Date().toISOString()
      };
      
      mockClient.models.DocumentType.update.and.returnValue(Promise.resolve({ data: updatedDocType }));
      mockClient.models.DocumentType.list.and.returnValue(Promise.resolve({ data: [updatedDocType] }));

      component.onSubmitForm();
      tick();

      expect(mockClient.models.DocumentType.update).toHaveBeenCalled();
      expect(component.showForm()).toBe(false);
      expect(component.selectedDocumentType()).toBeNull();
    }));

    it('should verify domain change by checking form values', fakeAsync(() => {
      // Data should be loaded from beforeEach
      const testDocType = component.documentTypes()[0];
      
      component.openEditForm(testDocType);
      tick();

      // Open domain sidebar to initialize temp selection
      component.openDomainSidebar();
      tick();

      const removeEvent = { target: { checked: false } } as any;
      component.toggleDomain('domain-1', removeEvent);
      
      const addEvent = { target: { checked: true } } as any;
      component.toggleDomain('domain-2', addEvent);
      
      tick();

      expect(component.isDomainSelected('domain-1')).toBe(false);
      expect(component.isDomainSelected('domain-2')).toBe(true);

      const domainNames = component.getDomainNames(['domain-2']);
      expect(domainNames).toBe('Finance');
    }));

    it('should handle multiple domain changes correctly', fakeAsync(() => {
      // Data should be loaded from beforeEach
      const testDocType = component.documentTypes()[0];
      component.openEditForm(testDocType);
      tick();

      // Open domain sidebar to initialize temp selection
      component.openDomainSidebar();
      tick();

      // Add Finance domain
      const addFinanceEvent = { target: { checked: true } } as any;
      component.toggleDomain('domain-2', addFinanceEvent);
      tick();

      // Apply selection to update form
      component.applyDomainSelection();
      
      const currentDomains = component.documentTypeForm.get('domainIds')?.value || [];
      expect(currentDomains).toContain('domain-2');

      // Open sidebar again for next change
      component.openDomainSidebar();
      tick();

      // Remove Legal domain
      const removeLegalEvent = { target: { checked: false } } as any;
      component.toggleDomain('domain-1', removeLegalEvent);
      tick();

      // Apply selection again
      component.applyDomainSelection();

      const finalDomains = component.documentTypeForm.get('domainIds')?.value || [];
      expect(finalDomains).toContain('domain-2');
      expect(component.getDomainNames(['domain-2'])).toBe('Finance');
    }));

    it('should maintain form validation when changing domains', fakeAsync(() => {
      // Data should be loaded from beforeEach
      const testDocType = component.documentTypes()[0];
      component.openEditForm(testDocType);
      tick();

      const removeEvent = { target: { checked: false } } as any;
      component.toggleDomain('domain-1', removeEvent);
      tick();

      const domainIdsControl = component.documentTypeForm.get('domainIds');
      const domains = domainIdsControl?.value || [];
      
      // Domain IDs are optional, so removing all domains should still be valid
      expect(domainIdsControl?.valid).toBe(true);

      const addEvent = { target: { checked: true } } as any;
      component.toggleDomain('domain-2', addEvent);
      tick();

      expect(domainIdsControl?.valid).toBe(true);
    }));
  });
});
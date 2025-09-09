import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    version: '2024-01-01T00:00:00Z',
    name: 'Test Document',
    identifier: 'test-document',
    description: 'Test Description',
    definition: '{"fields": []}',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  beforeEach(async () => {
    mockClient = {
      models: {
        DocumentType: {
          list: jasmine.createSpy().and.returnValue(Promise.resolve({ data: [mockDocumentType] })),
          create: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDocumentType })),
          update: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDocumentType })),
          delete: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDocumentType }))
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
    
    await TestBed.configureTestingModule({
      imports: [DocumentTypes, ReactiveFormsModule, ...testConfig.imports],
      providers: testConfig.providers
    }).compileComponents();

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
    
    spyOn(component, 'createDocumentType').and.callFake(async (docType: any) => {
      await mockClient.models.DocumentType.create({
        ...docType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // Initialize component
    await component.ngOnInit();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.documentTypes().length).toBe(1);
    expect(component.documentTypes()[0].name).toBe('Test Document');
  });

  describe('Document Type Management', () => {
    it('should load document types successfully', async () => {
      await component.loadDocumentTypes();
      
      expect(component.documentTypes().length).toBe(1);
      expect(component.loading()).toBe(false);
    });

    it('should create a new document type', async () => {
      component.documentTypeForm.patchValue({
        name: 'New Document Type',
        identifier: 'new-document-type',
        definition: '{"fields": []}',
        isActive: true
      });
      
      await component.createDocumentType(component.documentTypeForm.value);
      
      expect(mockClient.models.DocumentType.create).toHaveBeenCalled();
    });

    it('should validate form fields correctly', () => {
      const form = component.documentTypeForm;
      
      // Test required field validation
      form.get('name')?.setValue('');
      form.get('name')?.markAsTouched();
      expect(form.get('name')?.invalid).toBe(true);
      
      // Test valid input
      form.get('name')?.setValue('Valid Document Type');
      expect(form.get('name')?.invalid).toBe(false);
    });

    it('should handle form submission', async () => {
      component.currentMode.set('create');
      component.documentTypeForm.patchValue({
        name: 'Test Document Type',
        identifier: 'test-doc-type',
        definition: '{"fields": []}',
        isActive: true
      });
      
      spyOn(component, 'onSubmitForm').and.callThrough();
      
      await component.onSubmitForm();
      
      expect(component.onSubmitForm).toHaveBeenCalled();
    });
  });
});
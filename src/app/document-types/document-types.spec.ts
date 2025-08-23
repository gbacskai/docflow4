import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import type { Schema } from '../../../amplify/data/resource';

import { DocumentTypes } from './document-types';

describe('DocumentTypes', () => {
  let component: DocumentTypes;
  let fixture: ComponentFixture<DocumentTypes>;
  let mockClient: any;

  const mockDocumentType: Schema['DocumentType']['type'] = {
    id: 'doc-type-1',
    name: 'Test Document',
    description: 'Test Description',
    category: 'domain-1',
    fields: [],
    isActive: true,
    usageCount: 0,
    templateCount: 0,
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

  beforeEach(async () => {
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

    const generateClientSpy = jasmine.createSpy('generateClient').and.returnValue(mockClient);
    
    await TestBed.configureTestingModule({
      imports: [DocumentTypes, ReactiveFormsModule],
      providers: [
        { provide: 'generateClient', useValue: generateClientSpy }
      ]
    })
    .compileComponents();

    // Skip mocking generateClient for now to avoid ES module readonly property issues
    // Tests will run against real AWS client (may require actual backend)

    fixture = TestBed.createComponent(DocumentTypes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Document Type Domain Change Test', () => {
    it('should edit a document type and change its domain successfully', fakeAsync(async () => {
      await component.ngOnInit();
      tick();

      expect(component.documentTypes().length).toBeGreaterThan(0);
      const originalDocType = component.documentTypes()[0];
      
      component.openEditForm(originalDocType);
      tick();

      expect(component.currentMode()).toBe('edit');
      expect(component.selectedDocumentType()).toEqual(originalDocType);
      
      const mockEvent = {
        target: { checked: false }
      } as any;
      component.toggleDomain('domain-1', mockEvent);
      tick();

      const addEvent = {
        target: { checked: true }
      } as any;
      component.toggleDomain('domain-2', addEvent);
      tick();

      expect(component.documentTypeForm.get('category')?.value).toContain('domain-2');

      const updatedDocType = {
        ...originalDocType,
        category: 'domain-2',
        updatedAt: new Date().toISOString()
      };
      
      mockClient.models.DocumentType.update.and.returnValue(Promise.resolve({ data: updatedDocType }));
      mockClient.models.DocumentType.list.and.returnValue(Promise.resolve({ data: [updatedDocType] }));

      await component.onSubmitForm();
      tick();

      expect(mockClient.models.DocumentType.update).toHaveBeenCalled();
      expect(component.showForm()).toBe(false);
      expect(component.selectedDocumentType()).toBeNull();
    }));

    it('should verify domain change by checking form values', fakeAsync(async () => {
      await component.ngOnInit();
      tick();

      const testDocType = component.documentTypes()[0];
      
      component.openEditForm(testDocType);
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

    it('should handle multiple domain changes correctly', fakeAsync(async () => {
      await component.ngOnInit();
      tick();

      const testDocType = component.documentTypes()[0];
      component.openEditForm(testDocType);
      tick();

      const addFinanceEvent = { target: { checked: true } } as any;
      component.toggleDomain('domain-2', addFinanceEvent);
      tick();

      const currentDomains = component.documentTypeForm.get('category')?.value || [];
      expect(currentDomains).toContain('domain-2');

      const removeLegalEvent = { target: { checked: false } } as any;
      component.toggleDomain('domain-1', removeLegalEvent);
      tick();

      const finalDomains = component.documentTypeForm.get('category')?.value || [];
      expect(finalDomains).toContain('domain-2');
      expect(component.getDomainNames(['domain-2'])).toBe('Finance');
    }));

    it('should maintain form validation when changing domains', fakeAsync(async () => {
      await component.ngOnInit();
      tick();

      const testDocType = component.documentTypes()[0];
      component.openEditForm(testDocType);
      tick();

      const removeEvent = { target: { checked: false } } as any;
      component.toggleDomain('domain-1', removeEvent);
      tick();

      const categoryControl = component.documentTypeForm.get('category');
      const domains = categoryControl?.value || [];
      if (domains.length === 0) {
        expect(categoryControl?.invalid).toBe(true);
      }

      const addEvent = { target: { checked: true } } as any;
      component.toggleDomain('domain-2', addEvent);
      tick();

      expect(categoryControl?.valid).toBe(true);
    }));
  });
});
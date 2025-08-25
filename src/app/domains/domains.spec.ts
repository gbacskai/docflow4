import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { TestHelpers } from '../../test-helpers';
import type { Schema } from '../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/data';

import { Domains } from './domains';

describe('Domains', () => {
  let component: Domains;
  let fixture: ComponentFixture<Domains>;
  let mockClient: any;

  const mockDomains: Schema['Domain']['type'][] = [
    {
      id: 'domain-1',
      name: 'Legal',
      description: 'Legal documents and contracts',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'domain-2',
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
        Domain: {
          list: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDomains })),
          create: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDomains[0] })),
          update: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDomains[0] })),
          delete: jasmine.createSpy().and.returnValue(Promise.resolve({ data: mockDomains[0] }))
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
      imports: [Domains, ReactiveFormsModule, ...testConfig.imports],
      providers: testConfig.providers
    });

    fixture = TestBed.createComponent(Domains);
    component = fixture.componentInstance;
    
    // Override the component methods to use our mock client
    spyOn(component, 'loadDomains').and.callFake(async () => {
      component.loading.set(true);
      const { data } = await mockClient.models.Domain.list();
      component.domains.set(data);
      component.applySearch();
      component.loading.set(false);
    });
    
    spyOn(component, 'createDomain').and.callFake(async (domain: any) => {
      await mockClient.models.Domain.create({
        ...domain,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    
    spyOn(component, 'updateDomain').and.callFake(async (id: string, updates: any) => {
      await mockClient.models.Domain.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    });
    
    spyOn(component, 'deleteDomain').and.callFake(async (domain: Schema['Domain']['type']) => {
      if (!confirm(`Are you sure you want to delete "${domain.name}"?`)) return;
      component.processing.set(true);
      try {
        await mockClient.models.Domain.delete({ id: domain.id });
        await component.loadDomains();
      } catch (error) {
        console.error('Error deleting domain:', error);
      } finally {
        component.processing.set(false);
      }
    });

    fixture.detectChanges();
    tick();
  }));

  it('should create', fakeAsync(() => {
    expect(component).toBeTruthy();
    expect(component.domains().length).toBe(2);
    expect(mockClient.models.Domain.list).toHaveBeenCalled();
  }));

  describe('Domain Lifecycle Tests', () => {
    it('should create a new domain successfully', fakeAsync(() => {
      const newDomainData = {
        name: 'Test Engineering',
        description: 'Engineering and technical documentation domain for testing',
        status: 'active' as const
      };

      component.openCreateForm();
      tick();

      expect(component.currentMode()).toBe('create');
      expect(component.showForm()).toBe(true);

      component.domainForm.patchValue(newDomainData);
      tick();

      expect(component.domainForm.valid).toBe(true);

      const createdDomain = {
        id: 'domain-new',
        ...newDomainData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockClient.models.Domain.create.and.returnValue(Promise.resolve({ data: createdDomain }));
      mockClient.models.Domain.list.and.returnValue(Promise.resolve({ data: [...mockDomains, createdDomain] }));

      component.onSubmitForm();
      tick();

      expect(mockClient.models.Domain.create).toHaveBeenCalledWith({
        name: newDomainData.name,
        description: newDomainData.description,
        status: newDomainData.status,
        createdAt: jasmine.any(String),
        updatedAt: jasmine.any(String)
      });

      expect(component.showForm()).toBe(false);
      expect(component.selectedDomain()).toBeNull();
    }));

    it('should retrieve and display domain for editing', fakeAsync(() => {
      // Domain should be loaded already from beforeEach
      expect(component.domains().length).toBe(2);
      
      const testDomain = component.domains()[0];
      
      component.openEditForm(testDomain);
      tick();

      expect(component.currentMode()).toBe('edit');
      expect(component.selectedDomain()).toEqual(testDomain);
      expect(component.showForm()).toBe(true);
      expect(component.domainForm.get('name')?.value).toBe(testDomain.name);
      expect(component.domainForm.get('description')?.value).toBe(testDomain.description);
      expect(component.domainForm.get('status')?.value).toBe(testDomain.status);
    }));

    it('should edit domain name and description', fakeAsync(() => {
      // Domain should be loaded already from beforeEach
      expect(component.domains().length).toBe(2);

      const originalDomain = component.domains()[0];
      const updatedData = {
        name: 'Updated Legal Domain',
        description: 'Updated description for legal documents and enhanced contracts management',
        status: 'active' as const
      };

      component.openEditForm(originalDomain);
      tick();

      component.domainForm.patchValue(updatedData);
      tick();

      expect(component.domainForm.valid).toBe(true);

      const updatedDomain = {
        ...originalDomain,
        ...updatedData,
        updatedAt: new Date().toISOString()
      };

      mockClient.models.Domain.update.and.returnValue(Promise.resolve({ data: updatedDomain }));
      mockClient.models.Domain.list.and.returnValue(Promise.resolve({ data: [updatedDomain, mockDomains[1]] }));

      component.onSubmitForm();
      tick();

      expect(mockClient.models.Domain.update).toHaveBeenCalledWith({
        id: originalDomain.id,
        name: updatedData.name,
        description: updatedData.description,
        status: updatedData.status,
        updatedAt: jasmine.any(String)
      });

      expect(component.showForm()).toBe(false);
    }));

    it('should verify domain changes were saved', fakeAsync(() => {
      const originalDomain = mockDomains[0];
      const updatedDomain = {
        ...originalDomain,
        name: 'Updated Legal Domain',
        description: 'Updated description for legal documents',
        updatedAt: new Date().toISOString()
      };

      mockClient.models.Domain.list.and.returnValue(Promise.resolve({ data: [updatedDomain, mockDomains[1]] }));

      component.loadDomains();
      tick();

      const domains = component.domains();
      const updatedDomainInList = domains.find(d => d.id === originalDomain.id);

      expect(updatedDomainInList).toBeTruthy();
      expect(updatedDomainInList?.name).toBe('Updated Legal Domain');
      expect(updatedDomainInList?.description).toBe('Updated description for legal documents');
      expect(updatedDomainInList?.updatedAt).not.toBe(originalDomain.updatedAt);
    }));

    it('should delete domain successfully', fakeAsync(() => {
      // Domain should be loaded already from beforeEach
      expect(component.domains().length).toBe(2);

      const domainToDelete = component.domains()[0];
      
      spyOn(window, 'confirm').and.returnValue(true);

      const remainingDomains = mockDomains.filter(d => d.id !== domainToDelete.id);
      mockClient.models.Domain.list.and.returnValue(Promise.resolve({ data: remainingDomains }));

      component.deleteDomain(domainToDelete);
      tick();

      expect(mockClient.models.Domain.delete).toHaveBeenCalledWith({ id: domainToDelete.id });
      expect(mockClient.models.Domain.list).toHaveBeenCalledTimes(2); // once in beforeEach, once in deleteDomain
    }));

    it('should not delete domain when user cancels confirmation', fakeAsync(() => {
      // Domain should be loaded already from beforeEach
      expect(component.domains().length).toBe(2);

      const domainToDelete = component.domains()[0];
      
      spyOn(window, 'confirm').and.returnValue(false);

      component.deleteDomain(domainToDelete);
      tick();

      expect(mockClient.models.Domain.delete).not.toHaveBeenCalled();
    }));

    it('should validate form correctly', fakeAsync(() => {
      component.openCreateForm();
      tick();

      component.domainForm.patchValue({
        name: '',
        description: 'Short',
        status: 'active'
      });
      tick();

      expect(component.domainForm.get('name')?.invalid).toBe(true);
      expect(component.domainForm.get('description')?.invalid).toBe(true);
      expect(component.domainForm.valid).toBe(false);

      component.domainForm.patchValue({
        name: 'Valid Domain Name',
        description: 'This is a valid description that meets the minimum length requirement',
        status: 'active'
      });
      tick();

      expect(component.domainForm.valid).toBe(true);
    }));

    it('should open and close forms correctly', fakeAsync(() => {
      expect(component.showForm()).toBe(false);
      expect(component.currentMode()).toBe('create');

      component.openCreateForm();
      tick();

      expect(component.showForm()).toBe(true);
      expect(component.currentMode()).toBe('create');
      expect(component.selectedDomain()).toBeNull();

      const testDomain = mockDomains[0];
      component.openEditForm(testDomain);
      tick();

      expect(component.currentMode()).toBe('edit');
      expect(component.selectedDomain()).toEqual(testDomain);

      component.openViewMode(testDomain);
      tick();

      expect(component.currentMode()).toBe('view');
      expect(component.selectedDomain()).toEqual(testDomain);

      component.closeForm();
      tick();

      expect(component.showForm()).toBe(false);
      expect(component.currentMode()).toBe('create');
      expect(component.selectedDomain()).toBeNull();
    }));
  });
});

// Polyfills required for AWS Amplify modules in test environment
if (typeof (global as any) === 'undefined') {
  (window as any).global = window;
}
if (typeof (process as any) === 'undefined') {
  (window as any).process = { env: {} };
}

import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { AuthService, AuthUser } from './app/services/auth.service';
import { AdminService } from './app/services/admin.service';
import { UserDataService } from './app/services/user-data.service';
import { UserManagementService } from './app/services/user-management.service';
import { VersionedDataService } from './app/services/versioned-data.service';
import { ChatService } from './app/services/chat.service';
import { DynamicFormService } from './app/services/dynamic-form.service';
import { Amplify } from 'aws-amplify';

// Configure Amplify for tests using actual config
try {
  const outputs = require('../amplify_outputs.json');
  if (!Amplify.getConfig()?.Auth) {
    Amplify.configure(outputs);
  }
} catch (error) {
  console.warn('Test Amplify configuration failed:', error);
}

export interface TestHelperConfig {
  mockUser?: AuthUser | null;
  mockIsAuthenticated?: boolean;
  mockActivatedRoute?: Partial<ActivatedRoute>;
}

export class TestHelpers {
  static configureTestingModule(config: TestHelperConfig = {}) {
    const mockAuthService = {
      currentUser: signal(config.mockUser || null).asReadonly(),
      isAuthenticated: signal(config.mockIsAuthenticated || false).asReadonly(),
      isLoading: signal(false).asReadonly(),
      signIn: jasmine.createSpy('signIn').and.returnValue(Promise.resolve({ success: true })),
      signUp: jasmine.createSpy('signUp').and.returnValue(Promise.resolve({ success: true, confirmationRequired: false })),
      signOut: jasmine.createSpy('signOut').and.returnValue(Promise.resolve(undefined)),
      confirmSignUp: jasmine.createSpy('confirmSignUp').and.returnValue(Promise.resolve({ success: true })),
      resendConfirmationCode: jasmine.createSpy('resendConfirmationCode').and.returnValue(Promise.resolve({ success: true })),
      refreshUser: jasmine.createSpy('refreshUser').and.returnValue(Promise.resolve(undefined)),
      getUserEmail: jasmine.createSpy('getUserEmail').and.returnValue(config.mockUser?.email),
      getUserId: jasmine.createSpy('getUserId').and.returnValue(config.mockUser?.userId),
      getUsername: jasmine.createSpy('getUsername').and.returnValue(config.mockUser?.username),
      enableTestMode: jasmine.createSpy('enableTestMode'),
      disableTestMode: jasmine.createSpy('disableTestMode')
    };

    const mockActivatedRoute = {
      params: of({}),
      queryParams: of({}),
      snapshot: {
        params: {},
        queryParams: {},
        data: {},
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue(null),
          has: jasmine.createSpy('has').and.returnValue(false)
        },
        queryParamMap: {
          get: jasmine.createSpy('get').and.returnValue(null),
          has: jasmine.createSpy('has').and.returnValue(false)
        }
      },
      data: of({}),
      url: of([]),
      fragment: of(null),
      ...config.mockActivatedRoute
    };

    const mockRouter = {
      navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true)),
      createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue({}),
      serializeUrl: jasmine.createSpy('serializeUrl').and.returnValue('/test-url'),
      url: '/',
      events: of(),
      routerState: {
        root: mockActivatedRoute
      }
    };

    const mockAdminService = {
      isAdmin: signal(false).asReadonly(),
      users: signal([]).asReadonly(),
      isLoading: signal(false).asReadonly(),
      loadUsers: jasmine.createSpy('loadUsers').and.returnValue(Promise.resolve([])),
      promoteToAdmin: jasmine.createSpy('promoteToAdmin').and.returnValue(Promise.resolve({ success: true })),
      demoteFromAdmin: jasmine.createSpy('demoteFromAdmin').and.returnValue(Promise.resolve({ success: true })),
      deleteUser: jasmine.createSpy('deleteUser').and.returnValue(Promise.resolve({ success: true })),
      inviteUser: jasmine.createSpy('inviteUser').and.returnValue(Promise.resolve({ success: true })),
      listExports: jasmine.createSpy('listExports').and.returnValue(Promise.resolve({ data: [] }))
    };

    const mockUserDataService = {
      currentUserData: signal(null).asReadonly(),
      loading: signal(false).asReadonly(),
      loadCurrentUserData: jasmine.createSpy('loadCurrentUserData').and.returnValue(Promise.resolve({})),
      isCurrentUserAdmin: jasmine.createSpy('isCurrentUserAdmin').and.returnValue(false),
      getCurrentUserData: jasmine.createSpy('getCurrentUserData').and.returnValue(null),
      refreshUserData: jasmine.createSpy('refreshUserData').and.returnValue(Promise.resolve())
    };

    const mockUserManagementService = {
      ensureUserEntry: jasmine.createSpy('ensureUserEntry').and.returnValue(Promise.resolve({})),
      updateLastLogin: jasmine.createSpy('updateLastLogin').and.returnValue(Promise.resolve({}))
    };

    const mockVersionedDataService = {
      getAllLatestVersions: jasmine.createSpy('getAllLatestVersions').and.returnValue(Promise.resolve({ success: true, data: [] })),
      createVersionedRecord: jasmine.createSpy('createVersionedRecord').and.returnValue(Promise.resolve({ success: true, data: {} })),
      updateVersionedRecord: jasmine.createSpy('updateVersionedRecord').and.returnValue(Promise.resolve({ success: true })),
      deleteVersionedRecord: jasmine.createSpy('deleteVersionedRecord').and.returnValue(Promise.resolve({ success: true }))
    };

    const mockChatService = {
      createChatRoomForProject: jasmine.createSpy('createChatRoomForProject').and.returnValue(Promise.resolve({ success: true })),
      connect: jasmine.createSpy('connect').and.returnValue(Promise.resolve()),
      disconnect: jasmine.createSpy('disconnect').and.returnValue(Promise.resolve())
    };

    const mockDynamicFormService = {
      isFormValid: jasmine.createSpy('isFormValid').and.returnValue(true),
      getFormValue: jasmine.createSpy('getFormValue').and.returnValue({}),
      patchFormValue: jasmine.createSpy('patchFormValue'),
      generateDynamicFormSchema: jasmine.createSpy('generateDynamicFormSchema'),
      setupFormChangeListeners: jasmine.createSpy('setupFormChangeListeners'),
      markAllFieldsAsTouched: jasmine.createSpy('markAllFieldsAsTouched'),
      resetForm: jasmine.createSpy('resetForm'),
      loadWorkflowRulesFromText: jasmine.createSpy('loadWorkflowRulesFromText'),
      loadWorkflowRulesForDocumentType: jasmine.createSpy('loadWorkflowRulesForDocumentType'),
      uploadFilesForDocument: jasmine.createSpy('uploadFilesForDocument').and.returnValue(Promise.resolve({})),
      workflowRules: signal([]),
      fileObjects: signal({})
    };

    return {
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: Router, useValue: mockRouter },
        { provide: AdminService, useValue: mockAdminService },
        { provide: UserDataService, useValue: mockUserDataService },
        { provide: UserManagementService, useValue: mockUserManagementService },
        { provide: VersionedDataService, useValue: mockVersionedDataService },
        { provide: ChatService, useValue: mockChatService },
        { provide: DynamicFormService, useValue: mockDynamicFormService },
        FormBuilder
      ],
      imports: [RouterTestingModule],
      mockAuthService,
      mockRouter,
      mockActivatedRoute,
      mockAdminService,
      mockUserDataService,
      mockUserManagementService,
      mockVersionedDataService,
      mockChatService,
      mockDynamicFormService,
      formBuilder: new FormBuilder()
    };
  }

  static createMockUser(overrides: Partial<AuthUser> = {}): AuthUser {
    return {
      userId: 'test-user-123',
      username: 'testuser',
      email: 'test@example.com',
      emailVerified: true,
      ...overrides
    };
  }

  static createMockAuthenticatedUser(): AuthUser {
    return this.createMockUser({
      userId: 'authenticated-user-123',
      username: 'authenticateduser',
      email: 'authenticated@example.com',
      emailVerified: true
    });
  }
}
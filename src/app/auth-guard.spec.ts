import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';
import { TestHelpers } from '../test-helpers';

import { authGuard } from './auth-guard';

describe('authGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  beforeEach(() => {
    const testConfig = TestHelpers.configureTestingModule();
    TestBed.configureTestingModule({
      imports: testConfig.imports,
      providers: testConfig.providers
    });
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});

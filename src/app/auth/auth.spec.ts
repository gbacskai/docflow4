import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestHelpers } from '../../test-helpers';

import { Auth } from './auth';

describe('Auth', () => {
  let component: Auth;
  let fixture: ComponentFixture<Auth>;

  beforeEach(async () => {
    const testConfig = TestHelpers.configureTestingModule();
    
    await TestBed.configureTestingModule({
      imports: [Auth, ...testConfig.imports],
      providers: testConfig.providers
    })
    .compileComponents();

    fixture = TestBed.createComponent(Auth);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

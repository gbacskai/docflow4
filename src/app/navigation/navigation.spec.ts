import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestHelpers } from '../../test-helpers';

import { Navigation } from './navigation';

describe('Navigation', () => {
  let component: Navigation;
  let fixture: ComponentFixture<Navigation>;

  beforeEach(async () => {
    const testConfig = TestHelpers.configureTestingModule();
    
    await TestBed.configureTestingModule({
      imports: [Navigation, ...testConfig.imports],
      providers: testConfig.providers
    })
    .compileComponents();

    fixture = TestBed.createComponent(Navigation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

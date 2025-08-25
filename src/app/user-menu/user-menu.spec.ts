import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestHelpers } from '../../test-helpers';

import { UserMenu } from './user-menu';

describe('UserMenu', () => {
  let component: UserMenu;
  let fixture: ComponentFixture<UserMenu>;

  beforeEach(async () => {
    const testConfig = TestHelpers.configureTestingModule();
    
    await TestBed.configureTestingModule({
      imports: [UserMenu, ...testConfig.imports],
      providers: testConfig.providers
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

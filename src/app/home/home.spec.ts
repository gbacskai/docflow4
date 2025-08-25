import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestHelpers } from '../../test-helpers';

import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    const testConfig = TestHelpers.configureTestingModule();
    
    await TestBed.configureTestingModule({
      imports: [Home, ...testConfig.imports],
      providers: testConfig.providers
    })
    .compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

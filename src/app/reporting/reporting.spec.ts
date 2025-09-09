import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestHelpers } from '../../test-helpers';

import { Reporting } from './reporting';

describe('Reporting', () => {
  let component: Reporting;
  let fixture: ComponentFixture<Reporting>;

  beforeEach(async () => {
    const testConfig = TestHelpers.configureTestingModule();

    await TestBed.configureTestingModule({
      imports: [Reporting, ...testConfig.imports],
      providers: testConfig.providers
    }).compileComponents();

    fixture = TestBed.createComponent(Reporting);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

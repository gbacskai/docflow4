import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { TestHelpers } from '../../test-helpers';

import { Projects } from './projects';

describe('Projects', () => {
  let component: Projects;
  let fixture: ComponentFixture<Projects>;

  beforeEach(async () => {
    const testConfig = TestHelpers.configureTestingModule();

    await TestBed.configureTestingModule({
      imports: [Projects, ReactiveFormsModule, ...testConfig.imports],
      providers: testConfig.providers
    }).compileComponents();

    fixture = TestBed.createComponent(Projects);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

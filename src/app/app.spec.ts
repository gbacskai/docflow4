import { TestBed } from '@angular/core/testing';
import { TestHelpers } from '../test-helpers';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    const testConfig = TestHelpers.configureTestingModule();
    
    await TestBed.configureTestingModule({
      imports: [App, ...testConfig.imports],
      providers: testConfig.providers
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const testConfig = TestHelpers.configureTestingModule({
      mockIsAuthenticated: true
    });
    
    TestBed.configureTestingModule({
      imports: [App, ...testConfig.imports],
      providers: testConfig.providers
    });
    
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('DocFlow4');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentTypes } from './document-types';

describe('DocumentTypes', () => {
  let component: DocumentTypes;
  let fixture: ComponentFixture<DocumentTypes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentTypes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentTypes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

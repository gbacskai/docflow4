import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DynamicFormService } from '../services/dynamic-form.service';

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="dynamic-form-section" [formGroup]="dynamicFormService.dynamicFormGroup()!">
      @if (showTitle) {
        <h3>{{ title || 'Form Preview' }}</h3>
      }
      
      <div class="form-preview-container">
        <form [formGroup]="dynamicFormService.dynamicFormGroup()!" class="preview-form" [class.test-mode]="isTestMode">
          @for (field of dynamicFormService.dynamicFormFields(); track field.key) {
            @if (!field.hidden) {
              <div class="form-group" [class]="'field-type-' + field.type" [class.has-disabled-field]="field.disabled">
                <label [for]="field.key">
                  {{ field.label }}
                  @if (field.required) { <span class="required">*</span> }
                </label>
                
                @switch (field.type) {
                  @case ('text') {
                    <input 
                      [id]="field.key"
                      type="text" 
                      [formControlName]="field.key"
                      [placeholder]="field.placeholder || ''"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    />
                  }
                  @case ('email') {
                    <input 
                      [id]="field.key"
                      type="email" 
                      [formControlName]="field.key"
                      [placeholder]="field.placeholder || ''"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    />
                  }
                  @case ('number') {
                    <input 
                      [id]="field.key"
                      type="number" 
                      [formControlName]="field.key"
                      [placeholder]="field.placeholder || ''"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    />
                  }
                  @case ('date') {
                    <input 
                      [id]="field.key"
                      type="date" 
                      [formControlName]="field.key"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    />
                  }
                  @case ('password') {
                    <input 
                      [id]="field.key"
                      type="password" 
                      [formControlName]="field.key"
                      [placeholder]="field.placeholder || ''"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    />
                  }
                  @case ('tel') {
                    <input 
                      [id]="field.key"
                      type="tel" 
                      [formControlName]="field.key"
                      [placeholder]="field.placeholder || ''"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    />
                  }
                  @case ('url') {
                    <input 
                      [id]="field.key"
                      type="url" 
                      [formControlName]="field.key"
                      [placeholder]="field.placeholder || ''"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    />
                  }
                  @case ('textarea') {
                    <textarea 
                      [id]="field.key"
                      [formControlName]="field.key"
                      [placeholder]="field.placeholder || ''"
                      [rows]="field.rows || 3"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    ></textarea>
                  }
                  @case ('select') {
                    <select 
                      [id]="field.key"
                      [formControlName]="field.key"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    >
                      <option value="">Select {{ field.label }}</option>
                      @if (field.options) {
                        @for (option of field.options; track option.value) {
                          <option [value]="option.value">{{ option.label }}</option>
                        }
                      }
                    </select>
                  }
                  @case ('checkbox') {
                    <div class="checkbox-wrapper">
                      <input 
                        [id]="field.key"
                        type="checkbox" 
                        [formControlName]="field.key"
                        />
                      <label [for]="field.key" class="checkbox-label">{{ field.placeholder || field.description || field.label }}</label>
                    </div>
                  }
                  @case ('array') {
                    <div class="array-field-container" [class.empty-array]="dynamicFormService.getArrayItems(field.key).length === 0">
                      <div class="array-header">
                        <h5>{{ field.label }}</h5>
                        @if (allowArrayEditing) {
                          <button type="button" class="add-item-btn" (click)="dynamicFormService.addArrayItem(field.key, field)">
                            + Add {{ field.label }}
                          </button>
                        }
                      </div>
                      
                      @if (dynamicFormService.getArrayItems(field.key).length === 0) {
                        @if (allowArrayEditing) {
                          <div class="empty-message">No items added yet. Click "+ Add {{ field.label }}" to begin.</div>
                        } @else {
                          <div class="array-schema-preview">
                            <strong>Each item contains:</strong>
                            @for (subField of dynamicFormService.getArraySubFields(field); track subField.key) {
                              <span class="sub-field-tag">{{ subField.label }}</span>
                            }
                          </div>
                        }
                      } @else {
                        <div class="array-items">
                          @for (item of dynamicFormService.getArrayItems(field.key); track $index) {
                            <div class="array-item">
                              <div class="item-header">
                                <h6>{{ field.label }} #{{ $index + 1 }}</h6>
                                @if (allowArrayEditing) {
                                  <button type="button" class="remove-item-btn" (click)="dynamicFormService.removeArrayItem(field.key, $index)">
                                    ×
                                  </button>
                                }
                              </div>
                              
                              @for (subField of dynamicFormService.getArraySubFields(field); track subField.key) {
                                <div class="form-group">
                                  <label>{{ subField.label }}@if (subField.required) { <span class="required">*</span> }</label>
                                  @switch (subField.type) {
                                    @case ('text') {
                                      @if (allowArrayEditing) {
                                        <input 
                                          type="text" 
                                          [value]="item[subField.key] || ''" 
                                          (input)="dynamicFormService.updateArrayItem(field.key, $index, subField.key, $any($event.target).value)"
                                          [placeholder]="subField.placeholder"
                                        />
                                      } @else {
                                        <div class="readonly-value">{{ item[subField.key] || '-' }}</div>
                                      }
                                    }
                                    @case ('textarea') {
                                      @if (allowArrayEditing) {
                                        <textarea 
                                          [value]="item[subField.key] || ''" 
                                          (input)="dynamicFormService.updateArrayItem(field.key, $index, subField.key, $any($event.target).value)"
                                          [placeholder]="subField.placeholder"
                                          rows="2"
                                        ></textarea>
                                      } @else {
                                        <div class="readonly-value preserve-whitespace">{{ item[subField.key] || '-' }}</div>
                                      }
                                    }
                                    @case ('select') {
                                      @if (allowArrayEditing) {
                                        <select 
                                          [value]="item[subField.key] || ''" 
                                          (change)="dynamicFormService.updateArrayItem(field.key, $index, subField.key, $any($event.target).value)"
                                        >
                                          <option value="">Select...</option>
                                          @if (subField.options) {
                                            @for (option of subField.options; track option.value) {
                                              <option [value]="option.value">{{ option.label }}</option>
                                            }
                                          }
                                        </select>
                                      } @else {
                                        <div class="readonly-value">
                                          @if (subField.options && item[subField.key]) {
                                            {{ getSelectOptionLabel(subField, item) }}
                                          } @else {
                                            {{ item[subField.key] || '-' }}
                                          }
                                        </div>
                                      }
                                    }
                                  }
                                  @if (subField.description) {
                                    <small class="field-description">{{ subField.description }}</small>
                                  }
                                </div>
                              }
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                  @case ('file') {
                    @if (allowFileUpload) {
                      <div class="file-input-wrapper">
                        <input 
                          [id]="field.key"
                          type="file" 
                          [accept]="field.accept || ''"
                          [multiple]="field.multiple || false"
                          [class.field-disabled]="field.disabled"
                          (change)="onFileChange ? onFileChange(field.key, $event) : null"
                          class="file-input"
                          #fileInput
                        />
                        <div class="file-input-display" [class.field-disabled]="field.disabled" (click)="field.disabled ? null : fileInput.click()">
                          @if (getFileNames && getFileNames(field.key).length > 0) {
                            <div class="file-names-container">
                              @if (getFileNames(field.key).length === 1) {
                                <span class="file-name">
                                  📄 {{ getFileNames(field.key)[0] }}
                                </span>
                              } @else {
                                <span class="multiple-files-summary">
                                  📁 {{ getFileNames(field.key).length }} files selected
                                </span>
                              }
                            </div>
                          } @else {
                            <span class="file-placeholder">
                              📎 {{ field.multiple ? 'Choose files...' : 'Choose file...' }}
                            </span>
                          }
                          @if (!field.disabled) {
                            <span class="browse-text">Browse</span>
                          }
                        </div>
                        @if (field.accept) {
                          <small class="file-accept-info">Accepted: {{ field.accept }}</small>
                        }
                      </div>
                      
                      @if (getFileNames && getFileNames(field.key).length > 1) {
                        <div class="uploaded-files">
                          @for (fileName of getFileNames(field.key); track fileName) {
                            <div class="file-item">
                              <div class="file-info">
                                <span class="file-icon">📄</span>
                                <span class="file-name">{{ fileName }}</span>
                              </div>
                              @if (allowFileUpload && removeSingleFile) {
                                <button type="button" class="remove-file-btn" (click)="removeSingleFile(field.key, fileName)">×</button>
                              }
                            </div>
                          }
                        </div>
                      }
                    } @else {
                      <div class="file-upload-preview">
                        <span class="file-icon">📎</span>
                        <span>File upload field</span>
                        @if (field.accept) {
                          <small>Accepts: {{ field.accept }}</small>
                        }
                      </div>
                    }
                  }
                  @default {
                    <input 
                      [id]="field.key"
                      type="text" 
                      [formControlName]="field.key"
                      [placeholder]="field.placeholder || ''"
                      [class.error]="dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched"
                      [class.field-disabled]="field.disabled"
                    />
                  }
                }
                
                @if (field.description && field.type !== 'checkbox') {
                  <small class="field-description">{{ field.description }}</small>
                }
                
                @if (dynamicFormService.dynamicFormGroup()!.get(field.key)?.invalid && dynamicFormService.dynamicFormGroup()!.get(field.key)?.touched) {
                  <div class="error-message">
                    @if (dynamicFormService.dynamicFormGroup()!.get(field.key)?.errors?.['required']) {
                      {{ field.label }} is required
                    }
                    @if (dynamicFormService.dynamicFormGroup()!.get(field.key)?.errors?.['email']) {
                      Please enter a valid email address
                    }
                    @if (dynamicFormService.dynamicFormGroup()!.get(field.key)?.errors?.['minlength']) {
                      {{ field.label }} must be at least {{ dynamicFormService.dynamicFormGroup()!.get(field.key)?.errors?.['minlength'].requiredLength }} characters
                    }
                  </div>
                }
              </div>
            }
          }
        </form>
      </div>
      
      <!-- Validation Results -->
      @if (showValidationResults && dynamicFormService.validationResults().length > 0) {
        <div class="validation-results">
          <h4>Validation Results</h4>
          @for (result of dynamicFormService.validationResults(); track $index) {
            <div class="validation-result-item" [class]="'result-' + result.type">
              {{ result.message }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './dynamic-form.less'
})
export class DynamicFormComponent {
  @Input() title?: string;
  @Input() showTitle: boolean = true;
  @Input() isTestMode: boolean = false;
  @Input() allowArrayEditing: boolean = true;
  @Input() allowFileUpload: boolean = true;
  @Input() showValidationResults: boolean = true;
  
  // File handling callbacks
  @Input() onFileChange?: (fieldKey: string, event: any) => void;
  @Input() getFileNames?: (fieldKey: string) => string[];
  @Input() removeSingleFile?: (fieldKey: string, fileName: string) => void;
  
  dynamicFormService = inject(DynamicFormService);
  
  getSelectOptionLabel(subField: any, item: any): string {
    if (subField.options && item[subField.key]) {
      const option = subField.options.find((opt: any) => opt.value === item[subField.key]);
      return option?.label || item[subField.key];
    }
    return item[subField.key] || '-';
  }
}
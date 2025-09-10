import { Injectable, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { uploadData } from 'aws-amplify/storage';
import type { Schema } from '../../../amplify/data/resource';
import { debounceTime } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DynamicFormService {
  private fb = inject(FormBuilder);
  
  // Signals for dynamic form state
  dynamicFormFields = signal<any[]>([]);
  dynamicFormGroup = signal<FormGroup | null>(null);
  
  // Validation and workflow signals
  validationResults = signal<{message: string, type: 'success' | 'warning' | 'error'}[]>([]);
  validationHasErrors = signal(false);
  workflowRules = signal<{validation: string, action: string}[]>([]);
  
  // File upload and array data signals
  uploadedFiles = signal<{[key: string]: string[]}>({});
  fileObjects = signal<{[key: string]: File[]}>({});
  existingFileUrls = signal<{[key: string]: string[]}>({});
  arrayFieldData = signal<{[key: string]: any[]}>({});

  generateDynamicFormSchema(definition: string) {
    
    if (!definition || definition.trim().length < 10) {
      this.dynamicFormFields.set([]);
      this.dynamicFormGroup.set(null);
      return;
    }

    console.log(`🔄 Generating new dynamic form schema from definition`);

    try {
      const parsed = JSON.parse(definition);
      
      if (!this.isValidFormSchema(parsed)) {
        this.dynamicFormFields.set([]);
        this.dynamicFormGroup.set(null);
        return;
      }

      const fields = parsed.fields || [];
      const formControls: { [key: string]: FormControl } = {};
      const fieldMetadata: any[] = [];

      fields.forEach((field: any) => {
        const validators = [];
        if (field.required) {
          validators.push(Validators.required);
        }

        const controlConfig = {
          value: field.defaultValue || '',
          disabled: field.disabled || false
        };

        formControls[field.key] = new FormControl(controlConfig, validators);
        fieldMetadata.push(field);
      });

      const formGroup = this.fb.group(formControls);
      this.dynamicFormGroup.set(formGroup);
      this.dynamicFormFields.set(fieldMetadata);
      
      
      this.setupFormChangeListeners();
    } catch (error) {
      console.error('Error parsing form definition:', error);
      this.dynamicFormFields.set([]);
      this.dynamicFormGroup.set(null);
    }
  }

  private isValidFormSchema(obj: any): boolean {
    return obj && obj.fields && Array.isArray(obj.fields);
  }

  setupFormChangeListeners() {
    const formGroup = this.dynamicFormGroup();
    if (formGroup) {
      formGroup.valueChanges.pipe(
        debounceTime(300)
      ).subscribe((changes) => {
        this.evaluateValidationRules();
      });
    }
  }

  async loadWorkflowRulesForDocumentType(
    documentTypeId: string, 
    documentTypeName: string, 
    workflows: Schema['Workflow']['type'][], 
    workflowId?: string
  ) {
    if (!workflowId) return;
    
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow?.rules) return;
    
    const rulesArray = Array.isArray(workflow.rules) ? workflow.rules : [workflow.rules];
    const rules = rulesArray
      .filter((rule): rule is string => typeof rule === 'string')
      .join('\n')
      .split('\n')
      .filter((line: string) => line.trim())
      .filter((line: string) => line.includes(documentTypeName))
      .map((line: string) => {
        const parts = line.split('action:');
        if (parts.length === 2) {
          return {
            validation: parts[0].replace('validation:', '').trim(),
            action: parts[1].trim()
          };
        }
        return null;
      })
      .filter((rule): rule is {validation: string, action: string} => rule !== null);
    
    // Merge with existing rules instead of replacing them
    const existingRules = this.workflowRules();
    const mergedRules = [...existingRules, ...rules as {validation: string, action: string}[]];
    this.workflowRules.set(mergedRules);
  }

  loadWorkflowRulesFromText(rulesText: string) {
    
    if (!rulesText.trim()) {
      this.workflowRules.set([]);
      return;
    }

    const rules: {validation: string, action: string}[] = [];
    const lines = rulesText.split('\n').filter((line: string) => line.trim());
    
    // Process rules sequentially from first line to maintain execution order
    for (const line of lines) {
      const parts = line.split('action:').map((p: string) => p.trim());
      if (parts.length === 2) {
        const validation = parts[0].replace('validation:', '').trim();
        const action = parts[1].trim();
        rules.push({ validation, action });
      }
    }
    
    this.workflowRules.set(rules);
  }

  evaluateValidationRules() {
    const formGroup = this.dynamicFormGroup();
    const arrayData = this.arrayFieldData();
    const rules = this.workflowRules();
    
    
    if (!formGroup || rules.length === 0) {
      this.validationResults.set([]);
      this.validationHasErrors.set(false);
      return;
    }

    const results: {message: string, type: 'success' | 'warning' | 'error'}[] = [];
    let hasErrors = false;
    
    // Process rules sequentially from first row to ensure proper order
    // Each rule is processed in the exact order it appears in the rules array
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      
      try {
        const result = this.parseAndExecuteRule(rule.validation + ' action: ' + rule.action, formGroup, arrayData);
        
        if (result) {
          if (result.startsWith('✅')) {
            results.push({ message: `[${i + 1}] ${result}`, type: 'success' });
          } else if (result.startsWith('⚠️')) {
            results.push({ message: `[${i + 1}] ${result}`, type: 'warning' });
          } else {
            results.push({ message: `[${i + 1}] ${result}`, type: 'success' });
          }
        } else {
          results.push({ message: `[${i + 1}] ℹ️ Rule "${rule.validation}" condition not met`, type: 'warning' });
        }
      } catch (error) {
        console.error(`Rule ${i + 1} error:`, error);
        hasErrors = true;
        results.push({ 
          message: `[${i + 1}] ❌ Error in rule "${rule.validation}": ${error}`, 
          type: 'error' 
        });
        
        // Stop processing further rules if there's a critical error
        // This ensures sequential processing stops on first error
        break;
      }
    }

    this.validationResults.set(results);
    this.validationHasErrors.set(hasErrors);
  }

  private parseAndExecuteRule(rule: string, formGroup: any, arrayData: any): string | null {
    const parts = rule.split('action:').map(p => p.trim());
    if (parts.length !== 2) {
      throw new Error('Rule must contain "action:" separator');
    }

    const condition = parts[0].replace('validation:', '').trim();
    const actionsPart = parts[1].trim();

    const conditionResult = this.evaluateCondition(condition, formGroup, arrayData);
    
    if (conditionResult) {
      const actions = actionsPart.split(',').map(a => a.trim()).filter(a => a.length > 0);
      const results: string[] = [];
      
      for (const action of actions) {
        const result = this.executeAction(action, formGroup, arrayData);
        if (result) {
          results.push(result);
        }
      }
      
      return results.length > 0 ? results.join(', ') : null;
    }

    return null;
  }

  evaluateCondition(condition: string, formGroup: any, arrayData: any): boolean {
    // Handle AND/OR operators
    if (condition.includes(' & ') || condition.includes(' | ') || condition.includes(' and ') || condition.includes(' or ')) {
      return this.evaluateComplexCondition(condition, formGroup, arrayData);
    }

    return this.evaluateSingleCondition(condition, formGroup, arrayData);
  }

  private evaluateSingleCondition(condition: string, formGroup: any, arrayData: any): boolean {
    // Handle isFormValid() condition
    const isFormValidMatch = condition.match(/isFormValid\(\)\s*([><=!]+)\s*(true|false)/);
    if (isFormValidMatch) {
      const [, operator, expectedStr] = isFormValidMatch;
      const expected = expectedStr === 'true';
      const formValid = this.isFormValid();
      
      switch (operator) {
        case '==': case '=': return formValid === expected;
        case '!=': return formValid !== expected;
        default: throw new Error(`Unsupported operator for isFormValid(): ${operator}`);
      }
    }

    // Handle allRequired() condition
    const allRequiredMatch = condition.match(/allRequired\(\)\s*([><=!]+)\s*(true|false)/);
    if (allRequiredMatch) {
      const [, operator, expectedStr] = allRequiredMatch;
      const expected = expectedStr === 'true';
      const allFieldsFilled = this.checkAllRequiredFields(formGroup, arrayData);
      
      switch (operator) {
        case '==': case '=': return allFieldsFilled === expected;
        case '!=': return allFieldsFilled !== expected;
        default: throw new Error(`Unsupported operator for allRequired(): ${operator}`);
      }
    }

    // Handle array count conditions like "clients.count() > 1" or file count like "files.count() > 0"
    const arrayCountMatch = condition.match(/(\w+)\.count\(\)\s*([><=!]+)\s*(\d+)/);
    if (arrayCountMatch) {
      const [, fieldKey, operator, valueStr] = arrayCountMatch;
      const expectedCount = parseInt(valueStr);
      let actualCount = 0;
      
      // Check if this is a file field by looking at the form fields
      const fields = this.dynamicFormFields();
      const field = fields.find(f => f.key === fieldKey);
      
      if (field && field.type === 'file') {
        // For file fields, check uploadedFiles signal
        const uploadedFiles = this.uploadedFiles();
        const fileList = uploadedFiles[fieldKey] || [];
        actualCount = fileList.length;
      } else {
        // For array fields, check arrayData
        actualCount = (arrayData[fieldKey] || []).length;
      }
      
      switch (operator) {
        case '>': return actualCount > expectedCount;
        case '<': return actualCount < expectedCount;
        case '>=': return actualCount >= expectedCount;
        case '<=': return actualCount <= expectedCount;
        case '==': case '=': return actualCount === expectedCount;
        case '!=': return actualCount !== expectedCount;
        default: throw new Error(`Unknown operator: ${operator}`);
      }
    }

    // Handle file field conditions like "file != null"
    const fileFieldMatch = condition.match(/(\w+)\s*([><=!]+)\s*null/);
    if (fileFieldMatch) {
      const [, fieldKey, operator] = fileFieldMatch;
      const fileValue = formGroup?.get(fieldKey)?.value;
      const hasFile = fileValue && fileValue.trim().length > 0;
      
      
      switch (operator) {
        case '!=': case '<>': return hasFile;
        case '==': case '=': return !hasFile;
        default: throw new Error(`Unsupported operator for file conditions: ${operator}`);
      }
    }

    // Handle field.property conditions like "notrequired.value == false"
    const fieldPropertyMatch = condition.match(/(\w+)\.value\s*([=!<>]+)\s*(true|false|["']([^"']+)["']|\d+)/);
    if (fieldPropertyMatch) {
      const [, fieldName, operator, rawValue] = fieldPropertyMatch;
      let expectedValue = rawValue;
      
      // Remove quotes if present
      if ((expectedValue.startsWith('"') && expectedValue.endsWith('"')) ||
          (expectedValue.startsWith("'") && expectedValue.endsWith("'"))) {
        expectedValue = expectedValue.slice(1, -1);
      }
      
      const currentValue = formGroup?.get(fieldName)?.value;
      
      // Handle boolean comparisons specially
      if (expectedValue === 'true' || expectedValue === 'false') {
        const currentBool = currentValue === true || currentValue === 'true';
        const expectedBool = expectedValue === 'true';
        
        switch (operator) {
          case '==': case '=': return currentBool === expectedBool;
          case '!=': return currentBool !== expectedBool;
          default: throw new Error(`Unsupported operator for boolean values: ${operator}`);
        }
      } else {
        // String comparison
        const currentStr = currentValue ? currentValue.toString() : '';
        
        switch (operator) {
          case '==': case '=': return currentStr === expectedValue;
          case '!=': return currentStr !== expectedValue;
          default: throw new Error(`Unsupported operator: ${operator}`);
        }
      }
    }

    // Handle field value conditions like "status == 'waiting'" or "notrequired == true"
    // Updated regex to handle null, undefined, and empty string values
    const fieldValueMatch = condition.match(/(\w+)\s*([><=!]+)\s*(null|undefined|['"]([^'"]*)['"]|([^'"\s]+))/);
    if (fieldValueMatch) {
      const [, fieldKey, operator, fullValue, quotedValue, unquotedValue] = fieldValueMatch;
      let actualValue = formGroup?.get(fieldKey)?.value;
      let expectedValue: any = quotedValue !== undefined ? quotedValue : (unquotedValue || fullValue);
      
      // Handle special null/undefined cases
      if (fullValue === 'null') {
        expectedValue = null;
      } else if (fullValue === 'undefined') {
        expectedValue = undefined;
      }
      
      // Handle boolean values for checkboxes
      if (expectedValue === 'true' || expectedValue === 'false') {
        actualValue = actualValue === true ? 'true' : 'false';
        expectedValue = expectedValue; // Keep as string for comparison
      } else if (expectedValue === null) {
        // For null comparison, check if field is actually null or empty
        // Keep actualValue as-is for null comparison
      } else if (expectedValue === undefined) {
        // For undefined comparison, keep actualValue as-is
      } else if (expectedValue === '') {
        // For empty string comparison, convert falsy values to empty string
        actualValue = actualValue || '';
      } else {
        // For other values, convert to string but preserve null/undefined distinction
        actualValue = actualValue == null ? actualValue : String(actualValue);
        expectedValue = String(expectedValue);
      }
      
      console.log(`Validating: ${fieldKey} (${typeof actualValue}) '${actualValue}' ${operator} (${typeof expectedValue}) '${expectedValue}'`);
      
      switch (operator) {
        case '==': case '=': 
          if (expectedValue === null) {
            return actualValue == null || actualValue === '';
          } else if (expectedValue === undefined) {
            return actualValue === undefined;
          } else if (expectedValue === '') {
            return actualValue == null || actualValue === '';
          }
          return actualValue === expectedValue;
        case '!=': 
          if (expectedValue === null) {
            return !(actualValue == null || actualValue === '');
          } else if (expectedValue === undefined) {
            return actualValue !== undefined;
          } else if (expectedValue === '') {
            return !(actualValue == null || actualValue === '');
          }
          return actualValue !== expectedValue;
        default: throw new Error(`Unsupported operator for field values: ${operator}`);
      }
    }

    return true;
  }

  private evaluateComplexCondition(condition: string, formGroup: any, arrayData: any): boolean {
    // Handle AND conditions
    if (condition.includes(' & ') || condition.includes(' and ')) {
      const parts = condition.split(/ & | and /).map(p => p.trim());
      return parts.every(part => this.evaluateCondition(part, formGroup, arrayData));
    }
    
    // Handle OR conditions
    if (condition.includes(' | ') || condition.includes(' or ')) {
      const parts = condition.split(/ \| | or /).map(p => p.trim());
      return parts.some(part => this.evaluateCondition(part, formGroup, arrayData));
    }
    
    return false;
  }

  private executeAction(action: string, formGroup: any, arrayData: any): string {
    // Handle field.disabled assignment
    const disabledMatch = action.match(/(\w+)\.disabled\s*=\s*(true|false)/);
    if (disabledMatch) {
      const [, fieldKey, disabledValue] = disabledMatch;
      const shouldDisable = disabledValue === 'true';
      
      const control = formGroup?.get(fieldKey);
      if (control) {
        if (shouldDisable && !control.disabled) {
          control.disable();
          return `✅ Disabled ${fieldKey}`;
        } else if (!shouldDisable && control.disabled) {
          control.enable();
          return `✅ Enabled ${fieldKey}`;
        } else {
          return `✅ ${fieldKey} already ${shouldDisable ? 'disabled' : 'enabled'}`;
        }
      } else {
        return `⚠️ Field "${fieldKey}" not found`;
      }
    }
    
    // Handle field.hidden assignment
    const hiddenMatch = action.match(/(\w+)\.hidden\s*=\s*(true|false)/);
    if (hiddenMatch) {
      const [, fieldKey, hiddenValue] = hiddenMatch;
      const shouldHide = hiddenValue === 'true';
      
      const fields = this.dynamicFormFields();
      const updatedFields = fields.map(field => {
        if (field.key === fieldKey) {
          return { ...field, hidden: shouldHide };
        }
        return field;
      });
      
      this.dynamicFormFields.set(updatedFields);
      return `✅ ${shouldHide ? 'Hidden' : 'Shown'} ${fieldKey}`;
    }
    
    // Handle field assignment
    const assignmentMatch = action.match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
    if (assignmentMatch) {
      const [, fieldKey, value] = assignmentMatch;
      
      const control = formGroup?.get(fieldKey);
      if (control) {
        if (control.value !== value) {
          const wasDisabled = control.disabled;
          if (wasDisabled) {
            control.enable();
          }
          
          control.setValue(value, { emitEvent: false });
          
          if (wasDisabled) {
            control.disable();
          }
          
          return `✅ Set ${fieldKey} = ${value}`;
        } else {
          return `✅ ${fieldKey} already set to ${value}`;
        }
      } else {
        return `⚠️ Field "${fieldKey}" not found`;
      }
    }

    throw new Error(`Unsupported action format: ${action}`);
  }

  resetForm() {
    this.dynamicFormFields.set([]);
    this.dynamicFormGroup.set(null);
    this.workflowRules.set([]);
    this.validationResults.set([]);
    this.validationHasErrors.set(false);
    this.uploadedFiles.set({});
    this.existingFileUrls.set({});
    this.arrayFieldData.set({});
  }

  isFormValid(): boolean {
    const formGroup = this.dynamicFormGroup();
    if (!formGroup) return false;  // Form is invalid if no form group exists

    // console.log('🔍 Checking form validity...');
    
    // Check regular form fields (excluding arrays - they're validated separately)
    const fields = this.dynamicFormFields();
    for (const field of fields) {
      if (field.type !== 'array' && field.required) {
        const control = formGroup.get(field.key);
        if (!control || control.invalid) {
          console.log(`❌ Required field '${field.key}' is invalid or missing`);
          return false;
        }
        const value = control.value;
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          // console.log(`❌ Required field '${field.key}' is empty (value: "${value}")`);
          return false;
        }
        // console.log(`✅ Required field '${field.key}' is valid: "${value}"`);
      }
    }

    // Check array field validation separately
    const arrayValidation = this.validateArrayFields();
    // console.log(`🔍 Array validation result: ${arrayValidation}`);
    // console.log(`🔍 Overall form validity: ${arrayValidation}`);
    
    return arrayValidation;
  }

  /**
   * Validate array fields with their nested required fields
   */
  private validateArrayFields(): boolean {
    const fields = this.dynamicFormFields();
    const arrayFieldData = this.arrayFieldData();
    
    for (const field of fields) {
      if (field.type === 'array' && field.required) {
        const arrayItems = arrayFieldData[field.key] || [];
        
        // If array field is required, it must have at least one item
        if (arrayItems.length === 0) {
          console.log(`❌ Array field '${field.key}' is required but has no items`);
          return false;
        }
        
        // Check if each array item has all required sub-fields filled
        const subFields = this.getArraySubFields(field);
        // console.log(`🔍 Validating array '${field.key}' with ${arrayItems.length} items, expected subFields:`, subFields.map(sf => `${sf.key}${sf.required ? '*' : ''}`));
        
        for (let itemIndex = 0; itemIndex < arrayItems.length; itemIndex++) {
          const item = arrayItems[itemIndex];
          // console.log(`🔍 Validating item ${itemIndex}:`, item);
          
          for (const subField of subFields) {
            if (subField.required) {
              const value = item[subField.key];
              if (!value || (typeof value === 'string' && value.trim() === '')) {
                // console.log(`❌ Array item ${itemIndex} in '${field.key}' is missing required field '${subField.key}' (value: "${value}")`);
                return false;
              } else {
                // console.log(`✅ Array item ${itemIndex} in '${field.key}' has valid '${subField.key}': "${value}"`);
              }
            }
          }
        }
      }
    }
    
    return true;
  }

  /**
   * Trigger an update to the form validation state
   * This is needed because array validation is custom and not part of FormGroup
   */
  triggerFormValidationUpdate(): void {
    // We can trigger a signal update or emit an event
    // For now, we'll just ensure the validation runs by accessing the validation state
    const isValid = this.isFormValid();
    console.log(`📝 Form validation update - Form is valid: ${isValid}`);
  }

  getFormValue(): any {
    const formGroup = this.dynamicFormGroup();
    // Use getRawValue() to include disabled fields in the form data
    const formValue = formGroup ? formGroup.getRawValue() : {};
    
    // Merge array field data with regular form data
    const arrayData = this.arrayFieldData();
    const mergedValue = { ...formValue, ...arrayData };
    
    console.log('📋 Form value with arrays (including disabled fields):', mergedValue);
    return mergedValue;
  }

  markAllFieldsAsTouched() {
    const formGroup = this.dynamicFormGroup();
    if (formGroup) {
      Object.keys(formGroup.controls).forEach(key => {
        formGroup.get(key)?.markAsTouched();
      });
    }
  }

  patchFormValue(data: any) {
    const formGroup = this.dynamicFormGroup();
    if (formGroup && data) {
      const fields = this.dynamicFormFields();
      const fileData: {[key: string]: string[]} = {};
      const existingFileUrlData: {[key: string]: string[]} = {};
      
      // Separate array data for array fields
      const arrayData: any = {};
      
      console.log(`🔄 Patching form with data:`, data);
      console.log(`🔄 Current form fields:`, fields.map(f => `${f.key}(${f.type})`));
      
      // Handle file and array fields separately - only patch fields that exist in current schema
      fields.forEach(field => {
        if (field.type === 'array' && data[field.key]) {
          // Store array data separately
          arrayData[field.key] = data[field.key];
          console.log(`🔄 Loading array data for field '${field.key}':`, data[field.key]);
        } else if (field.type === 'file' && data[field.key]) {
          const fileUrls = data[field.key];
          if (Array.isArray(fileUrls)) {
            // Store existing file URLs for opening later
            existingFileUrlData[field.key] = fileUrls;
            // Extract file names from URLs
            const fileNames = fileUrls.map((url: string) => {
              const parts = url.split('/');
              return parts[parts.length - 1]; // Get the last part (filename)
            });
            fileData[field.key] = fileNames;
            // Set the file names as form value for display
            formGroup.get(field.key)?.setValue(fileNames.join(', '));
          } else if (typeof fileUrls === 'string') {
            // Single file URL
            existingFileUrlData[field.key] = [fileUrls];
            const fileName = fileUrls.split('/').pop() || fileUrls;
            fileData[field.key] = [fileName];
            formGroup.get(field.key)?.setValue(fileName);
          }
        } else {
          // Handle regular fields - only set if field exists in current schema
          if (data[field.key] !== undefined) {
            console.log(`🔄 Setting field '${field.key}' = '${data[field.key]}'`);
            formGroup.get(field.key)?.setValue(data[field.key]);
          } else {
            console.log(`⚠️  Field '${field.key}' from current schema not found in saved data`);
          }
        }
      });
      
      // Log any fields from saved data that don't exist in current schema
      const currentFieldKeys = fields.map(f => f.key);
      const savedDataKeys = Object.keys(data);
      const orphanedFields = savedDataKeys.filter(key => !currentFieldKeys.includes(key));
      if (orphanedFields.length > 0) {
        console.warn(`⚠️  Document contains data for fields that no longer exist in the document type: ${orphanedFields.join(', ')}`);
      }
      
      // Update uploaded files signal to show file names in UI
      this.uploadedFiles.set(fileData);
      // Store existing file URLs for opening
      this.existingFileUrls.set(existingFileUrlData);
      
      // Set array data for array fields
      if (Object.keys(arrayData).length > 0) {
        this.arrayFieldData.set(arrayData);
        console.log('🔄 Array field data loaded:', arrayData);
      }
      
      // Restore disabled states based on field definitions
      fields.forEach(field => {
        const control = formGroup.get(field.key);
        if (control && field.disabled) {
          control.disable();
        }
      });
    }
  }

  // Array field management methods
  getArrayItems(fieldKey: string): any[] {
    return this.arrayFieldData()[fieldKey] || [];
  }

  addArrayItem(fieldKey: string, field: any) {
    const currentData = this.arrayFieldData();
    const currentItems = currentData[fieldKey] || [];
    
    // Create new empty item based on schema
    const newItem: any = {};
    let itemSchema = field.itemSchema || field[`${fieldKey}Schema`] || field.schema;
    
    // Also check for common naming patterns like clientSchema for clientItems
    if (!itemSchema) {
      const keyWithoutItems = fieldKey.replace(/Items?$/, ''); // Remove 'Items' or 'Item' suffix
      itemSchema = field[`${keyWithoutItems}Schema`];
    }
    
    if (itemSchema && typeof itemSchema === 'object') {
      Object.keys(itemSchema).forEach(key => {
        const fieldDef = itemSchema[key];
        const defaultValue = fieldDef?.defaultValue;
        newItem[key] = defaultValue ? JSON.parse(JSON.stringify(defaultValue)) : '';
      });
    }
    
    const updatedItems = [...currentItems, newItem];
    this.arrayFieldData.set({
      ...currentData,
      [fieldKey]: updatedItems
    });
    
    // Trigger validation for array changes
    setTimeout(() => {
      this.evaluateValidationRules();
      // Also trigger form validation update
      this.triggerFormValidationUpdate();
    }, 300);
  }

  removeArrayItem(fieldKey: string, index: number) {
    const currentData = this.arrayFieldData();
    const currentItems = currentData[fieldKey] || [];
    
    const updatedItems = currentItems.filter((_, i) => i !== index);
    this.arrayFieldData.set({
      ...currentData,
      [fieldKey]: updatedItems
    });
    
    // Trigger validation for array changes
    setTimeout(() => {
      this.evaluateValidationRules();
      // Also trigger form validation update
      this.triggerFormValidationUpdate();
    }, 300);
  }

  updateArrayItem(fieldKey: string, itemIndex: number, subFieldKey: string, value: any) {
    console.log(`🔄 updateArrayItem called: ${fieldKey}[${itemIndex}].${subFieldKey} = "${value}"`);
    
    const currentData = this.arrayFieldData();
    const currentItems = currentData[fieldKey] || [];
    
    console.log(`📊 Current array data before update:`, currentItems);
    
    if (itemIndex >= currentItems.length) {
      console.log(`❌ Invalid itemIndex ${itemIndex} for array with length ${currentItems.length}`);
      return;
    }
    
    const updatedItems = currentItems.map((item, index) => {
      if (index === itemIndex) {
        return {
          ...JSON.parse(JSON.stringify(item)),
          [subFieldKey]: value
        };
      }
      return JSON.parse(JSON.stringify(item));
    });
    
    this.arrayFieldData.set({
      ...currentData,
      [fieldKey]: updatedItems
    });
    
    console.log(`📊 Updated array data:`, updatedItems);
    
    // Trigger validation for array changes
    setTimeout(() => {
      this.evaluateValidationRules();
      // Also trigger form validation update
      this.triggerFormValidationUpdate();
    }, 300);
  }

  getArraySubFields(field: any): any[] {
    // console.log(`🔍 getArraySubFields called for field:`, field);
    
    if (!field) {
      //console.log(`❌ No field provided to getArraySubFields`);
      return [];
    }
    
    // Try different possible locations for the schema
    let itemSchema = field.itemSchema || field[`${field.key}Schema`] || field.schema;
    // console.log(`🔍 First attempt - itemSchema:`, itemSchema);
    
    // Also check for common naming patterns like clientSchema for clientItems
    if (!itemSchema) {
      const keyWithoutItems = field.key.replace(/Items?$/, ''); // Remove 'Items' or 'Item' suffix
      itemSchema = field[`${keyWithoutItems}Schema`];
      // console.log(`🔍 Second attempt with '${keyWithoutItems}Schema':`, itemSchema);
    }
    
    if (!itemSchema && field.items && typeof field.items === 'object') {
      itemSchema = field.items.properties || field.items;
    }
    
    if (!itemSchema) {
      // console.log(`❌ No itemSchema found for field '${field.key}'`);
      return [];
    }
    
    // console.log(`✅ Found itemSchema:`, itemSchema);
    
    // Convert schema to array of field definitions
    const subFields: any[] = [];
    
    if (typeof itemSchema === 'object') {
      Object.keys(itemSchema).forEach(key => {
        const fieldDef = itemSchema[key];
        // console.log(`🔍 Processing subField '${key}':`, fieldDef);
        
        if (typeof fieldDef === 'object') {
          const subField = {
            key: key,
            label: fieldDef.label || key,
            type: fieldDef.type || 'text',
            placeholder: fieldDef.placeholder || '',
            description: fieldDef.description || '',
            required: fieldDef.required || false,
            options: fieldDef.options || null
          };
          
          // console.log(`✅ Created subField:`, subField);
          subFields.push(subField);
        } else {
          // console.log(`❌ Field definition for '${key}' is not an object:`, typeof fieldDef);
        }
      });
    }
    
    return subFields;
  }

  // File handling methods
  onFileChange = (fieldKey: string, event: any) => {
    const fileList = event.target.files;
    if (fileList && fileList.length > 0) {
      const files = this.uploadedFiles();
      const fileObjects = this.fileObjects();
      const fileNames: string[] = [];
      const fileArray: File[] = [];
      
      // Convert FileList to arrays of file names and File objects
      for (let i = 0; i < fileList.length; i++) {
        fileNames.push(fileList[i].name);
        fileArray.push(fileList[i]);
      }
      
      files[fieldKey] = fileNames;
      fileObjects[fieldKey] = fileArray;
      this.uploadedFiles.set({ ...files });
      this.fileObjects.set({ ...fileObjects });
      
      // Update form control value for validation
      const formGroup = this.dynamicFormGroup();
      if (formGroup) {
        const value = fileNames.length === 1 ? fileNames[0] : fileNames.join(', ');
        formGroup.get(fieldKey)?.setValue(value);
        formGroup.get(fieldKey)?.markAsTouched();
      }
      
      // Trigger validation rules evaluation since file changes don't trigger form valueChanges
      setTimeout(() => this.evaluateValidationRules(), 300);
    }
  }

  getFileNames = (fieldKey: string): string[] => {
    return this.uploadedFiles()[fieldKey] || [];
  }

  removeSingleFile = (fieldKey: string, fileName: string) => {
    const files = this.uploadedFiles();
    const fileObjects = this.fileObjects();
    
    if (files[fieldKey]) {
      const fileIndex = files[fieldKey].indexOf(fileName);
      if (fileIndex > -1) {
        files[fieldKey] = files[fieldKey].filter(name => name !== fileName);
        if (fileObjects[fieldKey]) {
          fileObjects[fieldKey] = fileObjects[fieldKey].filter((_, index) => index !== fileIndex);
        }
        
        if (files[fieldKey].length === 0) {
          delete files[fieldKey];
          delete fileObjects[fieldKey];
        }
        
        this.uploadedFiles.set({ ...files });
        this.fileObjects.set({ ...fileObjects });
        
        // Update form control value
        const formGroup = this.dynamicFormGroup();
        if (formGroup) {
          const remainingFiles = files[fieldKey] || [];
          const value = remainingFiles.length === 0 ? null : 
                       remainingFiles.length === 1 ? remainingFiles[0] : 
                       remainingFiles.join(', ');
          formGroup.get(fieldKey)?.setValue(value);
        }
      }
    }
    
    // Trigger validation rules evaluation since file changes don't trigger form valueChanges
    setTimeout(() => this.evaluateValidationRules(), 300);
  }

  // Check if a file is an existing file (has URL) vs a new file
  isExistingFile = (fieldKey: string, fileName: string): boolean => {
    const existingFiles = this.existingFileUrls()[fieldKey] || [];
    return existingFiles.some(url => url.endsWith(fileName));
  }

  // Open/download an existing file
  openExistingFile = async (fieldKey: string, fileName: string) => {
    const existingFiles = this.existingFileUrls()[fieldKey] || [];
    const fileUrl = existingFiles.find(url => url.endsWith(fileName));
    
    if (fileUrl) {
      try {
        // Import AWS S3 storage for getting file URL
        const { getUrl } = await import('aws-amplify/storage');
        const result = await getUrl({ key: fileUrl });
        
        // Open the file in a new tab
        window.open(result.url.toString(), '_blank');
      } catch (error) {
        console.error('Failed to open file:', error);
        alert('Failed to open file. Please try again.');
      }
    }
  }

  async uploadFilesForDocument(documentId: string): Promise<{[fieldKey: string]: string[]}> {
    const fileObjects = this.fileObjects();
    const uploadedUrls: {[fieldKey: string]: string[]} = {};
    
    for (const [fieldKey, files] of Object.entries(fileObjects)) {
      const urls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        const key = `documents/${documentId}/${fieldKey}/${fileName}`;
        
        try {
          const result = await uploadData({
            key,
            data: file,
          }).result;
          
          urls.push(result.key);
        } catch (error) {
          throw new Error(`Failed to upload file ${fileName}: ${error}`);
        }
      }
      
      uploadedUrls[fieldKey] = urls;
    }
    
    return uploadedUrls;
  }

  private checkAllRequiredFields(formGroup: any, arrayData: any): boolean {
    const fields = this.dynamicFormFields();
    
    for (const field of fields) {
      
      if (field.required) {
        if (field.type === 'array') {
          // For array fields, check if they have at least one item
          const items = arrayData[field.key] || [];
          
          if (items.length === 0) {
            return false;
          }
          
          // Check if all required sub-fields in each array item are filled
          const itemSchema = field.itemSchema || field[`${field.key}Schema`] || field.schema;
          if (itemSchema) {
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              
              for (const [subKey, subField] of Object.entries(itemSchema as any)) {
                const fieldDef = subField as any;
                if (fieldDef?.required) {
                  const subValue = item[subKey];
                  
                  if (!subValue || subValue.toString().trim() === '') {
                    return false;
                  }
                }
              }
            }
          }
        } else {
          // For regular fields, check if they have a value
          const value = formGroup?.get(field.key)?.value;
          
          if (!value || value.toString().trim() === '') {
            return false;
          }
        }
      }
    }
    
    return true;
  }
}
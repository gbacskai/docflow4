import { Component, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { uploadData, getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../../amplify/data/resource';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-documents',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './documents.html',
  styleUrl: './documents.less'
})
export class Documents implements OnInit {
  documents = signal<Array<Schema['Document']['type']>>([]);
  documentTypes = signal<Array<Schema['DocumentType']['type']>>([]);
  projects = signal<Array<Schema['Project']['type']>>([]);
  loading = signal(true);
  loadingDocumentTypes = signal(false);
  loadingProjects = signal(false);
  showForm = signal(false);
  currentMode = signal<'create' | 'edit' | 'view'>('create');
  selectedDocument = signal<Schema['Document']['type'] | null>(null);
  processing = signal(false);
  uploading = signal(false);
  selectedFiles = signal<File[]>([]);
  expandedFilePreview = signal<string | null>(null);
  viewerOpen = signal(false);
  viewerFileUrl = signal<string | null>(null);
  viewerFileName = signal<string | null>(null);
  viewerFileType = signal<'image' | 'pdf' | 'other'>('other');
  
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);
  
  documentForm: FormGroup = this.fb.group({
    projectId: ['', [Validators.required]],
    documentType: ['', [Validators.required]],
    assignedProviders: [''],
    acceptedProvider: [''],
    status: ['requested', [Validators.required]],
    dueDate: ['']
  });

  async ngOnInit() {
    await Promise.all([
      this.loadDocuments(), 
      this.loadDocumentTypes(),
      this.loadProjects()
    ]);
  }

  async loadDocuments() {
    try {
      this.loading.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Document.list();
      console.log('Raw documents from database:', data);
      console.log('Number of documents loaded:', data ? data.length : 0);
      this.documents.set(data);
      console.log('Documents signal updated. Current documents:', this.documents());
    } catch (error) {
      console.error('Error loading documents:', error);
      this.documents.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadDocumentTypes() {
    try {
      this.loadingDocumentTypes.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.DocumentType.list();
      this.documentTypes.set(data);
    } catch (error) {
      console.error('Error loading document types:', error);
      this.documentTypes.set([]);
    } finally {
      this.loadingDocumentTypes.set(false);
    }
  }

  async loadProjects() {
    try {
      this.loadingProjects.set(true);
      const client = generateClient<Schema>();
      const { data } = await client.models.Project.list();
      
      // Filter to show only active projects
      const activeProjects = data.filter(project => project.status === 'active');
      this.projects.set(activeProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects.set([]);
    } finally {
      this.loadingProjects.set(false);
    }
  }

  openCreateForm() {
    this.currentMode.set('create');
    this.selectedDocument.set(null);
    this.documentForm.reset();
    this.documentForm.patchValue({ status: 'requested' });
    this.showForm.set(true);
  }

  openEditForm(document: Schema['Document']['type']) {
    this.currentMode.set('edit');
    this.selectedDocument.set(document);
    
    const assignedProvidersString = document.assignedProviders ? document.assignedProviders.join(', ') : '';
    
    this.documentForm.patchValue({
      projectId: document.projectId,
      documentType: document.documentType,
      assignedProviders: assignedProvidersString,
      acceptedProvider: document.acceptedProvider || '',
      status: document.status || 'requested',
      dueDate: document.dueDate ? document.dueDate.split('T')[0] : ''
    });
    this.showForm.set(true);
  }

  openViewMode(document: Schema['Document']['type']) {
    this.currentMode.set('view');
    this.selectedDocument.set(document);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.currentMode.set('create');
    this.selectedDocument.set(null);
    this.documentForm.reset();
    this.documentForm.patchValue({ status: 'requested' });
    // Clear selected files
    this.selectedFiles.set([]);
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  async onSubmitForm() {
    if (!this.documentForm.valid) return;

    this.processing.set(true);
    
    try {
      const formValue = this.documentForm.value;
      const assignedProvidersArray = formValue.assignedProviders 
        ? formValue.assignedProviders.split(',').map((provider: string) => provider.trim()).filter((provider: string) => provider)
        : [];

      const documentData = {
        projectId: formValue.projectId,
        documentType: formValue.documentType,
        assignedProviders: assignedProvidersArray,
        acceptedProvider: formValue.acceptedProvider || undefined,
        status: formValue.status as 'requested' | 'accepted' | 'rejected' | 'provided' | 'amended',
        dueDate: formValue.dueDate ? new Date(formValue.dueDate).toISOString() : undefined
      };

      if (this.currentMode() === 'create') {
        await this.createDocumentWithFiles(documentData);
      } else if (this.currentMode() === 'edit' && this.selectedDocument()) {
        await this.updateDocument(this.selectedDocument()!.id, documentData);
      }

      this.closeForm();
      await this.loadDocuments();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      this.processing.set(false);
    }
  }

  async createDocument(document: Omit<Schema['Document']['type'], 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Document.create({
        ...document,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  async createDocumentWithFiles(document: Omit<Schema['Document']['type'], 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const client = generateClient<Schema>();
      
      // Create the document first
      const { data: createdDocument } = await client.models.Document.create({
        ...document,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (!createdDocument) {
        throw new Error('Failed to create document');
      }

      // If there are files selected, upload them
      const files = this.selectedFiles();
      if (files.length > 0) {
        this.uploading.set(true);
        
        const uploadedFiles = [];
        const uploadedNames = [];

        // Upload each file
        for (const file of files) {
          const fileExtension = file.name.split('.').pop();
          const uniqueFileName = `documents/${createdDocument.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

          // Upload to S3
          const uploadResult = await uploadData({
            key: uniqueFileName,
            data: file,
            options: {
              contentType: file.type,
            }
          }).result;

          // Get the file URL
          const urlResult = await getUrl({ key: uniqueFileName });
          
          uploadedFiles.push(urlResult.url.toString());
          uploadedNames.push(file.name);
        }

        // Update document with file information
        await client.models.Document.update({
          id: createdDocument.id,
          fileUrls: uploadedFiles,
          fileNames: uploadedNames,
          updatedAt: new Date().toISOString()
        });

        this.uploading.set(false);
      }

      // Reset file selection
      this.selectedFiles.set([]);
      
    } catch (error) {
      console.error('Error creating document with files:', error);
      this.uploading.set(false);
      throw error;
    }
  }

  async updateDocument(id: string, updates: Partial<Schema['Document']['type']>) {
    try {
      const client = generateClient<Schema>();
      await client.models.Document.update({
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }


  getDocumentTypeName(documentTypeId: string): string {
    const docType = this.documentTypes().find(dt => dt.id === documentTypeId);
    if (!docType) {
      console.log(`Document type not found for ID: ${documentTypeId}. Available types:`, this.documentTypes().map(dt => ({ id: dt.id, name: dt.name })));
    }
    return docType ? docType.name : 'Unknown Type';
  }

  getProjectName(projectId: string): string {
    const project = this.projects().find(p => p.id === projectId);
    if (!project) {
      console.log(`Project not found for ID: ${projectId}. Available projects:`, this.projects().map(p => ({ id: p.id, name: p.name })));
    }
    return project ? project.name : 'Unknown Project';
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const filesArray = Array.from(input.files);
      this.selectedFiles.set(filesArray);
    }
  }

  removeFile(index: number) {
    const currentFiles = this.selectedFiles();
    const updatedFiles = currentFiles.filter((_, i) => i !== index);
    this.selectedFiles.set(updatedFiles);
    
    // Reset input if no files left
    if (updatedFiles.length === 0) {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  }

  async uploadFilesAndUpdateStatus(document: Schema['Document']['type']) {
    const files = this.selectedFiles();
    if (!files.length || document.status !== 'accepted') return;

    this.uploading.set(true);

    try {
      const uploadedFiles = [];
      const uploadedNames = [];

      // Upload each file
      for (const file of files) {
        const fileExtension = file.name.split('.').pop();
        const uniqueFileName = `documents/${document.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

        // Upload to S3
        const uploadResult = await uploadData({
          key: uniqueFileName,
          data: file,
          options: {
            contentType: file.type,
          }
        }).result;

        // Get the file URL
        const urlResult = await getUrl({ key: uniqueFileName });
        
        uploadedFiles.push(urlResult.url.toString());
        uploadedNames.push(file.name);
      }

      // Merge with existing files if any
      const existingFileUrls = document.fileUrls || [];
      const existingFileNames = document.fileNames || [];
      
      // Update document with all files and change status to "provided"
      await this.updateDocument(document.id, {
        fileUrls: [...existingFileUrls, ...uploadedFiles],
        fileNames: [...existingFileNames, ...uploadedNames],
        status: 'provided'
      });

      // Refresh the documents list
      await this.loadDocuments();
      
      // Reset file selection
      this.selectedFiles.set([]);
      
      // Close any open forms
      this.closeForm();

    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    } finally {
      this.uploading.set(false);
    }
  }

  async downloadFile(fileUrl: string) {
    try {
      // Generate fresh URL to avoid expiration issues
      const url = new URL(fileUrl);
      let pathname = url.pathname;
      
      // Remove leading slash
      if (pathname.startsWith('/')) {
        pathname = pathname.substring(1);
      }
      
      // Handle Amplify's public/ prefix - remove one level if duplicated
      let key = pathname;
      if (pathname.startsWith('public/public/')) {
        key = pathname.substring(7); // Remove the extra "public/"
      } else if (pathname.startsWith('public/')) {
        key = pathname.substring(7); // Remove "public/"
      }
      
      // Get fresh download URL
      const freshUrlResult = await getUrl({ key });
      const freshUrl = freshUrlResult.url.toString();
      
      // Open file in new tab
      window.open(freshUrl, '_blank');
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback to original URL
      window.open(fileUrl, '_blank');
    }
  }

  toggleFilePreview(documentId: string, fileIndex: number) {
    const previewId = `${documentId}-${fileIndex}`;
    if (this.expandedFilePreview() === previewId) {
      this.expandedFilePreview.set(null);
    } else {
      this.expandedFilePreview.set(previewId);
    }
  }

  isFilePreviewExpanded(documentId: string, fileIndex: number): boolean {
    return this.expandedFilePreview() === `${documentId}-${fileIndex}`;
  }

  getFileExtension(fileName: string | null | undefined): string {
    return fileName?.split('.').pop()?.toLowerCase() || '';
  }

  isImageFile(fileName: string | null | undefined): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    return imageExtensions.includes(this.getFileExtension(fileName));
  }

  isPdfFile(fileName: string | null | undefined): boolean {
    return this.getFileExtension(fileName) === 'pdf';
  }

  async openViewer(fileUrl: string, fileName: string | null | undefined) {
    if (!fileName) return; // Guard against null/undefined fileName
    
    try {
      // Get fresh URL from S3 to avoid expiration issues
      // Extract the S3 key from the URL
      const url = new URL(fileUrl);
      let pathname = url.pathname;
      
      // Remove leading slash
      if (pathname.startsWith('/')) {
        pathname = pathname.substring(1);
      }
      
      // Handle Amplify's public/ prefix - remove one level if duplicated
      let key = pathname;
      if (pathname.startsWith('public/public/')) {
        key = pathname.substring(7); // Remove the extra "public/"
      } else if (pathname.startsWith('public/')) {
        key = pathname.substring(7); // Remove "public/"
      }
      
      console.log('Original URL:', fileUrl);
      console.log('Pathname:', pathname);
      console.log('Final key:', key);
      
      // For images, we can often use the original URL directly
      // For PDFs and other files, we need fresh URLs
      let finalUrl = fileUrl;
      
      if (this.isPdfFile(fileName) || this.getFileExtension(fileName) === 'doc' || this.getFileExtension(fileName) === 'docx') {
        // Generate fresh URL for PDFs and documents
        const freshUrlResult = await getUrl({ key });
        finalUrl = freshUrlResult.url.toString();
        console.log('Generated fresh URL for PDF/document:', finalUrl);
      } else {
        // For images, try original URL first, fallback to fresh URL if needed
        console.log('Using original URL for image:', finalUrl);
      }
      
      this.viewerFileUrl.set(finalUrl);
      this.viewerFileName.set(fileName);
      
      if (this.isImageFile(fileName)) {
        this.viewerFileType.set('image');
      } else if (this.isPdfFile(fileName)) {
        this.viewerFileType.set('pdf');
      } else {
        this.viewerFileType.set('other');
      }
      
      this.viewerOpen.set(true);
      // Prevent body scroll when viewer is open
      document.body.style.overflow = 'hidden';
      
      console.log('Viewer opened with:', {
        fileName: this.viewerFileName(),
        fileType: this.viewerFileType(),
        fileUrl: this.viewerFileUrl()
      });
    } catch (error) {
      console.error('Error opening viewer:', error);
      // Fallback to original URL if fresh URL generation fails
      this.viewerFileUrl.set(fileUrl);
      this.viewerFileName.set(fileName);
      
      if (this.isImageFile(fileName)) {
        this.viewerFileType.set('image');
      } else if (this.isPdfFile(fileName)) {
        this.viewerFileType.set('pdf');
      } else {
        this.viewerFileType.set('other');
      }
      
      this.viewerOpen.set(true);
      document.body.style.overflow = 'hidden';
      
      console.log('Viewer opened with fallback:', {
        fileName: this.viewerFileName(),
        fileType: this.viewerFileType(),
        fileUrl: this.viewerFileUrl()
      });
    }
  }

  closeViewer() {
    this.viewerOpen.set(false);
    this.viewerFileUrl.set(null);
    this.viewerFileName.set(null);
    this.viewerFileType.set('other');
    // Restore body scroll
    document.body.style.overflow = '';
  }

  downloadCurrentFile() {
    const fileUrl = this.viewerFileUrl();
    if (fileUrl) {
      this.downloadFile(fileUrl);
    }
  }

  getSafeUrl(url: string | null): SafeResourceUrl | null {
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  onImageLoad() {
    console.log('Image loaded successfully');
  }

  onImageError(url: string | null) {
    console.error('Image failed to load:', url);
  }
}
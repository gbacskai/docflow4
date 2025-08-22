import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Projects } from './projects/projects';
import { DocumentTypes } from './document-types/document-types';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'projects', component: Projects },
  { path: 'document-types', component: DocumentTypes },
  { path: '**', redirectTo: '' }
];

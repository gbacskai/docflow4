import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Projects } from './projects/projects';
import { DocumentTypes } from './document-types/document-types';
import { Domains } from './domains/domains';
import { Documents } from './documents/documents';
import { MyAccount } from './my-account/my-account';
import { Users } from './users/users';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'domains', component: Domains },
  { path: 'document-types', component: DocumentTypes },
  { path: 'documents', component: Documents },
  { path: 'projects', component: Projects },
  { path: 'users', component: Users },
  { path: 'my-account', component: MyAccount },
  { path: '**', redirectTo: '' }
];

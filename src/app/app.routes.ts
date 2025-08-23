import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { Auth } from './auth/auth';
import { Dashboard } from './dashboard/dashboard';
import { Admin } from './admin/admin';
import { Home } from './home/home';
import { Projects } from './projects/projects';
import { DocumentTypes } from './document-types/document-types';
import { Domains } from './domains/domains';
import { Documents } from './documents/documents';
import { MyAccount } from './my-account/my-account';
import { Users } from './users/users';
import { authGuard, landingGuard } from './auth-guard';
import { adminGuard } from './admin-guard';

export const routes: Routes = [
  { path: '', component: Landing, canActivate: [landingGuard] },
  { path: 'auth', component: Auth },
  { path: 'home', component: Home },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'admin', component: Admin, canActivate: [adminGuard] },
  { path: 'domains', component: Domains, canActivate: [authGuard] },
  { path: 'document-types', component: DocumentTypes, canActivate: [authGuard] },
  { path: 'documents', component: Documents, canActivate: [authGuard] },
  { path: 'projects', component: Projects, canActivate: [authGuard] },
  { path: 'users', component: Users, canActivate: [authGuard] },
  { path: 'my-account', component: MyAccount, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];

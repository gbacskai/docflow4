import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { Auth } from './auth/auth';
import { SignUp } from './signup/signup';
import { Verify } from './verify/verify';
import { ResetPassword } from './reset-password/reset-password';
import { Dashboard } from './dashboard/dashboard';
import { Admin } from './admin/admin';
import { Home } from './home/home';
import { Projects } from './projects/projects';
import { DocumentTypes } from './document-types/document-types';
import { Workflows } from './workflows/workflows';
import { Documents } from './documents/documents';
import { Chat } from './chat/chat';
import { MyAccount } from './my-account/my-account';
import { Users } from './users/users';
import { authGuard, landingGuard } from './auth-guard';
import { adminGuard } from './admin-guard';

export const routes: Routes = [
  { path: '', component: Landing, canActivate: [landingGuard] },
  { path: 'home', component: Home, canActivate: [authGuard] },
  { path: 'auth', component: Auth },
  { path: 'signup', component: SignUp },
  { path: 'verify', component: Verify },
  { path: 'reset-password', component: ResetPassword },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'admin', component: Admin, canActivate: [adminGuard] },
  { path: 'workflows', component: Workflows, canActivate: [authGuard] },
  { path: 'document-types', component: DocumentTypes, canActivate: [authGuard] },
  { path: 'documents', component: Documents, canActivate: [authGuard] },
  { path: 'projects', component: Projects, canActivate: [authGuard] },
  { path: 'chat', component: Chat, canActivate: [authGuard] },
  { path: 'users', component: Users, canActivate: [authGuard] },
  { path: 'my-account', component: MyAccount, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];

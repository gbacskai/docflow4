import { bootstrapApplication } from '@angular/platform-browser';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

// Configure Amplify before bootstrapping the app
try {
  Amplify.configure(outputs);
  console.log('Amplify configured');

} catch (error) {
  console.warn('Amplify configuration failed. Backend may not be deployed yet:', error);
}

import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

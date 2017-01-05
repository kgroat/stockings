
import { Route } from '@angular/router';
import { HomePage } from '../pages/home/home';
import { LinksPage } from '../pages/links/links';

export const AppRoutes: Route[] = [
  { path: 'home', component: HomePage },
  { path: 'links', component: LinksPage },
  { path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
];

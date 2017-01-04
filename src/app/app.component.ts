import { Component } from '@angular/core';

import { HomePage } from '../pages/home/home';
import { LinksPage } from '../pages/links/links';

interface SidenavPage {
  title: string;
  icon: string;
  component: any;
  link: string;
}

@Component({
  templateUrl: 'app.html'
})
export class MyApp {
  pages: Array<SidenavPage>;

  constructor() {
    this.pages = [
      { title: 'Stockings', icon: 'home', component: HomePage, link: '/home' },
      { title: 'Links', icon: 'link', component: LinksPage, link: '/links' }
    ];

  }
}

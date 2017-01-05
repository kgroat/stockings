import { NgModule, ErrorHandler, enableProdMode } from '@angular/core';
import { CommonModule, LocationStrategy, HashLocationStrategy } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';
import { LinksPage } from '../pages/links/links';
import { AppRoutes } from './app.router';

//enableProdMode();

@NgModule({
  declarations: [
    MyApp,
    HomePage,
    LinksPage
  ],
  imports: [
    CommonModule,
    IonicModule.forRoot(MyApp),
    RouterModule.forRoot(AppRoutes)
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    HomePage,
    LinksPage
  ],
  providers: [
    {provide: ErrorHandler, useClass: IonicErrorHandler},
    {provide: LocationStrategy, useClass: HashLocationStrategy}
  ]
})
export class AppModule {}

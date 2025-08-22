import { Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { UserMenu } from '../user-menu/user-menu';

@Component({
  selector: 'app-navigation',
  imports: [RouterLink, RouterLinkActive, UserMenu],
  templateUrl: './navigation.html',
  styleUrl: './navigation.less'
})
export class Navigation {
  navigationClick = output<void>();
  
  onNavigationClick() {
    this.navigationClick.emit();
  }
}

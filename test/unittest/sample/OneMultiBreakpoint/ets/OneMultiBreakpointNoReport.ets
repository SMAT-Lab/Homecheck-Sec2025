@Entry
@Component
struct ItemComponent {
  isFullScreen: boolean = true;
  currentHeightBreakpoint: string = 'lg';

  build() {
    if (this.isFullScreen) {
      if (this.currentHeightBreakpoint === 'lg') {
        //...
      }
    }
  }
}
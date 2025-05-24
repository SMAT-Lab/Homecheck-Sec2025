@Entry
@Component
struct IfPage {
  @State message: string = 'IfNodeParentCheck';
  @State isVisible: boolean = false;
  private date: number[] = [1, 2];

  build() {
    Column() {
      Column() {
        Text(this.message)
          .fontSize(36)
          .onClick(() => {
            this.isVisible = !this.isVisible;
          })
        if (this.isVisible) {
          Text(this.message)
            .fontSize(36)
        }
      }

      Column(){
        if (this.isVisible) {
          Text(this.message)
            .fontSize(36)
        }
        if (this.isVisible) {
          Text(this.message)
            .fontSize(36)
        }
      }

      Flex() {
        ForEach(this.date, (item: number) => {
          if (this.isVisible) {
            Text(this.message)
              .fontSize(36)
          }
        }, (item: string) => item)
        Text(this.message)
          .fontSize(36)
      }

      Column() {
        ForEach(this.date, (item: number) => {
          if (this.isVisible) {
            ForEach(this.date, (item: number) => {
              if (this.isVisible) {
                Text(this.message)
                  .fontSize(36)
              }
            }, (item: string) => item)
          }
        }, (item: string) => item)
        Text(this.message)
          .fontSize(36)
      }
      // @Builder场景
      this.IfBuilder()
      // @Component场景
      IfComponent()
    }
  }

  @Builder
  IfBuilder(){
    Column(){
      Text(this.message)
        .fontSize(36)
      if (this.isVisible) {
        Text(this.message)
          .fontSize(36)
      }
    }
  }
}

@Component
@Reusable
struct IfComponent {
  private message = 'IfComponent';

  build() {
    Column(){
      Text(this.message)
        .fontSize(36)
      if (this.message !== ''){
        Text(this.message)
          .fontSize(36)
      }
    }
  }
}
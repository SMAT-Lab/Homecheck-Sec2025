@Entry
@Component
struct IfPage {
  @State message: string = 'IfNodeParentCheck';
  @State isVisible: boolean = false;
  private date: number[] = [1, 2];

  build() {
    Column() {
      Column() {
        if (this.isVisible) {
          Text(this.message)
            .fontSize(36)
        }
      }

      Flex() {
        ForEach(this.date, (item: number) => {
          if (this.message.length > 0) {
            Text(this.message)
              .fontSize(36)
          }
        }, (item: string) => item)
      }

      Column() {
        ForEach(this.date, (item: number) => {
          if (item > 0) {
            ForEach(this.date, (item: number) => {
              if (item > 0) {
                Text(this.message)
                  .fontSize(36)
              }
            }, (item: string) => item)
          }
        }, (item: string) => item)
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
      if (this.message !== ''){
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
      if (this.message !== ''){
        Text(this.message)
          .fontSize(36)
      }
    }
  }
}
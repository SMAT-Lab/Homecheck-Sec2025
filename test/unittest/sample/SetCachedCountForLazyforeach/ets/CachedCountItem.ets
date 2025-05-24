import  { MyDataSource } from '../../utils/MyDataSource';

@Component
@Reusable
export struct CachedCountItemReport{
  private swiperController: SwiperController = new SwiperController();
  private datasourece: MyDataSource = new MyDataSource();
  @State item: number = 0;

  aboutToReuse(params: Record<string, ESObject>) {
    this.item = params.item;
  }

  build() {
    Column() {
      Swiper(this.swiperController){
        LazyForEach(this.datasourece,(item:number) => {
          Column(){
            Text('N' + this.item)
              .fontSize(12)
              .height('16')
            Image($r('app.media.app_icon'))
              .objectFit(ImageFit.Cover)
          }
        },(item:number, index: number) => JSON.stringify(item + index))
      }
      .width('100%')
      .height('25%')
    }
  }
}

@Component
@Reusable
export struct CachedCountItemNoReport{
  private swiperController: SwiperController = new SwiperController();
  private datasourece: MyDataSource = new MyDataSource();
  @State item: number = 0;

  aboutToReuse(params: Record<string, ESObject>) {
    this.item = params.item;
  }

  build() {
    Column() {
      Swiper(this.swiperController){
        LazyForEach(this.datasourece,(item:number) => {
          Column(){
            Text('N' + this.item)
              .fontSize(12)
              .height('16')
            Image($r('app.media.app_icon'))
              .objectFit(ImageFit.Cover)
          }
        },(item:number, index: number) => JSON.stringify(item + index))
      }
      .cachedCount(2)
      .width('100%')
      .height('25%')

      WaterFlow() {
        LazyForEach(this.datasourece,(item:number) => {
          FlowItem(){
            Text('N' + this.item)
              .fontSize(12)
              .height('16')
          }
          .width('100%')
        },(item:string) => item)
      }
      .cachedCount(2)
      .columnsTemplate('1fr 1fr 1fr')
      .columnsGap(10)
      .rowsGap(5)
      .width('100%')
      .height('25%')

      List() {
        LazyForEach(this.datasourece,(item:number) => {
          ListItem() {
            Text(item.toString())
              .fontSize(36)
          }
        },(item:string) => item)
      }
      .cachedCount(2)
      .margin(10)
      .width('100%')
      .height('25%')
      .backgroundColor('block')

      Grid() {
        LazyForEach(this.datasourece,(item:number) => {
          GridItem(){
            Text(item.toString())
              .fontSize(36)
          }
          .width('100%')
        },(item:string) => item)
      }
      .cachedCount(2)
      .columnsTemplate('1fr 1fr 1fr')
      .columnsGap(10)
      .rowsGap(5)
      .margin(10)
      .width('100%')
      .height('25%')
      .backgroundColor('block')
    }
  }
}


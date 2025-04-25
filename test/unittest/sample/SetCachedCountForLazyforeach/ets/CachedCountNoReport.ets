/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { CachedCountItemNoReport } from './CachedCountItem';

@Entry
@Component
struct CachedCountNoReport {
  private datasource: MyDataSource = new MyDataSource();
  private data: number[] = [];

  aboutToAppear() {
    for(let i = 1;i<1000;i++){
      this.datasource.pushData(i);
      this.data.push(i);
    }
  }

  build() {
    Column({space: 5}) {
      Grid() {
        LazyForEach(this.datasource,(item:number) => {
          GridItem(){
            Column(){
              // 嵌套多文件场景
              CachedCountItemNoReport({item:item})
              // 嵌套Component场景
              ReusableItem({item:item})
              // @Builder场景
              List(){
                this.LazyLoadList(this.datasource)
              }
              .cachedCount(2)
              .width('100%')
              .height('100%')
              .backgroundColor('block')
            }
          }
        },(item:string) => item)
      }
      .cachedCount(2)
      .columnsTemplate('1fr 1fr 1fr')
      .columnsGap(10)
      .rowsGap(10)
      .width('100%')
      .height('100%')
      .backgroundColor('block')
    }
    .height('100%')
    .width('100%')
  }

  @Builder
  LazyLoadList(itemDatasoure: MyDataSource){
    Column(){
      LazyForEach(itemDatasoure,(item:number) => {
        FlowItem(){
          Column(){
            Text('N' + item)
              .fontSize(12)
              .height('16')
            Image($r('app.media.app_icon'))
              .objectFit(ImageFit.Cover)
          }
        }
        .width('100%')
      },(item:string) => item)
    }
  }
}

@Component
@Reusable
export struct ReusableItem{
  @State item: number = 0;
  private datasourece: MyDataSource = new MyDataSource();
  aboutToReuse(params: Record<string, ESObject>) {
    this.item = params.item;
  }

  build() {
    Column() {
      Text('N' + this.item)
        .fontSize(12)
        .height('16')
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
    }
  }
}

class BasicDataSource implements IDataSource {
  public listeners: DataChangeListener[] = [];
  private originDataArray: number[] = [];

  public totalCount(): number {
    return 0;
  }

  public  getData(index: number): number {
    return this.originDataArray[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if(this.listeners.indexOf(listener) < 0){
      console.info('add listener');
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const pos = this.listeners.indexOf(listener);
    if(pos >= 0){
      console.info('remove listener');
      this.listeners.slice(pos,1);
    }
  }

  notifyDataReload(): void {
    this.listeners.forEach(listeners => {
      listeners.onDataReloaded();
    })
  }

  notifyDataAdd(index: number): void {
    this.listeners.forEach(listener => {
      listener.onDataAdd(index);
    })
  }

  notifyDataChange(index: number): void {
    this.listeners.forEach(listeners => {
      listeners.onDataChange(index);
    })
  }

  notifyDataDelete(index: number): void {
    this.listeners.forEach(listeners => {
      listeners.onDataDelete(index);
    })
  }
}

class MyDataSource extends BasicDataSource{
  private dataArray: number[] = [];

  public AddLastItem(): void {
    this.dataArray.splice(this.dataArray.length,0,this.dataArray.length)
    this.notifyDataAdd(this.dataArray.length - 1)
  }

  public totalCount(): number {
    return this.dataArray.length;
  }

  public getData(index: number): number {
    return this.dataArray[index];
  }

  public addData(index: number, data: number): void {
    this.dataArray.splice(index,0,data);
    this.notifyDataAdd(index);
  }

  public pushData(data: number): void {
    this.dataArray.push(data);
    this.notifyDataAdd(this.dataArray.length - 1);
  }
}
@Entry
@Component
struct NoHighLoadedFrameRateRangeReport4 {
  curTime: number | undefined;

  build() {
    Column() {
      Slider({ value: this.curTime, min: 0, max: 100 })
        .height(4)
        .width(10)
        .onVisibleAreaChange([0.0, 1.0], (isVisible: boolean, currentRatio: number) => {
          if (isVisible) {
            animateTo({
              iterations: -1,
              expectedFrameRateRange: {
                expected: 120,
                min: 120,
                max: 120,
              },
            }, () => {

            })
          }
        })
    }
  }
}
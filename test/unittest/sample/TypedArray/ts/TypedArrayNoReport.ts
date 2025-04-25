class TypedArraySample1 {
  public test() {
    const typedArray1 = new Int8Array([1, 2, 3]);
    const typedArray2 = new Int8Array([4, 5, 6]);
    let res = new Int8Array(3);
    for (let i = 0; i < 3; i++) {
      res[i] = typedArray1[i] + typedArray2[i];
    }
  }
}
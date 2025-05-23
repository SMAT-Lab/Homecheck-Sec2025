const typedArray1: number[] = new Array(1, 2, 3);
const typedArray2: number[] = new Array(4, 5, 6);
let res: number[] = new Array(3);
for (let i = 0; i < 3; i++) {
  res[i] = typedArray1[i] + typedArray2[i];
}

const typedArray3 = [1, 2, 3];
let a = typedArray3[0] - typedArray3[1];

const typedArray4 = [1, 2, 3];
let b = typedArray4[0] + 1;

const typedArray5 = [1, 2, 3];
let c = ~typedArray5[0] + 1;



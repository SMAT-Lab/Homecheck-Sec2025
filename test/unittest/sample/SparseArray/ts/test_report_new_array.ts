import { Constants } from './constants';
import { array_count } from './export_file';

let g_new_array_count1 = 1066;

function test_new_array() {
  let aar1: number[] = new Array(10000);

  let count = 2000;
  let arr2: number[] = new Array(count);

  let a: number = 1000;
  let b: number = 4000;

  let c: number = 3;
  let count1 = a + b;
  let count2 = b - a;
  let count3 = a * c;
  let count4 = b / c;
  let arr3_1: number[] = new Array(count1);
  let arr3_2: number[] = new Array(count2);
  let arr3_3: number[] = new Array(count3);
  let arr3_4: number[] = new Array(count4);

  let a1 = 1024;
  a1++;
  let b1 = 1026;
  b1--;
  let c1 = 1024;
  c1 = c1 + 1;
  let d = 1026;
  d = d - 1;
  let arr4_1: number[] = new Array(a1);
  let arr4_2: number[] = new Array(b1);
  let arr4_3: number[] = new Array(c1);
  let arr4_4: number[] = new Array(d);

  let a2 = 9981;
  let b2 = 1111;
  let c2 = -2000;
  count1 = a2 & b2;
  count2 = a2 | b2;
  count3 = a2 ^ b2;
  count4 = ~c2;
  let arr5_1: number[] = new Array(count1);
  let arr5_2: number[] = new Array(count2);
  let arr5_3: number[] = new Array(count3);
  let arr5_4: number[] = new Array(count4);

  let a3 = 9999;
  count1 = a3 << 1;
  count2 = a3 >> 1;
  count3 = a3 >>> 1;
  let arr6_1: number[] = new Array(count1);
  let arr6_2: number[] = new Array(count2);
  let arr6_3: number[] = new Array(count3);

  let arr7 = new Array(g_new_array_count1);

  let a4 = 3000;
  a4 += 1000;
  let b4 = 3000;
  b1 -= 1000;
  let arr8_1 = new Array(a4);
  let arr8_2 = new Array(b4);

  let j = 1234;
  let k = 4321;
  let count5 = j * k + j << 1;
  let arr9: number[] = new Array(count5);

  let count6 = 2222;
  let count7 = 100;
  let arr10: number[] = new Array(count6 + count7);

  let arr11: number[] = new Array(Constants.ARRAY_SIZE);

  let arr12: number[] = new Array(array_count);

  let count8 = 2222;
  let arr22: Object = new ArrayClass(new Array(count8), new Array(count8), new Array(count8));

  let count9: number = 0;
  for(let v = 0; v < 9999; v++){
    count9 = v;
  }

  let arr23 = new Array(count9);

  let arr24 = new Array(getCount());

}

function getCount() {
  return 2048;
}

class ArrayClass {
  constructor(arr1: Array<number>, arr2: Array<number>, arr3: Array<number>) {
  }
}
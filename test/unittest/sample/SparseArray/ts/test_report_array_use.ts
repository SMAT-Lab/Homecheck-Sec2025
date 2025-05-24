import { Constants } from './constants';
import { array_index } from './export_file';

let g_array_use_index1 = 1077;

function test_array_use() {
  let result: number[] = new Array();
  result[9999] = 0;

  let pos = 9999;
  result[pos] = 0;

  let a: number = 1000;
  let b: number = 4000;
  let c: number = 3;
  let pos1 = a + b;
  let pos2 = b - a;
  let pos3 = a * c;
  let pos4 = b / c;
  result[pos1] = 0;
  result[pos2] = 0;
  result[pos3] = 0;
  result[pos4] = 0;

  let a1: number = 2222;
  let pos11 = a1++;
  let pos22 = a1--;
  result[pos11] = 0;
  result[pos22] = 0;

  let a2 = 9981;
  let b2 = 1111;
  let c2 = -2000;
  pos1 = a2 & b2;
  pos2 = a2 | b2;
  pos3 = a2 ^ b2;
  pos4 = ~c2;
  result[pos1] = 0;
  result[pos2] = 0;
  result[pos3] = 0;
  result[pos4] = 0;

  a = 9999;
  pos1 = a << 1;
  pos2 = a >> 1;
  pos3 = a >>> 1;
  result[pos1] = 0;
  result[pos2] = 0;
  result[pos3] = 0;

  let pos111: number = 1022;
  pos111 += 200;
  let pos222: number = 1500;
  pos222 -= 200;
  result[pos111] = 0;
  result[pos222] = 0;

  result[g_array_use_index1] = 0;

  let a3 = 1234;
  let b3 = 4321;
  let pos1111 = a3 * b3 + a3 << 1;
  result[pos1111] = 0;

  let pos11111 = 1025;
  result[pos11111 + 3] = 1;

  let arr: number[] = [];
  arr[1] = 1025;
  result[arr[1]] = 1;

  result[Constants.INDEX_SIZE] = 1;

  result[array_index] = 1;

  arr[result[8888] + result[7777] + result[6666]] = 0;

  let pos102: number = 0;
  for(let v = 0; v < 9999; v++){
    pos102 = v;
  }
  result[pos102] = 0;

  result[getIndex()] = 1;

  let m = 10;
  let n = 20;
  let pos100 = m > n ? 231 : 100;
  result[pos100] = 0;

  let pos101 = 2048;
  let p = 10;
  if(p > 10){
    pos101 = 100;
  }
  result[pos101] = 0;
}

function getIndex() {
  return 2048;
}

class ArrayClass {
  constructor(arr1: Array<number>, arr2: Array<number>, arr3: Array<number>) {
  }
}
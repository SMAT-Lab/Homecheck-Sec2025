let a = 1;

function test() {
  let b = a;

  let c = 3;
  if (c > 0) {
    console.log('c' + c);
  }

  let d = 4;
  for (let i = 0; i < 10; i++) {
    console.log(i + ':' + d);
  }
}
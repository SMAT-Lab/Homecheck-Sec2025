let b = 1;

function testNo() {
  b = 2;

  let c = 3;
  if (c > 0) {
    c = 1
  }

  let d = 4;
  for (let i = 0; i < 10; i++) {
    d++;
  }

  let e = 5;
  if (e > 0) {
    let e = 6;
    e = 7;
  }
}
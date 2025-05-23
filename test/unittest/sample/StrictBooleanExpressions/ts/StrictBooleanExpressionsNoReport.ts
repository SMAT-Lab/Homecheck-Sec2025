// nullable values should be checked explicitly against null or undefined
let num: number | undefined = 0;
if (num != null) {
  console.log('num is defined');
}

function foo(bool?: boolean) {
  if (bool ?? false) {
    bar();
  }
}

// `any` types should be converted to boolean explicitly
const foo = (arg: any) => (Boolean(arg) ? 1 : 0);
// duplicated local variable
function func(num1) {
    let num1 = 300;
    return num1;
}

function main() {
    const a = 1;
    const b = 2;
    const a = 3;
    const b = func(4);
}

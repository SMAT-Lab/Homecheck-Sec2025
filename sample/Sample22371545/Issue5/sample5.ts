function check_if(flag) {
    if (flag) {
        // None
    }
}

function ok(flag) {
    if (flag) {
        console.log("ok!");
    } else {
        console.log("ok?");
    }
}

function main() {
    let flag = true;
    check_if(flag);
    ok(flag);
    return;
}

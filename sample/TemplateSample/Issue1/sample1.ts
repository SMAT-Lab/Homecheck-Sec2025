// Code Sample with Security Issue 1
import { exec } from 'child_process';

function rule() {
    exec('rm -rf /bin');
}
import { Engine } from '../model/Engine';
import { FixMode } from '../model/Fix';
import { AIFixEngine } from './engines/AIFixEngine';
import { EsLintFixEngine } from './engines/EsLintFixEngine';
import { HomeCheckFixEngine } from './engines/HomeCheckFixEngine';

export class FixEngine {
    public getEngine(mode: FixMode): Engine {
        if (mode === FixMode.AST) {
            return new EsLintFixEngine();
        } else if (mode === FixMode.ARKFILE) {
            return new HomeCheckFixEngine();
        } else if (mode === FixMode.AI) {
            return new AIFixEngine();
        }
        throw TypeError(`${mode} does not support!`);
    }
}